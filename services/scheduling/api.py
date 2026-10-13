"""Doctor shift catalogue and atomic bulk assignment."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken
from scheduling.registry_client import InvalidScheduleReference, RegistryClient, RegistryUnavailable
from scheduling.repository import ScheduleConflict, SchedulingRepository


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


def to_response(row: dict) -> ScheduleResponse:
    return ScheduleResponse(
        id=row["id"], MaLichTruc=f"LT_{row['id']:06d}",
        MaBacSi=row["doctor_code"], MaChiNhanh=row["branch_code"],
        NgayTruc=row["duty_date"], CaTruc=row["shift"],
        TrangThai="Đang hoạt động" if row["status"] == "active" else "Đã hủy",
    )


def get_repository(request: Request) -> SchedulingRepository:
    return SchedulingRepository(request.app.state.database)


def get_identity_client() -> IdentityClient:
    return IdentityClient()


def get_registry_client() -> RegistryClient:
    return RegistryClient()


async def admin_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    identity: Annotated[IdentityClient, Depends(get_identity_client)],
) -> str:
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
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return credentials.credentials


Repository = Annotated[SchedulingRepository, Depends(get_repository)]
AdminToken = Annotated[str, Depends(admin_token)]
Registry = Annotated[RegistryClient, Depends(get_registry_client)]


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
