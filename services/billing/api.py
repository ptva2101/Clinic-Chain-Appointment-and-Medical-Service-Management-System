"""Simulated-payment ledger for confirmed appointments. No bank transfer is asserted."""

import hmac
import os
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from billing.clients import BillingClients, InvalidAppointment, InvalidService, UpstreamUnavailable
from billing.repository import InvoiceConflict, InvoiceRepository
from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken


router = APIRouter(prefix="/api/v1/billing", tags=["Billing"])
bearer = HTTPBearer(auto_error=False)


class CreateInvoiceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    appointment_id: str = Field(min_length=1, max_length=128)


class InvoiceResponse(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    service_code: str
    list_price: int
    insurance_discount: int
    amount_due: int
    status: Literal["pending", "paid", "refunded"]
    payment_method: str | None
    payment_token: str | None
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime
    branch_code: str | None = None
    doctor_code: str | None = None
    insurance_card_number: str | None = None
    insurance_category_code: str | None = None
    insurance_verified: bool = False
    coverage_bps: int = 0
    refunded_at: datetime | None = None
    source: str = "live"
    legacy_date: date | None = None


class InvoicePage(BaseModel):
    items: list[InvoiceResponse]
    total: int


class MonthlyReport(BaseModel):
    month: str
    paid_count: int
    pending_count: int
    revenue: int
    insurance_discount: int = 0
    legacy_estimated_count: int = 0
    legacy_lab_count: int = 0
    refunded_count: int = 0
    refunded_amount: int = 0
    payment_method: Literal["simulated"] = "simulated"


class GroupedReportItem(BaseModel):
    code: str | None
    paid_count: int
    revenue: int
    insurance_discount: int = 0
    legacy_estimated_count: int = 0
    legacy_lab_count: int = 0


class LegacyLabCharge(BaseModel):
    id: str
    lab_order_id: str
    appointment_id: str
    patient_id: str
    branch_code: str
    doctor_code: str
    service_code: str
    list_price: int
    insurance_discount: int
    amount_due: int
    legacy_date: date
    source: Literal["legacy_mysql"]


def response(row: dict) -> InvoiceResponse:
    return InvoiceResponse.model_validate(row)


def get_repository(request: Request) -> InvoiceRepository:
    return InvoiceRepository(request.app.state.database)


def get_identity_client(request: Request) -> IdentityClient:
    return request.app.state.identity_client


def get_clients() -> BillingClients:
    return BillingClients()


Repository = Annotated[InvoiceRepository, Depends(get_repository)]
Clients = Annotated[BillingClients, Depends(get_clients)]


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


def require_patient(account: dict) -> None:
    if account.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Patient role required")
    if not account.get("subject_id"):
        raise HTTPException(status_code=409, detail="Patient profile is not linked")


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    body: CreateInvoiceRequest, repository: Repository, clients: Clients, account: Account,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> InvoiceResponse:
    require_patient(account)
    existing = await repository.by_appointment(body.appointment_id)
    if existing:
        if existing["patient_account_id"] != account["id"]:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return response(existing)
    try:
        appointment = await clients.appointment(credentials.credentials, body.appointment_id)
        if appointment.get("patient_id") != account["subject_id"]:
            raise InvalidAppointment("Appointment not found")
        if appointment.get("status") != "confirmed":
            raise HTTPException(status_code=409, detail="Only confirmed appointments can be invoiced")
        price = await clients.service_price(appointment["service_code"])
        insurance = await clients.patient_insurance(appointment["patient_id"])
        row = await repository.create(appointment, account, price, insurance)
    except (InvalidAppointment, InvalidService) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except UpstreamUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvoiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response(row)


@router.get("/invoices/me", response_model=list[InvoiceResponse])
async def my_invoices(repository: Repository, account: Account) -> list[InvoiceResponse]:
    require_patient(account)
    return [response(row) for row in await repository.list_patient(account["id"])]


@router.get("/invoices", response_model=InvoicePage)
async def admin_invoices(
    repository: Repository, account: Account,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvoicePage:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    rows, total = await repository.list_admin(limit, offset)
    return InvoicePage(items=[response(row) for row in rows], total=total)


@router.post("/invoices/{invoice_id}/simulate-payment", response_model=InvoiceResponse)
async def simulate_payment(
    invoice_id: str, repository: Repository, clients: Clients, account: Account,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> InvoiceResponse:
    require_patient(account)
    existing = await repository.get(invoice_id)
    if existing is None or existing["patient_account_id"] != account["id"]:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if existing["status"] == "pending":
        try:
            appointment = await clients.appointment(credentials.credentials, existing["appointment_id"])
        except InvalidAppointment as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except UpstreamUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        if appointment.get("status") != "confirmed":
            raise HTTPException(status_code=409, detail="Appointment is no longer payable")
    try:
        row = await repository.simulate_payment(invoice_id, account["id"])
    except InvoiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response(row)


@router.get("/reports/monthly", response_model=MonthlyReport)
async def monthly_report(month: str, repository: Repository, account: Account) -> MonthlyReport:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    try:
        year_text, month_text = month.split("-")
        if len(year_text) != 4 or len(month_text) != 2 or not year_text.isdigit() or not month_text.isdigit():
            raise ValueError("Invalid month")
        year, month_number = int(year_text), int(month_text)
        if not 1 <= month_number <= 12 or not 1 <= year <= 9998:
            raise ValueError("Invalid month")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="month must be YYYY-MM") from exc
    return MonthlyReport.model_validate(await repository.monthly_report(year, month_number))


@router.get("/reports/{group_by}", response_model=list[GroupedReportItem])
async def grouped_report(group_by: Literal["branch", "doctor", "service"], month: str,
                         repository: Repository, account: Account) -> list[GroupedReportItem]:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    try:
        parsed = datetime.strptime(month, "%Y-%m")
        if parsed.strftime("%Y-%m") != month:
            raise ValueError("Invalid month")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="month must be YYYY-MM") from exc
    return [GroupedReportItem.model_validate(row)
            for row in await repository.grouped_report(parsed.year, parsed.month, group_by)]


@router.get("/legacy-lab-charges", response_model=list[LegacyLabCharge])
async def legacy_lab_charges(repository: Repository, account: Account,
                             limit: Annotated[int, Query(ge=1, le=100)] = 20,
                             offset: Annotated[int, Query(ge=0)] = 0) -> list[LegacyLabCharge]:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return [LegacyLabCharge.model_validate(row)
            for row in await repository.list_legacy_lab_charges(limit, offset)]


@router.post("/invoices/{invoice_id}/simulate-refund", response_model=InvoiceResponse)
async def simulate_refund(invoice_id: str, repository: Repository, account: Account) -> InvoiceResponse:
    if account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    try:
        row = await repository.simulate_refund(invoice_id)
    except InvoiceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if row is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response(row)


@router.get("/internal/appointments/{appointment_id}/payment", response_model=InvoiceResponse)
async def internal_payment(
    appointment_id: str, repository: Repository,
    x_service_token: Annotated[str | None, Header()] = None,
) -> InvoiceResponse:
    expected = os.getenv("BILLING_INTERNAL_TOKEN", "")
    if not expected or not x_service_token or not hmac.compare_digest(expected, x_service_token):
        raise HTTPException(status_code=401, detail="Internal service authentication required")
    row = await repository.by_appointment(appointment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response(row)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def invoice_detail(invoice_id: str, repository: Repository, account: Account) -> InvoiceResponse:
    row = await repository.get(invoice_id)
    if row is None or (account.get("role") != "admin" and row["patient_account_id"] != account["id"]):
        raise HTTPException(status_code=404, detail="Invoice not found")
    return response(row)
