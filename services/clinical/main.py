import os

from fastapi.middleware.cors import CORSMiddleware

from common.app import create_app
from common.history import history_router
from clinical.api import router

app = create_app(
    "clinical",
    "Encounters, diagnoses, prescriptions, and treatment orders.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CLINICAL_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(history_router("clinical"))
app.include_router(router)
