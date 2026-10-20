"""Reception check-in and doctor queue backed by Appointment-owned state."""

from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict

from appointment.api import Account, bearer
from appointment.queue_repository import QueueConflict, QueueNotFound, QueueRepository
from appointment.workflow_clients import WorkflowClients, WorkflowRejected, WorkflowUnavailable


router = APIRouter(prefix="/api/v1/appointments", tags=["Check-in and queues"])


class QueueResponse(BaseModel):
    id: str
    patient_id: str
    config_code: str
    branch_code: str
    service_code: str
    doctor_code: str
    date: date
    shift: int
    appointment_status: str
    queue_number: int | None
    receptionist_code: str | None
    queue_state: str | None
    checked_in_at: datetime | None
    patient_name: str | None = None
    patient_cccd: str | None = None
    patient_phone: str | None = None
    patient_date_of_birth: date | None = None


class QueueStateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["examining", "conclusion", "completed"]


def response(row: dict) -> QueueResponse:
    return QueueResponse(
        id=row["id"], patient_id=row["patient_id"], config_code=row["config_code"],
        branch_code=row["branch_code"], service_code=row["service_code"],
        doctor_code=row["doctor_code"], date=row["duty_date"], shift=row["shift"],
        appointment_status=row["status"], queue_number=row["queue_number"],
        receptionist_code=row["receptionist_code"], queue_state=row["queue_state"],
        checked_in_at=row["checked_in_at"],
        patient_name=row.get("patient_name"), patient_cccd=row.get("patient_cccd"),
        patient_phone=row.get("patient_phone"),
        patient_date_of_birth=row.get("patient_date_of_birth"),
    )


async def enriched_rows(rows: list[dict], clients: "WorkflowClients") -> list[dict]:
    try:
        profiles = await clients.patient_profiles([row["patient_id"] for row in rows])
    except WorkflowUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    result = []
    for row in rows:
        patient = profiles.get(row["patient_id"], {})
        result.append({**row, "patient_name": patient.get("full_name"),
                       "patient_cccd": patient.get("cccd"),
                       "patient_phone": patient.get("phone"),
                       "patient_date_of_birth": patient.get("date_of_birth")})
    return result


def today_vietnam() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=7)).date()


def get_queue_repository(request: Request) -> QueueRepository:
    return QueueRepository(request.app.state.database)


def get_workflow_clients() -> WorkflowClients:
    return WorkflowClients()


Queue = Annotated[QueueRepository, Depends(get_queue_repository)]
Clients = Annotated[WorkflowClients, Depends(get_workflow_clients)]
Credentials = Annotated[HTTPAuthorizationCredentials, Depends(bearer)]


async def receptionist_branch(account: Account, credentials: Credentials, clients: Clients) -> str:
    if account.get("role") != "letan" or not account.get("subject_id"):
        raise HTTPException(status_code=403, detail="Receptionist role required")
    try:
        profile = await clients.receptionist_profile(credentials.credentials)
    except WorkflowRejected as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except WorkflowUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if profile.get("staff_code") != account["subject_id"]:
        raise HTTPException(status_code=403, detail="Receptionist profile mismatch")
    return profile["branch_code"]


Branch = Annotated[str, Depends(receptionist_branch)]


@router.get("/reception/appointments", response_model=list[QueueResponse])
async def reception_appointments(
    queue: Queue, clients: Clients, branch: Branch,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
) -> list[QueueResponse]:
    rows = await queue.list(branch_code=branch, duty_date=date_filter or today_vietnam(), checked_in=False)
    return [response(row) for row in await enriched_rows(rows, clients)]


@router.get("/reception/search", response_model=list[QueueResponse])
async def reception_search(
    queue: Queue, clients: Clients, branch: Branch,
    keyword: Annotated[str, Query(min_length=1, max_length=128)],
    date_filter: Annotated[date | None, Query(alias="date")] = None,
) -> list[QueueResponse]:
    rows = await enriched_rows(
        await queue.list(branch_code=branch, duty_date=date_filter or today_vietnam()), clients,
    )
    term = keyword.strip().casefold()
    return [response(row) for row in rows if any(
        term in str(row.get(field) or "").casefold()
        for field in ("id", "patient_id", "patient_name", "patient_cccd", "patient_phone")
    )]


@router.get("/reception/waiting-list/{doctor_code}", response_model=list[QueueResponse])
async def reception_waiting_list(
    doctor_code: str, queue: Queue, clients: Clients, branch: Branch,
    date_filter: Annotated[date | None, Query(alias="date")] = None,
) -> list[QueueResponse]:
    rows = await queue.list(branch_code=branch, doctor_code=doctor_code,
                            duty_date=date_filter or today_vietnam(), checked_in=True)
    return [response(row) for row in await enriched_rows(
        [row for row in rows if row["queue_state"] != "completed"], clients,
    )]


@router.post("/{appointment_id}/check-in", response_model=QueueResponse)
async def check_in(
    appointment_id: str, queue: Queue, clients: Clients, account: Account, branch: Branch,
) -> QueueResponse:
    current = await queue.get(appointment_id)
    if current is None or current["branch_code"] != branch:
        raise HTTPException(status_code=404, detail="Appointment not found in this branch")
    if current["queue_number"] is not None:
        raise HTTPException(status_code=409, detail="Appointment has already been checked in")
    try:
        await clients.require_paid(appointment_id)
        row = await queue.check_in(appointment_id, account["subject_id"], branch, today_vietnam())
    except WorkflowRejected as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except WorkflowUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except QueueNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except QueueConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response((await enriched_rows([row], clients))[0])


@router.get("/doctor/queue", response_model=list[QueueResponse])
async def doctor_queue(queue: Queue, clients: Clients, account: Account) -> list[QueueResponse]:
    if account.get("role") != "doctor" or not account.get("subject_id"):
        raise HTTPException(status_code=403, detail="Doctor role required")
    rows = await queue.list(doctor_code=account["subject_id"], duty_date=today_vietnam(), checked_in=True)
    return [response(row) for row in await enriched_rows(
        [row for row in rows if row["queue_state"] != "completed"], clients,
    )]


@router.get("/doctor/queue/{appointment_id}", response_model=QueueResponse)
async def doctor_queue_detail(appointment_id: str, queue: Queue, account: Account) -> QueueResponse:
    if account.get("role") != "doctor" or not account.get("subject_id"):
        raise HTTPException(status_code=403, detail="Doctor role required")
    row = await queue.get(appointment_id)
    if row is None or row["doctor_code"] != account["subject_id"] or row["queue_state"] is None:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    return response(row)


@router.post("/{appointment_id}/queue-state", response_model=QueueResponse)
async def update_queue_state(
    appointment_id: str, body: QueueStateRequest, queue: Queue, clients: Clients, account: Account,
) -> QueueResponse:
    if account.get("role") != "doctor" or not account.get("subject_id"):
        raise HTTPException(status_code=403, detail="Doctor role required")
    expected = {"examining": ("waiting", "conclusion"), "conclusion": ("examining",),
                "completed": ("conclusion",)}[body.state]
    try:
        row = await queue.move_state(appointment_id, account["subject_id"], expected, body.state)
    except QueueNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except QueueConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return response((await enriched_rows([row], clients))[0])
