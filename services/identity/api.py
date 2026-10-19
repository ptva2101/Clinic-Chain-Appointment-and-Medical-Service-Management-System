"""Identity HTTP contract; schemas become the service's OpenAPI document."""

import hmac
import os
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

import aiomysql
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from identity.repository import IdentityRepository
from identity.registry_client import RegistryClient, RegistryConflict, RegistryUnavailable
from identity.security import (
    ACCESS_MINUTES,
    hash_password,
    decode_access_token,
    issue_access_token,
    new_refresh_token,
    token_digest,
    verify_password,
)


Role = Literal["admin", "patient", "doctor", "letan", "xnv"]
STAFF_ROLES = {"doctor", "letan", "xnv"}
DEFAULT_RESET_PASSWORD = "123456"  # Local/demo only; do not use a shared password in production.
router = APIRouter(prefix="/api/v1/identity", tags=["Identity"])
bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    role: Role
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=512)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = ACCESS_MINUTES * 60


class AccountResponse(BaseModel):
    id: str
    role: Role
    username: str
    subject_id: str | None
    is_active: bool
    registration_pending: bool


class CreateAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Role
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=6, max_length=256)
    subject_id: str | None = Field(default=None, min_length=1, max_length=128)
    full_name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9]{9,15}$")
    specialty: str | None = Field(default=None, max_length=160)
    branch_code: str | None = Field(default=None, max_length=32)

    @field_validator("subject_id", "full_name")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is not None:
            value = " ".join(value.split())
            if not value:
                raise ValueError("Value cannot be blank")
        return value

    @model_validator(mode="after")
    def require_staff_profile(self):
        if self.role in STAFF_ROLES and (not self.subject_id or not self.full_name):
            raise ValueError("Staff account requires subject_id and full_name")
        return self


class RegisterPatientRequest(BaseModel):
    """Public sign-up provisions credentials and a linked Registry profile."""

    model_config = ConfigDict(extra="forbid")
    username: str = Field(pattern=r"^[0-9]{12}$", description="12-digit CCCD used as login name")
    password: str = Field(min_length=6, max_length=256)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)


class ActiveStaffRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["doctor", "letan", "xnv"]
    subject_ids: list[str] = Field(min_length=1, max_length=500)


class ActiveStaffResponse(BaseModel):
    subject_ids: list[str]


