"""Registry-owned patient profile contract and Identity-backed access control."""

import hmac
import os
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from registry.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken
from registry.repository import ProfileConflict, RegistryRepository


router = APIRouter(prefix="/api/v1/registry", tags=["Registry"])
bearer = HTTPBearer(auto_error=False)


class EnsurePatientRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cccd: str = Field(pattern=r"^[0-9]{12}$")


class PatientResponse(BaseModel):
    id: str
    identity_account_id: str
    cccd: str
    full_name: str | None
    date_of_birth: date | None
    phone: str | None


class PatientListResponse(BaseModel):
    items: list[PatientResponse]
    total: int
    limit: int
    offset: int


StaffRole = Literal["doctor", "letan", "xnv"]


class EnsureStaffRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    staff_code: str = Field(min_length=1, max_length=128)
    role: StaffRole
    full_name: str = Field(min_length=1, max_length=160)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9]{9,15}$")
    specialty: str | None = Field(default=None, max_length=160)
    branch_code: str | None = Field(default=None, max_length=32)

    @field_validator("staff_code", "full_name")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class StaffResponse(BaseModel):
    staff_code: str
    identity_account_id: str
    role: StaffRole
    full_name: str
    phone: str | None
    specialty: str | None
    branch_code: str | None


class StaffListResponse(BaseModel):
    items: list[StaffResponse]
    total: int
    limit: int
    offset: int


class UpdatePatientRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    date_of_birth: date | None = None
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9]{9,15}$")

    @field_validator("full_name")
    @classmethod
    def nonblank_name(cls, value: str | None) -> str | None:
        if value is not None:
            value = " ".join(value.split())
            if not value:
                raise ValueError("Full name cannot be blank")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def date_not_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return value

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not self.model_fields_set:
            raise ValueError("At least one profile field is required")
        return self


def get_repository(request: Request) -> RegistryRepository:
    return RegistryRepository(request.app.state.database)


def get_identity_client() -> IdentityClient:
    return IdentityClient()


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


async def current_patient_account(account: Annotated[dict, Depends(authenticated_account)]) -> dict:
    if account["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patient role required")
    if not account.get("subject_id"):
        raise HTTPException(status_code=409, detail="Patient profile is not linked")
    return account


PatientAccount = Annotated[dict, Depends(current_patient_account)]


async def current_admin_account(account: Annotated[dict, Depends(authenticated_account)]) -> dict:
    if account["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return account


AdminAccount = Annotated[dict, Depends(current_admin_account)]


async def current_staff_account(account: Annotated[dict, Depends(authenticated_account)]) -> dict:
    if account["role"] not in ("doctor", "letan", "xnv"):
        raise HTTPException(status_code=403, detail="Staff role required")
    if not account.get("subject_id"):
        raise HTTPException(status_code=409, detail="Staff profile is not linked")
    return account


StaffAccount = Annotated[dict, Depends(current_staff_account)]


def require_service_token(x_service_token: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
    if not expected or not x_service_token or not hmac.compare_digest(x_service_token, expected):
        raise HTTPException(status_code=401, detail="Invalid service credential")


@router.put("/internal/patients/{account_id}", response_model=PatientResponse,
            dependencies=[Depends(require_service_token)])
async def ensure_patient(
    account_id: UUID,
    body: EnsurePatientRequest,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> PatientResponse:
    try:
        patient = await repository.ensure_patient(str(account_id), body.cccd)
    except ProfileConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return PatientResponse.model_validate(patient)


@router.put("/internal/staff/{account_id}", response_model=StaffResponse,
            dependencies=[Depends(require_service_token)])
async def ensure_staff(
    account_id: UUID,
    body: EnsureStaffRequest,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> StaffResponse:
    try:
        profile = await repository.ensure_staff(str(account_id), body.model_dump())
    except ProfileConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return StaffResponse.model_validate(profile)


@router.get("/patients", response_model=PatientListResponse)
async def list_patients(
    account: AdminAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PatientListResponse:
    patients, total = await repository.list_patients(q.strip(), limit, offset)
    return PatientListResponse(
        items=[PatientResponse.model_validate(patient) for patient in patients],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/patients/me", response_model=PatientResponse)
async def my_patient_profile(
    account: PatientAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> PatientResponse:
    patient = await repository.get_patient(account["id"], account["subject_id"])
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return PatientResponse.model_validate(patient)


@router.patch("/patients/me", response_model=PatientResponse)
async def update_my_patient_profile(
    body: UpdatePatientRequest,
    account: PatientAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> PatientResponse:
    changes = body.model_dump(exclude_unset=True)
    patient = await repository.update_patient(account["id"], account["subject_id"], changes)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return PatientResponse.model_validate(patient)


@router.get("/staff", response_model=StaffListResponse)
async def list_staff(
    account: AdminAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
    q: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> StaffListResponse:
    profiles, total = await repository.list_staff(q.strip(), limit, offset)
    return StaffListResponse(
        items=[StaffResponse.model_validate(profile) for profile in profiles],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/staff/me", response_model=StaffResponse)
async def my_staff_profile(
    account: StaffAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> StaffResponse:
    profile = await repository.get_staff(account["id"], account["subject_id"])
    if profile is None or profile["role"] != account["role"]:
        raise HTTPException(status_code=404, detail="Staff profile not found")
    return StaffResponse.model_validate(profile)


@router.get("/staff/by-code/{staff_code}", response_model=StaffResponse)
async def staff_profile_by_code(
    staff_code: str,
    account: AdminAccount,
    repository: Annotated[RegistryRepository, Depends(get_repository)],
) -> StaffResponse:
    profile = await repository.get_staff_by_code(staff_code)
    if profile is None:
        raise HTTPException(status_code=404, detail="Staff profile not found")
    return StaffResponse.model_validate(profile)
