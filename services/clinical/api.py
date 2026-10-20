"""Doctor encounter workflow and patient-owned medical history."""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator

from clinical.clients import ClinicalClients, ClinicalRejected, ClinicalUnavailable
from clinical.repository import ClinicalRepository, EncounterConflict
from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken


router = APIRouter(prefix="/api/v1/clinical", tags=["Clinical"])
bearer = HTTPBearer(auto_error=False)


class Prescription(BaseModel):
    model_config = ConfigDict(extra="forbid")
    medicine_code: str = Field(min_length=1, max_length=40)
    quantity: int = Field(ge=1, le=1000)
    dosage: str | None = Field(default=None, max_length=500)


class Treatment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service_code: str = Field(min_length=1, max_length=40)
    sessions: int = Field(ge=1, le=100)


class SaveEncounter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    appointment_id: str
    disease_code: str | None = Field(default=None, max_length=40)
    symptoms: str = Field(min_length=1, max_length=20000)
    advice: str | None = Field(default=None, max_length=20000)
    lab_service_codes: list[str] = Field(default_factory=list, max_length=30)
    prescriptions: list[Prescription] = Field(default_factory=list, max_length=100)
    treatments: list[Treatment] = Field(default_factory=list, max_length=30)
    is_draft: bool = False


class EncounterResponse(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    doctor_code: str
    branch_code: str
    visit_date: date
    status: Literal["draft", "completed"]
    disease_code: str | None
    symptoms: str
    advice: str | None
    lab_service_codes: list[str]
    prescriptions: list[Prescription]
    treatments: list[Treatment]
    created_at: datetime
    updated_at: datetime


class TreatmentPlanResponse(BaseModel):
    id: str
    encounter_id: str
    patient_id: str
    doctor_code: str
    service_code: str
    total_sessions: int
    scheduled_sessions: int = 0
    completed_sessions: int = 0
    created_at: datetime


class SessionBookingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    config_code: str = Field(min_length=1, max_length=96)
    doctor_code: str = Field(min_length=1, max_length=128)
    date: date
    shift: int = Field(ge=1, le=4)
    idempotency_key: str = Field(min_length=8, max_length=128)
    session_number: int = Field(ge=1, le=100)


class TreatmentSessionResponse(BaseModel):
    id: str
    plan_id: str
    session_number: int
    config_code: str
    doctor_code: str
    date: date
    shift: int
    appointment_id: str | None
    invoice_id: str | None
    status: Literal["pending", "booked", "completed"]
    created_at: datetime
    updated_at: datetime


class DiseaseResponse(BaseModel):
    MaBenh: str
    TenBenh: str


class MedicineResponse(BaseModel):
    MaThuoc: str
    TenThuoc: str
    DonViTinh: str


class DiseaseUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=255)
    active: bool = True

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value.strip()


