"""Laboratory orders and results, owned by Laboratory rather than the legacy DB."""

import hmac
import os
from datetime import datetime
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken
from laboratory.repository import LabConflict, LabRepository


router = APIRouter(prefix="/api/v1/laboratory", tags=["Laboratory"])
bearer = HTTPBearer(auto_error=False)


class OrderResponse(BaseModel):
    id: str
    encounter_id: str
    appointment_id: str
    patient_id: str
    branch_code: str
    doctor_code: str
    service_code: str
    list_price: int
    status: Literal["pending", "accepted", "resulted"]
    payment_method: str | None
    payment_token: str | None
    technician_code: str | None
    result_text: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    patient_name: str | None = None
    patient_phone: str | None = None


class OrderService(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_code: str = Field(min_length=1, max_length=40)
    list_price: int = Field(ge=0)


class EnsureOrdersRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    encounter_id: str
    appointment_id: str
    patient_id: str
    branch_code: str
    doctor_code: str
    services: list[OrderService] = Field(min_length=1, max_length=30)


class ResultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    result_text: str = Field(min_length=1, max_length=20000)
    notes: str | None = Field(default=None, max_length=20000)


def get_repository(request: Request) -> LabRepository:
    return LabRepository(request.app.state.database)


def get_identity_client() -> IdentityClient:
    return IdentityClient()


Repository = Annotated[LabRepository, Depends(get_repository)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]


async def account(credentials: Credentials, identity: Annotated[IdentityClient, Depends(get_identity_client)]) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        current = await identity.current_account(credentials.credentials)
    except InvalidIdentityToken as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc
    except IdentityUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not current.get("is_active"):
        raise HTTPException(status_code=401, detail="Invalid access token")
    return current


Account = Annotated[dict, Depends(account)]


async def technician_branch(account: Account, credentials: Credentials) -> str:
    if account.get("role") != "xnv" or not account.get("subject_id") or credentials is None:
        raise HTTPException(status_code=403, detail="Technician role required")
    base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{base}/api/v1/registry/staff/me",
                                        headers={"Authorization": f"Bearer {credentials.credentials}"})
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Registry service is unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=403, detail="Technician profile is unavailable")
    profile = response.json()
    if profile.get("role") != "xnv" or profile.get("staff_code") != account["subject_id"] or not profile.get("branch_code"):
        raise HTTPException(status_code=403, detail="Technician branch is unavailable")
    return profile["branch_code"]


Branch = Annotated[str, Depends(technician_branch)]


async def patient_profiles(patient_ids: list[str]) -> dict[str, dict]:
    if not patient_ids:
        return {}
    base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
    secret = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
    if not secret:
        raise HTTPException(status_code=503, detail="Registry internal credential is missing")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{base}/api/v1/registry/internal/patients/lookup",
                headers={"X-Service-Token": secret},
                json={"patient_ids": list(set(patient_ids))[:500]},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Registry service is unavailable") from exc
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Registry patient lookup failed")
    return {row["id"]: row for row in response.json()}


def require_service_token(x_service_token: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("LABORATORY_INTERNAL_TOKEN", "")
    if not expected or not x_service_token or not hmac.compare_digest(expected, x_service_token):
        raise HTTPException(status_code=401, detail="Internal service authentication required")


@router.post("/internal/orders", response_model=list[OrderResponse], status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_service_token)])
async def ensure_orders(body: EnsureOrdersRequest, repository: Repository) -> list[OrderResponse]:
    if len({item.service_code for item in body.services}) != len(body.services):
        raise HTTPException(status_code=422, detail="Duplicate laboratory service")
    try:
        rows = await repository.ensure_orders(body.model_dump(exclude={"services"}),
                                              [item.model_dump() for item in body.services])
    except LabConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return [OrderResponse.model_validate(row) for row in rows]


@router.get("/orders/me", response_model=list[OrderResponse])
async def my_orders(repository: Repository, current: Account) -> list[OrderResponse]:
    if current.get("role") != "patient" or not current.get("subject_id"):
        raise HTTPException(status_code=403, detail="Patient role required")
    return [OrderResponse.model_validate(row) for row in await repository.list(patient_id=current["subject_id"])]


@router.get("/orders/doctor", response_model=list[OrderResponse])
async def doctor_orders(repository: Repository, current: Account) -> list[OrderResponse]:
    if current.get("role") != "doctor" or not current.get("subject_id"):
        raise HTTPException(status_code=403, detail="Doctor role required")
    return [OrderResponse.model_validate(row) for row in await repository.list(doctor_code=current["subject_id"])]


@router.get("/orders", response_model=list[OrderResponse])
async def technician_orders(repository: Repository, branch: Branch) -> list[OrderResponse]:
    rows = await repository.list(branch_code=branch)
    profiles = await patient_profiles([row["patient_id"] for row in rows])
    return [OrderResponse.model_validate({
        **row, "patient_name": profiles.get(row["patient_id"], {}).get("full_name"),
        "patient_phone": profiles.get(row["patient_id"], {}).get("phone"),
    }) for row in rows]


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def order_detail(order_id: str, repository: Repository, current: Account,
                       credentials: Credentials) -> OrderResponse:
    row = await repository.get(order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Lab order not found")
    allowed = (current.get("role") == "admin"
               or current.get("role") == "patient" and row["patient_id"] == current.get("subject_id")
               or current.get("role") == "doctor" and row["doctor_code"] == current.get("subject_id"))
    if current.get("role") == "xnv":
        allowed = row["branch_code"] == await technician_branch(current, credentials)
    if not allowed:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return OrderResponse.model_validate(row)


@router.post("/orders/{order_id}/accept", response_model=OrderResponse)
async def accept_order(order_id: str, repository: Repository, current: Account, branch: Branch) -> OrderResponse:
    try:
        row = await repository.accept(order_id, branch, current["subject_id"])
    except LabConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return OrderResponse.model_validate(row)


@router.post("/orders/{order_id}/result", response_model=OrderResponse)
async def record_result(order_id: str, body: ResultRequest, repository: Repository,
                        current: Account, branch: Branch) -> OrderResponse:
    try:
        row = await repository.result(order_id, branch, current["subject_id"],
                                      body.result_text, body.notes)
    except LabConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return OrderResponse.model_validate(row)
