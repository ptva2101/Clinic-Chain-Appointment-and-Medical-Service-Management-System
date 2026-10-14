"""Availability and temporary reservations for patient appointments."""

import hmac
import os
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from scheduling.api import Registry, patient_account
from scheduling.registry_client import InvalidScheduleReference, RegistryUnavailable
from scheduling.slot_repository import HoldConflict, HoldNotFound, SlotRepository, SlotUnavailable


router = APIRouter(prefix="/api/v1/scheduling", tags=["Appointment slots"])


class HoldCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    config_code: str = Field(min_length=1, max_length=96)
    doctor_code: str = Field(min_length=1, max_length=128)
    date: date
    shift: int = Field(ge=1, le=4)
    idempotency_key: str = Field(min_length=8, max_length=128)


class HoldResponse(BaseModel):
    id: str
    config_code: str
    branch_code: str
    service_code: str
    doctor_code: str
    date: date
    shift: int
    state: str
    expires_at: datetime
    appointment_id: str | None


class AvailabilityResponse(BaseModel):
    config_code: str
    branch_code: str
    service_code: str
    date: date
    shift: int
    doctors: list[str]
    capacity: int
    held: int
    confirmed: int
    available: int


class ConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    appointment_id: str = Field(min_length=1, max_length=128)


def get_slot_repository(request: Request) -> SlotRepository:
    return SlotRepository(request.app.state.database)


SlotStore = Annotated[SlotRepository, Depends(get_slot_repository)]
Patient = Annotated[dict, Depends(patient_account)]


def today_vietnam() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=7)).date()


def as_response(row: dict) -> HoldResponse:
    expires_at = row["expires_at"].replace(tzinfo=timezone.utc)
    state = row["state"]
    if state == "held" and expires_at <= datetime.now(timezone.utc):
        state = "expired"
    return HoldResponse(
        id=row["id"], config_code=row["config_code"], branch_code=row["branch_code"],
        service_code=row["service_code"], doctor_code=row["doctor_code"],
        date=row["duty_date"], shift=row["shift"], state=state,
        expires_at=expires_at, appointment_id=row["appointment_id"],
    )


async def internal_service_token(
    x_service_token: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.getenv("SCHEDULING_INTERNAL_TOKEN")
    if not expected or not x_service_token or not hmac.compare_digest(expected, x_service_token):
        raise HTTPException(status_code=401, detail="Internal service authentication required")


async def find_config(registry: Registry, code: str) -> dict:
    try:
        return await registry.booking_config(code)
    except InvalidScheduleReference as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RegistryUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/availability", response_model=AvailabilityResponse)
async def availability(
    repository: SlotStore,
    registry: Registry,
    config_code: Annotated[str, Query(min_length=1, max_length=96)],
    date: date,
    shift: Annotated[int, Query(ge=1, le=4)],
    doctor_code: Annotated[str | None, Query(max_length=128)] = None,
) -> AvailabilityResponse:
    config = await find_config(registry, config_code)
    usage = await repository.availability(config_code, config["MaChiNhanh"], date, shift)
    doctors = usage["doctors"]
    capacity = int(config["SlotGioiHan"])
    available = max(0, capacity - usage["held"] - usage["confirmed"])
    if (date < today_vietnam() or config["TrangThai"] != "active" or not doctors
            or (doctor_code and doctor_code not in doctors)):
        available = 0
    return AvailabilityResponse(
        config_code=config_code, branch_code=config["MaChiNhanh"],
        service_code=config["MaDichVu"], date=date, shift=shift,
        doctors=doctors, capacity=capacity, held=usage["held"],
        confirmed=usage["confirmed"], available=available,
    )


@router.post("/holds", response_model=HoldResponse)
async def create_hold(body: HoldCreate, repository: SlotStore, registry: Registry,
                      patient: Patient) -> HoldResponse:
    if body.date < today_vietnam():
        raise HTTPException(status_code=422, detail="Cannot reserve a past date")
    config = await find_config(registry, body.config_code)
    try:
        ttl = int(os.getenv("SCHEDULING_HOLD_TTL_SECONDS", "600"))
        if not 60 <= ttl <= 1800:
            raise ValueError("TTL is outside the allowed range")
        row = await repository.create_hold(body, config, patient["subject_id"], ttl)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Invalid hold TTL configuration") from exc
    except (SlotUnavailable, HoldConflict) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return as_response(row)


@router.get("/holds/{hold_id}", response_model=HoldResponse)
async def get_hold(hold_id: str, repository: SlotStore, patient: Patient) -> HoldResponse:
    row = await repository.get_hold(hold_id, patient["subject_id"])
    if row is None:
        raise HTTPException(status_code=404, detail="Hold not found")
    return as_response(row)


@router.delete("/holds/{hold_id}", response_model=HoldResponse)
async def release_patient_hold(hold_id: str, repository: SlotStore,
                               patient: Patient) -> HoldResponse:
    try:
        row = await repository.transition_hold(hold_id, "release", patient["subject_id"])
    except HoldNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HoldConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return as_response(row)


@router.post("/internal/holds/{hold_id}/confirm", response_model=HoldResponse,
             dependencies=[Depends(internal_service_token)])
async def confirm_hold(hold_id: str, body: ConfirmRequest, repository: SlotStore) -> HoldResponse:
    try:
        row = await repository.transition_hold(
            hold_id, "confirm", appointment_id=body.appointment_id
        )
    except HoldNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HoldConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return as_response(row)


@router.post("/internal/holds/{hold_id}/release", response_model=HoldResponse,
             dependencies=[Depends(internal_service_token)])
async def release_internal_hold(hold_id: str, repository: SlotStore) -> HoldResponse:
    try:
        row = await repository.transition_hold(hold_id, "release")
    except HoldNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return as_response(row)
