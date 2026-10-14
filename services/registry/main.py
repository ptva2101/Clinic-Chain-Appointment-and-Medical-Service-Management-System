import os

from fastapi.middleware.cors import CORSMiddleware

from common.app import create_app
from common.history import history_router
from registry.api import router
from registry.catalog import router as catalog_router

app = create_app(
    "registry",
    "Patient and staff profiles plus branch and medical-service catalogue.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "REGISTRY_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def prevent_patient_profile_caching(request, call_next):
    response = await call_next(request)
    if (request.url.path in ("/api/v1/registry/patients", "/api/v1/registry/staff")
            or request.url.path.startswith(("/api/v1/registry/patients/", "/api/v1/registry/staff/"))):
        response.headers["Cache-Control"] = "no-store"
    return response


app.include_router(router)
app.include_router(catalog_router)
app.include_router(history_router("registry"))
