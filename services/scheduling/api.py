"""Doctor shift catalogue and atomic bulk assignment."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken
from scheduling.registry_client import InvalidScheduleReference, RegistryClient, RegistryUnavailable
from scheduling.repository import ScheduleConflict, SchedulingRepository
from scheduling.change_repository import ScheduleChanges
from common.change_http import call_change, ChangeRejected, ChangeUnavailable
from urllib.parse import urlencode


router = APIRouter(prefix="/api/v1/scheduling", tags=["Doctor schedules"])
bearer = HTTPBearer(auto_error=False)


class ScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    MaBacSi: str = Field(min_length=1, max_length=128)
    MaChiNhanh: str = Field(min_length=2, max_length=32, pattern=r"^[A-Z0-9_-]+$")
    NgayTruc: date
    CaTruc: int = Field(ge=1, le=4)

    @field_validator("MaBacSi")
    @classmethod
    def doctor_code_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Doctor code cannot be blank")
        return value


class BulkScheduleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedules: list[ScheduleCreate] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def no_duplicates(self):
        keys = [(item.MaBacSi, item.NgayTruc, item.CaTruc) for item in self.schedules]
        if len(keys) != len(set(keys)):
            raise ValueError("A doctor cannot have the same shift twice")
        return self


class ScheduleResponse(BaseModel):
    id: int
    MaLichTruc: str
    MaBacSi: str
    MaChiNhanh: str
    NgayTruc: date
    CaTruc: int
    TrangThai: str
    confirmed_appointments: int = 0
    active_holds: int = 0


class ScheduleImpact(BaseModel):
    schedule_id: int
    status: str
    confirmed_appointments: int
    active_holds: int
    can_change: bool
    checked_in: int = 0
    pending: int = 0


class TransferScheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_doctor_code: str = Field(min_length=1, max_length=128)


def to_response(row: dict) -> ScheduleResponse:
    return ScheduleResponse(
        id=row["id"], MaLichTruc=f"LT_{row['id']:06d}",
        MaBacSi=row["doctor_code"], MaChiNhanh=row["branch_code"],
        NgayTruc=row["duty_date"], CaTruc=row["shift"],
        TrangThai=("Đang hoạt động" if row["status"] == "active" else
                   "Lịch sử" if row["status"] == "historical" else
                   "Đang xử lý" if row['status']=='changing' else "Đã hủy"),
        confirmed_appointments=int(row.get("confirmed_appointments", 0)),
        active_holds=int(row.get("active_holds", 0)),
    )


def get_repository(request: Request) -> SchedulingRepository:
    return SchedulingRepository(request.app.state.database)


def get_identity_client(request: Request) -> IdentityClient:
    return request.app.state.identity_client


def get_registry_client() -> RegistryClient:
    return RegistryClient()


async def authenticated_account(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    identity: Annotated[IdentityClient, Depends(get_identity_client)],
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        account = await identity.current_account(credentials.credentials)
    except InvalidIdentityToken as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc
    except IdentityUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not account.get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid access token")
    return account


async def admin_token(
    account: Annotated[dict, Depends(authenticated_account)],
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> str:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return credentials.credentials


async def patient_account(account: Annotated[dict, Depends(authenticated_account)]) -> dict:
    if account.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Patient role required")
    if not account.get("subject_id"):
        raise HTTPException(status_code=409, detail="Patient profile is not linked")
    return account


Repository = Annotated[SchedulingRepository, Depends(get_repository)]
AdminToken = Annotated[str, Depends(admin_token)]
Registry = Annotated[RegistryClient, Depends(get_registry_client)]


def get_schedule_changes(request:Request):
    return ScheduleChanges(request.app.state.database)


class ShiftWorkflow:
    async def inspect(self,row):
        params=urlencode({'doctor_code':row['doctor_code'],'branch_code':row['branch_code'],
                          'date':str(row['duty_date']),'shift':row['shift']})
        return await call_change('appointment','GET','/api/v1/appointments/internal/shift-impact?'+params)

    async def execute(self,operation):
        return await call_change('appointment','POST',f"/api/v1/appointments/internal/shift-changes/{operation['id']}",operation['payload'])


def get_shift_workflow():
    return ShiftWorkflow()


Changes=Annotated[ScheduleChanges,Depends(get_schedule_changes)]
Workflow=Annotated[ShiftWorkflow,Depends(get_shift_workflow)]


@router.get("/doctor-schedules", response_model=list[ScheduleResponse])
async def list_doctor_schedules(
    repository: Repository,
    from_date: date | None = None,
    to_date: date | None = None,
    ma_bac_si: Annotated[str | None, Query(max_length=128)] = None,
) -> list[ScheduleResponse]:
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must not exceed to_date")
    rows = await repository.list_schedules(from_date, to_date, ma_bac_si)
    return [to_response(row) for row in rows]


@router.post("/doctor-schedules/bulk", response_model=list[ScheduleResponse],
             status_code=status.HTTP_201_CREATED)
async def create_doctor_schedules(
    body: BulkScheduleCreate, repository: Repository, token: AdminToken, registry: Registry,
) -> list[ScheduleResponse]:
    try:
        await registry.verify_references(
            token,
            {item.MaBacSi for item in body.schedules},
            {item.MaChiNhanh for item in body.schedules},
        )
    except InvalidScheduleReference as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RegistryUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        rows = await repository.create_many(body.schedules)
    except ScheduleConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return [to_response(row) for row in rows]


@router.get("/doctor-schedules/{schedule_id}/impact", response_model=ScheduleImpact)
async def doctor_schedule_impact(
    schedule_id: int, repository: Repository, token: AdminToken, workflow:Workflow,
) -> ScheduleImpact:
    impact = await repository.schedule_impact(schedule_id)
    if impact is None:
        raise HTTPException(status_code=404, detail="Doctor schedule not found")
    try:
        remote=await workflow.inspect(await repository.get_schedule(schedule_id))
    except (ChangeRejected,ChangeUnavailable) as exc:
        raise HTTPException(503,str(exc)) from exc
    impact.update(checked_in=int(remote['checked_in']),pending=int(remote['pending']))
    impact['can_change']=impact['status'] in ('active','changing') and not impact['active_holds'] and not remote['checked_in'] and not remote['pending']
    return ScheduleImpact(**impact)


@router.post("/doctor-schedules/{schedule_id}/cancel", response_model=ScheduleResponse)
async def cancel_doctor_schedule(schedule_id: int, repository: Repository, token: AdminToken,
                                 changes:Changes,workflow:Workflow) -> ScheduleResponse:
    operation=None
    try:
        operation=await changes.prepare(schedule_id,'cancel')
        await workflow.execute(operation)
        return to_response(await changes.finish(operation['id']))
    except ChangeRejected as exc:
        if operation: await changes.finish(operation['id'],abort=True)
        raise HTTPException(409,str(exc)) from exc
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc
    except ScheduleConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/doctor-schedules/{schedule_id}/transfer", response_model=ScheduleResponse)
async def transfer_doctor_schedule(
    schedule_id: int, body: TransferScheduleRequest, repository: Repository,
    token: AdminToken, registry: Registry, changes:Changes,workflow:Workflow,
) -> ScheduleResponse:
    current = await repository.get_schedule(schedule_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Doctor schedule not found")
    operation=None
    try:
        await registry.verify_references(token, {body.new_doctor_code}, {current["branch_code"]})
        names=await registry.replacement_details(token,current['doctor_code'],body.new_doctor_code)
        operation=await changes.prepare(schedule_id,'transfer',body.new_doctor_code,names)
        await workflow.execute(operation)
        return to_response(await changes.finish(operation['id']))
    except ChangeRejected as exc:
        if operation: await changes.finish(operation['id'],abort=True)
        raise HTTPException(409,str(exc)) from exc
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc
    except InvalidScheduleReference as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RegistryUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ScheduleConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