def require_registry_service(x_service_token: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
    if not expected or not x_service_token or not hmac.compare_digest(expected, x_service_token):
        raise HTTPException(status_code=401, detail="Internal service authentication required")


def get_repository(request: Request) -> IdentityRepository:
    return IdentityRepository(request.app.state.database)


Repository = Annotated[IdentityRepository, Depends(get_repository)]


def get_registry_client() -> RegistryClient:
    return RegistryClient()


Registry = Annotated[RegistryClient, Depends(get_registry_client)]


async def ensure_patient_link(account: dict, repository: IdentityRepository, registry: RegistryClient) -> dict:
    try:
        profile_id = await registry.ensure_patient(account["id"], account["username"])
    except RegistryConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RegistryUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    linked = await repository.link_patient_profile(account["id"], profile_id)
    if linked is None:
        raise HTTPException(status_code=409, detail="Account could not be linked to patient profile")
    return linked


async def ensure_staff_link(account: dict, repository: IdentityRepository, registry: RegistryClient, details: dict) -> dict:
    try:
        staff_code = await registry.ensure_staff(account["id"], details)
    except RegistryConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RegistryUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    linked = await repository.activate_staff_profile(account["id"], account["role"], staff_code)
    if linked is None:
        raise HTTPException(status_code=409, detail="Account could not be linked to staff profile")
    return linked


async def current_account(
    repository: Repository,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        claims = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc
    account = await repository.find_by_id(claims["sub"])
    if (not account or not account["is_active"] or account["role"] != claims["role"]
            or account["token_version"] != claims["ver"]):
        raise HTTPException(status_code=401, detail="Invalid access token")
    return account


CurrentAccount = Annotated[dict, Depends(current_account)]


def require_admin(account: CurrentAccount) -> dict:
    if account["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator role required")
    return account


AdminAccount = Annotated[dict, Depends(require_admin)]


@router.post("/internal/active-staff", response_model=ActiveStaffResponse,
             dependencies=[Depends(require_registry_service)])
async def active_staff(body: ActiveStaffRequest, repository: Repository) -> ActiveStaffResponse:
    active = await repository.active_subject_ids(body.role, list(set(body.subject_ids)))
    return ActiveStaffResponse(subject_ids=active)


def tokens_for(account: dict, raw_refresh: str) -> TokenResponse:
    return TokenResponse(access_token=issue_access_token(account), refresh_token=raw_refresh)


@router.post("/register", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def register_patient(body: RegisterPatientRequest, repository: Repository, registry: Registry) -> AccountResponse:
    account = await repository.find_by_login("patient", body.username)
    if account is not None:
        if not account["registration_pending"] or not verify_password(body.password, account["password_hash"]):
            raise HTTPException(status_code=409, detail="Account already exists")
    else:
        try:
            account = await repository.create_pending_patient(
                str(uuid4()), body.username, hash_password(body.password)
            )
        except aiomysql.IntegrityError as exc:
            raise HTTPException(status_code=409, detail="Account already exists") from exc
    return AccountResponse.model_validate(await ensure_patient_link(account, repository, registry))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, repository: Repository, registry: Registry) -> TokenResponse:
    account = await repository.find_by_login(body.role, body.username)
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    locked_until = account["locked_until"]
    if locked_until and locked_until > datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, account["password_hash"]):
        await repository.record_login_failure(account["id"])
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not account["is_active"] and not account["registration_pending"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if account["role"] == "patient" and (account["registration_pending"] or not account["subject_id"]):
        account = await ensure_patient_link(account, repository, registry)
    if account["role"] in STAFF_ROLES:
        if account["registration_pending"] or not account["subject_id"]:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        try:
            await registry.ensure_staff(account["id"], {
                "staff_code": account["subject_id"], "role": account["role"],
                "full_name": account["username"], "phone": None,
                "specialty": None, "branch_code": None,
            })
        except RegistryConflict as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except RegistryUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not account["is_active"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await repository.clear_login_failures(account["id"])
    raw, digest, expires_at = new_refresh_token()
    await repository.save_refresh(digest, account["id"], expires_at)
    return tokens_for(account, raw)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, repository: Repository) -> TokenResponse:
    raw, digest, expires_at = new_refresh_token()
    account = await repository.rotate_refresh(token_digest(body.refresh_token), digest, expires_at)
    if account is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return tokens_for(account, raw)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, repository: Repository) -> None:
    await repository.revoke_refresh(token_digest(body.refresh_token))


@router.get("/me", response_model=AccountResponse)
async def me(account: CurrentAccount) -> AccountResponse:
    return AccountResponse.model_validate(account)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordRequest, repository: Repository, account: CurrentAccount) -> None:
    if not verify_password(body.old_password, account["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    await repository.set_password(account["id"], hash_password(body.new_password))


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(repository: Repository, account: CurrentAccount) -> None:
    await repository.revoke_all(account["id"])


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(body: CreateAccountRequest, repository: Repository, registry: Registry,
                         _admin: AdminAccount) -> AccountResponse:
    if body.role in STAFF_ROLES:
        account = await repository.find_by_login(body.role, body.username)
        if account is None:
            try:
                account = await repository.create_pending_staff(
                    str(uuid4()), body.role, body.username, body.subject_id, hash_password(body.password)
                )
            except aiomysql.IntegrityError as exc:
                raise HTTPException(status_code=409, detail="Account already exists") from exc
        elif (not account["registration_pending"] or account["is_active"]
              or account["subject_id"] != body.subject_id
              or not verify_password(body.password, account["password_hash"])):
            raise HTTPException(status_code=409, detail="Account already exists")
        details = {
            "staff_code": body.subject_id, "role": body.role, "full_name": body.full_name,
            "phone": body.phone, "specialty": body.specialty, "branch_code": body.branch_code,
        }
        return AccountResponse.model_validate(await ensure_staff_link(account, repository, registry, details))
    try:
        account = await repository.create_account(
            str(uuid4()), body.role, body.username, body.subject_id, hash_password(body.password)
        )
    except aiomysql.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Account already exists") from exc
    return AccountResponse.model_validate(account)


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    repository: Repository,
    _admin: AdminAccount,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    role: Role | None = None,
) -> list[AccountResponse]:
    accounts = await repository.list_accounts(limit, offset, role)
    return [AccountResponse.model_validate(account) for account in accounts]


@router.post("/accounts/{account_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    account_id: str, repository: Repository, _admin: AdminAccount
) -> None:
    if not await repository.set_password(account_id, hash_password(DEFAULT_RESET_PASSWORD)):
        raise HTTPException(status_code=404, detail="Account not found")


@router.patch("/accounts/{account_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_account(account_id: str, repository: Repository, admin: AdminAccount) -> None:
    if account_id == admin["id"]:
        raise HTTPException(status_code=409, detail="Cannot disable own account")
    if not await repository.disable_account(account_id):
        raise HTTPException(status_code=404, detail="Account not found")


@router.patch("/accounts/{account_id}/enable", status_code=status.HTTP_204_NO_CONTENT)
async def enable_account(account_id: str, repository: Repository, _admin: AdminAccount) -> None:
    account = await repository.find_by_id(account_id)
    if account and account["registration_pending"]:
        raise HTTPException(status_code=409, detail="Pending profile must be linked before enabling account")
    if not await repository.enable_account(account_id):
        raise HTTPException(status_code=404, detail="Account not found")
