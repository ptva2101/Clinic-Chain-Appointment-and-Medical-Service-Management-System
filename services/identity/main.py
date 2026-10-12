import os

from fastapi.middleware.cors import CORSMiddleware

from common.app import create_app
from identity.api import router

app = create_app(
    "identity",
    "Authentication, account credentials, access tokens, and role assignments.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "IDENTITY_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def prevent_token_caching(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/v1/identity/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(router)
