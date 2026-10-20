import os

from fastapi.middleware.cors import CORSMiddleware

from appointment.api import router
from appointment.workflow_api import router as workflow_router
from common.app import create_app
from common.history import history_router

app = create_app(
    "appointment",
    "Appointments, check-in, waiting queues, and booking orchestration.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "APPOINTMENT_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)
app.include_router(workflow_router)
app.include_router(history_router("appointment"))
