import os

from fastapi.middleware.cors import CORSMiddleware

from billing.api import router
from billing.change_api import router as change_router
from common.app import create_app
from common.history import history_router

app = create_app(
    "billing",
    "Price/insurance snapshots, simulated payments, and reserved refund/cancellation orchestration.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "BILLING_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)
app.include_router(change_router)
app.include_router(history_router("billing"))
