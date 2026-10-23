"""Standard operational endpoints for each independent FastAPI app."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from common.database import MySQLDatabase
from common.identity_client import IdentityClient


class HealthResponse(BaseModel):
    service: str
    status: str


def create_app(name: str, summary: str) -> FastAPI:
    database = MySQLDatabase()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.identity_client = IdentityClient()
        try:
            yield
        finally:
            await app.state.identity_client.close()
            await database.close()

    app = FastAPI(
        title=f"Medicare {name.title()} Service",
        description=summary,
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.database = database

    @app.get("/health", response_model=HealthResponse, tags=["Operations"])
    async def health() -> HealthResponse:
        return HealthResponse(service=name, status="ok")

    @app.get("/ready", response_model=HealthResponse, tags=["Operations"])
    async def ready() -> HealthResponse:
        try:
            await app.state.database.ping()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Database unavailable") from exc
        return HealthResponse(service=name, status="ready")

    return app