class MedicineUpsert(DiseaseUpsert):
    unit: str = Field(min_length=1, max_length=80)

    @field_validator("unit")
    @classmethod
    def nonblank_unit(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Unit cannot be blank")
        return value.strip()


class CatalogItem(BaseModel):
    code: str
    name: str
    active: bool
    unit: str | None = None


def session_response(row: dict) -> TreatmentSessionResponse:
    return TreatmentSessionResponse(
        id=row["id"], plan_id=row["plan_id"], session_number=row["session_number"],
        config_code=row["config_code"], doctor_code=row["doctor_code"],
        date=row["duty_date"], shift=row["shift"], appointment_id=row["appointment_id"],
        invoice_id=row["invoice_id"], status=row["status"],
        created_at=row["created_at"], updated_at=row["updated_at"],
    )


def get_repository(request: Request) -> ClinicalRepository:
    return ClinicalRepository(request.app.state.database)


def get_clients() -> ClinicalClients:
    return ClinicalClients()


def get_identity_client() -> IdentityClient:
    return IdentityClient()


Repository = Annotated[ClinicalRepository, Depends(get_repository)]
Clients = Annotated[ClinicalClients, Depends(get_clients)]
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


@router.get("/catalog/diseases", response_model=list[DiseaseResponse])
async def diseases(repository: Repository) -> list[DiseaseResponse]:
    return [DiseaseResponse(MaBenh=row["code"], TenBenh=row["name"])
            for row in await repository.list_diseases()]


@router.get("/catalog/medicines", response_model=list[MedicineResponse])
async def medicines(repository: Repository) -> list[MedicineResponse]:
    return [MedicineResponse(MaThuoc=row["code"], TenThuoc=row["name"], DonViTinh=row["unit"])
            for row in await repository.list_medicines()]


@router.put("/catalog/diseases/{code}", response_model=CatalogItem)
async def put_disease(
    code: Annotated[str, Path(min_length=1, max_length=40)], body: DiseaseUpsert,
    repository: Repository, current: Account,
) -> CatalogItem:
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return CatalogItem.model_validate(await repository.upsert_disease(code, body.name.strip(), body.active))


@router.put("/catalog/medicines/{code}", response_model=CatalogItem)
async def put_medicine(
    code: Annotated[str, Path(min_length=1, max_length=40)], body: MedicineUpsert,
    repository: Repository, current: Account,
) -> CatalogItem:
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return CatalogItem.model_validate(await repository.upsert_medicine(
        code, body.name.strip(), body.unit.strip(), body.active,
    ))


def require_role(current: dict, role: str) -> str:
    if current.get("role") != role or not current.get("subject_id"):
        raise HTTPException(status_code=403, detail=f"{role.title()} profile required")
    return current["subject_id"]


@router.post("/encounters", response_model=EncounterResponse)
async def save_encounter(body: SaveEncounter, repository: Repository, clients: Clients,
                         current: Account, credentials: Credentials) -> EncounterResponse:
    doctor_code = require_role(current, "doctor")
    if len(set(body.lab_service_codes)) != len(body.lab_service_codes):
        raise HTTPException(status_code=422, detail="Duplicate laboratory service")
    if len({item.service_code for item in body.treatments}) != len(body.treatments):
        raise HTTPException(status_code=422, detail="Duplicate treatment service")
    if not await repository.validate_catalog(
        body.disease_code, [item.medicine_code for item in body.prescriptions],
    ):
        raise HTTPException(status_code=422, detail="Disease or medicine is not in the active catalogue")
    try:
        appointment = await clients.queued_appointment(credentials.credentials, body.appointment_id)
        queue_state = appointment.get("queue_state")
        if appointment.get("doctor_code") != doctor_code or queue_state not in ("examining", "conclusion", "completed"):
            raise ClinicalRejected("Doctor has not started this examination")
        existing = await repository.by_appointment(body.appointment_id)
        if existing and existing["status"] == "completed":
            submitted = body.model_dump(exclude={"appointment_id", "is_draft"})
            if body.is_draft or any(existing[key] != submitted[key] for key in submitted):
                raise EncounterConflict("Completed encounter is immutable")
            if queue_state == "examining":
                await clients.move_queue(credentials.credentials, body.appointment_id, "conclusion")
            if queue_state != "completed":
                await clients.move_queue(credentials.credentials, body.appointment_id, "completed")
            return EncounterResponse.model_validate(existing)
        if queue_state == "completed":
            raise ClinicalRejected("Queue is complete but the encounter is not")
        prices = await clients.laboratory_prices(body.lab_service_codes)
        values = body.model_dump(exclude={"appointment_id", "is_draft"})
        values["status"] = "draft" if body.is_draft or prices else "completed"
        row = await repository.upsert(appointment, doctor_code, values)
        orders = await clients.ensure_lab_orders(row, prices)
        if not body.is_draft and any(order.get("status") != "resulted" for order in orders):
            raise ClinicalRejected("Laboratory results are not complete")
        if not body.is_draft and row["status"] != "completed":
            row = await repository.upsert(appointment, doctor_code, {**values, "status": "completed"})
        if appointment["queue_state"] == "examining":
            await clients.move_queue(credentials.credentials, body.appointment_id, "conclusion")
        if not body.is_draft:
            await clients.move_queue(credentials.credentials, body.appointment_id, "completed")
    except ClinicalRejected as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ClinicalUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except EncounterConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return EncounterResponse.model_validate(row)


@router.get("/encounters/me", response_model=list[EncounterResponse])
async def my_encounters(repository: Repository, current: Account) -> list[EncounterResponse]:
    patient_id = require_role(current, "patient")
    return [EncounterResponse.model_validate(row) for row in await repository.list(patient_id=patient_id,
                                                                                     completed_only=True)]


@router.get("/encounters/doctor", response_model=list[EncounterResponse])
async def doctor_encounters(repository: Repository, current: Account) -> list[EncounterResponse]:
    doctor_code = require_role(current, "doctor")
    return [EncounterResponse.model_validate(row) for row in await repository.list(doctor_code=doctor_code)]


@router.get("/encounters/patient/{patient_id}", response_model=list[EncounterResponse])
async def doctor_patient_history(patient_id: str, repository: Repository,
                                 current: Account) -> list[EncounterResponse]:
    doctor_code = require_role(current, "doctor")
    return [EncounterResponse.model_validate(row) for row in await repository.list(
        patient_id=patient_id, doctor_code=doctor_code)]


@router.get("/encounters/{encounter_id}", response_model=EncounterResponse)
async def encounter_detail(encounter_id: str, repository: Repository, current: Account) -> EncounterResponse:
    row = await repository.get(encounter_id)
    if row is None or not (current.get("role") == "admin"
                           or current.get("role") == "patient" and row["patient_id"] == current.get("subject_id")
                           or current.get("role") == "doctor" and row["doctor_code"] == current.get("subject_id")):
        raise HTTPException(status_code=404, detail="Encounter not found")
    return EncounterResponse.model_validate(row)


@router.get("/treatments/me", response_model=list[TreatmentPlanResponse])
async def my_treatment_plans(repository: Repository, current: Account) -> list[TreatmentPlanResponse]:
    patient_id = require_role(current, "patient")
    return [TreatmentPlanResponse.model_validate(row) for row in await repository.list_plans(patient_id)]


@router.get("/treatments/{plan_id}/sessions", response_model=list[TreatmentSessionResponse])
async def treatment_sessions(plan_id: str, repository: Repository, current: Account) -> list[TreatmentSessionResponse]:
    patient_id = require_role(current, "patient")
    plan = await repository.get_plan(plan_id)
    if plan is None or plan["patient_id"] != patient_id:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    return [session_response(row) for row in await repository.list_sessions(plan_id)]


@router.post("/treatments/{plan_id}/sessions", response_model=TreatmentSessionResponse)
async def book_treatment_session(
    plan_id: str, body: SessionBookingRequest, repository: Repository, clients: Clients,
    current: Account, credentials: Credentials,
) -> TreatmentSessionResponse:
    patient_id = require_role(current, "patient")
    plan = await repository.get_plan(plan_id)
    if plan is None or plan["patient_id"] != patient_id:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if body.session_number > plan["total_sessions"]:
        raise HTTPException(status_code=409, detail="Session number exceeds the treatment plan")
    try:
        await clients.verify_treatment_config(body.config_code, plan["service_code"])
        reserved = await repository.reserve_session(plan, body.model_dump())
        if reserved["status"] == "booked":
            return session_response(await repository.get_session(reserved["id"]))
        try:
            appointment = await clients.book_treatment_appointment(credentials.credentials, plan,
                                                                   body.model_dump())
        except ClinicalRejected:
            # A definitive slot rejection cannot create an appointment. An uncertain
            # transport failure must retain the reservation for a same-key retry.
            await repository.release_rejected_session(reserved["id"], body.idempotency_key)
            raise
        invoice = await clients.treatment_invoice(credentials.credentials, appointment["id"])
        session = await repository.attach_session(reserved["id"], appointment["id"], invoice["id"])
    except ClinicalRejected as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ClinicalUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except EncounterConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return session_response(session)


@router.post("/treatments/sessions/{appointment_id}/complete", response_model=TreatmentSessionResponse)
async def complete_treatment_session(
    appointment_id: str, repository: Repository, clients: Clients,
    current: Account, credentials: Credentials,
) -> TreatmentSessionResponse:
    doctor_code = require_role(current, "doctor")
    session = await repository.session_by_appointment(appointment_id)
    if session is None or session["doctor_code"] != doctor_code:
        raise HTTPException(status_code=404, detail="Treatment session not found")
    if session["status"] == "completed":
        return session_response(session)
    try:
        appointment = await clients.queued_appointment(credentials.credentials, appointment_id)
        if appointment.get("doctor_code") != doctor_code or appointment.get("queue_state") not in ("examining", "conclusion"):
            raise ClinicalRejected("Treatment session is not being examined")
        if appointment["queue_state"] == "examining":
            await clients.move_queue(credentials.credentials, appointment_id, "conclusion")
        await clients.move_queue(credentials.credentials, appointment_id, "completed")
        completed = await repository.complete_session(appointment_id, doctor_code)
    except ClinicalRejected as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ClinicalUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except EncounterConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return session_response(completed)
