import os

from fastapi.middleware.cors import CORSMiddleware

from common.app import create_app
from common.history import history_router
from scheduling.api import router
from scheduling.slots import router as slot_router

app = create_app(
    "scheduling",
    "Doctor schedules, available appointment slots, and temporary slot holds.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "SCHEDULING_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Service-Token"],
)
app.include_router(router)
app.include_router(slot_router)
app.include_router(history_router("scheduling"))
