"""Admin-only read API for imported demo history owned by each service."""

import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken


bearer = HTTPBearer(auto_error=False)


class HistoryRecord(BaseModel):
    source: str
    entity: str
    legacy_key: str
    payload: dict | list | str | int | float | None


class HistoryPage(BaseModel):
    items: list[HistoryRecord]
    total: int
    limit: int
    offset: int


def get_identity_client(request: Request) -> IdentityClient:
    return request.app.state.identity_client


async def require_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    identity: Annotated[IdentityClient, Depends(get_identity_client)],
) -> None:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        account = await identity.current_account(credentials.credentials)
    except InvalidIdentityToken as exc:
        raise HTTPException(status_code=401, detail="Invalid access token") from exc
    except IdentityUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not account.get("is_active") or account.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


def history_router(service: str) -> APIRouter:
    router = APIRouter(prefix=f"/api/v1/{service}/history", tags=["Imported history"])

    @router.get("", response_model=HistoryPage, dependencies=[Depends(require_admin)])
    async def list_history(
        request: Request,
        entity: Annotated[str | None, Query(max_length=96)] = None,
        source: Annotated[str | None, Query(max_length=40)] = None,
        limit: Annotated[int, Query(ge=1, le=500)] = 100,
        offset: Annotated[int, Query(ge=0)] = 0,
    ) -> HistoryPage:
        pool = await request.app.state.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = DATABASE() AND table_name = 'historical_records'"
                )
                if await cursor.fetchone() is None:
                    await connection.rollback()
                    return HistoryPage(items=[], total=0, limit=limit, offset=offset)
                conditions = []
                params = []
                if entity is not None:
                    conditions.append("entity = %s")
                    params.append(entity)
                if source is not None:
                    conditions.append("source = %s")
                    params.append(source)
                where = " WHERE " + " AND ".join(conditions) if conditions else ""
                await cursor.execute("SELECT COUNT(*) AS total FROM historical_records" + where,
                                     tuple(params))
                total = int((await cursor.fetchone())["total"])
                await cursor.execute(
                    "SELECT source, entity, legacy_key, payload FROM historical_records" + where
                    + " ORDER BY entity, legacy_key LIMIT %s OFFSET %s",
                    (*params, limit, offset),
                )
                rows = await cursor.fetchall()
                await connection.rollback()
        return HistoryPage(
            items=[HistoryRecord(
                source=row["source"], entity=row["entity"], legacy_key=row["legacy_key"],
                payload=json.loads(row["payload"]) if isinstance(row["payload"], str)
                else row["payload"],
            ) for row in rows],
            total=total, limit=limit, offset=offset,
        )

    return router
