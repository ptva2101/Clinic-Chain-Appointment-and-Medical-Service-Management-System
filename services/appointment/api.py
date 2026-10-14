"""Patient booking saga: Scheduling hold -> local record -> Scheduling confirm."""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from appointment.repository import AppointmentConflict, AppointmentNotFound, AppointmentRepository
from appointment.scheduling_client import SchedulingClient, SchedulingRejected, SchedulingUnavailable
from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken


router = APIRouter(prefix="/api/v1/appointments", tags=["Appointments"])
bearer = HTTPBearer(auto_error=False)


class BookingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    config_code: str = Field(min_length=1, max_length=96)
    doctor_code: str = Field(min_length=1, max_length=128)
    date: date
    shift: int = Field(ge=1, le=4)
    idempotency_key: str = Field(min_length=8, max_length=128)


class AppointmentResponse(BaseModel):
    id: str
    hold_id: str | None
    patient_id: str
    config_code: str
    branch_code: str
    service_code: str
    doctor_code: str
    date: date
    shift: int
    status: Literal["pending", "confirmed", "cancel_pending", "cancelled", "failed", "historical"]
    source: str = "live"
    legacy_status: str | None = None
    created_at: datetime
    updated_at: datetime


def response(row: dict) -> AppointmentResponse:
    return AppointmentResponse(
        id=row["id"], hold_id=row["hold_id"], patient_id=row["patient_id"],
        config_code=row["config_code"], branch_code=row["branch_code"],
        service_code=row["service_code"], doctor_code=row["doctor_code"],
        date=row["duty_date"], shift=row["shift"], status=row["status"],
        source=row.get("source", "live"), legacy_status=row.get("legacy_status"),
        created_at=row["created_at"], updated_at=row["updated_at"],
    )


def get_repository(request: Request) -> AppointmentRepository:
    return AppointmentRepository(request.app.state.database)


def get_identity_client() -> IdentityClient:
    return IdentityClient()


def get_scheduling_client() -> SchedulingClient:
    return SchedulingClient()


Repository = Annotated[AppointmentRepository, Depends(get_repository)]
Scheduling = Annotated[SchedulingClient, Depends(get_scheduling_client)]


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


Account = Annotated[dict, Depends(authenticated_account)]


def require_role(account: dict, role: str) -> None:
    if account.get("role") != role:
        raise HTTPException(status_code=403, detail=f"{role.title()} role required")
    if role != "admin" and not account.get("subject_id"):
        raise HTTPException(status_code=409, detail=f"{role.title()} profile is not linked")


def scheduling_error(exc: SchedulingRejected) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def book(
    body: BookingRequest, repository: Repository, scheduling: Scheduling,
    account: Account,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> AppointmentResponse:
    require_role(account, "patient")
    try:
        hold = await scheduling.create_hold(credentials.credentials, body.model_dump(mode="json"))
    except SchedulingRejected as exc:
        raise scheduling_error(exc) from exc
    except SchedulingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    required = ("id", "config_code", "branch_code", "service_code", "doctor_code", "date", "shift")
    if any(key not in hold for key in required) or hold["state"] not in ("held", "confirmed"):
        raise HTTPException(status_code=503, detail="Scheduling returned an invalid hold")
    existing = await repository.by_hold(hold["id"])
    if hold["state"] == "confirmed" and existing is None:
        raise HTTPException(status_code=409, detail="Hold is linked to an unknown appointment")
    try:
        row = await repository.reserve(hold, account)
    except AppointmentConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if row["status"] == "confirmed":
        return response(row)
    if row["status"] != "pending":
        raise HTTPException(status_code=409, detail="Appointment is not bookable")
    try:
        confirmed = await scheduling.confirm(hold["id"], row["id"])
    except SchedulingRejected as exc:
        await repository.set_status(row["id"], ("pending",), "failed")
        raise scheduling_error(exc) from exc
    except SchedulingUnavailable as exc:
        # Keep pending: a retry can reconcile an uncertain remote confirmation.
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if confirmed.get("state") != "confirmed" or confirmed.get("appointment_id") != row["id"]:
        raise HTTPException(status_code=503, detail="Scheduling confirmation is uncertain")
    row = await repository.set_status(row["id"], ("pending",), "confirmed")
    return response(row)


@router.get("/me", response_model=list[AppointmentResponse])
async def my_appointments(repository: Repository, account: Account) -> list[AppointmentResponse]:
    require_role(account, "patient")
    return [response(row) for row in await repository.list(patient_id=account["subject_id"])]


@router.get("/doctor/me", response_model=list[AppointmentResponse])
async def doctor_appointments(repository: Repository, account: Account) -> list[AppointmentResponse]:
    require_role(account, "doctor")
    return [response(row) for row in await repository.list(doctor_code=account["subject_id"])]


@router.get("", response_model=list[AppointmentResponse])
async def admin_appointments(
    repository: Repository, account: Account, from_date: date | None = None,
    to_date: date | None = None,
    appointment_status: Annotated[
        Literal["pending", "confirmed", "cancel_pending", "cancelled", "failed", "historical"] | None,
        Query(alias="status"),
    ] = None,
) -> list[AppointmentResponse]:
    require_role(account, "admin")
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must not exceed to_date")
    return [response(row) for row in await repository.list(
        from_date=from_date, to_date=to_date, status=appointment_status
    )]


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def appointment_detail(
    appointment_id: str, repository: Repository, account: Account,
) -> AppointmentResponse:
    row = await repository.get(appointment_id)
    if row is None or (account["role"] != "admin"
                       and row["patient_account_id"] != account["id"]
                       and not (account["role"] == "doctor"
                                and row["doctor_code"] == account.get("subject_id"))):
        raise HTTPException(status_code=404, detail="Appointment not found")
    return response(row)


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel(
    appointment_id: str, repository: Repository, scheduling: Scheduling, account: Account,
) -> AppointmentResponse:
    require_role(account, "patient")
    row = await repository.get(appointment_id)
    if row is None or row["patient_account_id"] != account["id"]:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if row["status"] == "cancelled":
        return response(row)
    if row["status"] not in ("confirmed", "cancel_pending"):
        raise HTTPException(status_code=409, detail="Appointment is not cancellable")
    try:
        row = await repository.set_status(row["id"], ("confirmed", "cancel_pending"), "cancel_pending")
        released = await scheduling.release(row["hold_id"])
    except (AppointmentConflict, AppointmentNotFound) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except SchedulingRejected as exc:
        raise scheduling_error(exc) from exc
    except SchedulingUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if released.get("state") not in ("released", "expired"):
        raise HTTPException(status_code=503, detail="Scheduling release is uncertain")
    row = await repository.set_status(row["id"], ("cancel_pending",), "cancelled")
    return response(row)
