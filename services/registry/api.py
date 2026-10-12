"""Registry contract for creating a stable patient profile from Identity."""

import hmac
import os
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from registry.repository import ProfileConflict, RegistryRepository


router = APIRouter(prefix="/api/v1/registry", tags=["Registry"])


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


def get_repository(request: Request) -> RegistryRepository:
    return RegistryRepository(request.app.state.database)


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
