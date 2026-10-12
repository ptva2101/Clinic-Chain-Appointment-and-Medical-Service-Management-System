"""A small MySQL pool owned by one service process."""

import asyncio
import os

import aiomysql


class MySQLDatabase:
    def __init__(self) -> None:
        self._pool: aiomysql.Pool | None = None
        self._lock = asyncio.Lock()

    async def pool(self) -> aiomysql.Pool:
        if self._pool is None:
            async with self._lock:
                if self._pool is None:
                    self._pool = await aiomysql.create_pool(
                        host=os.environ["DB_HOST"],
                        port=int(os.getenv("DB_PORT", "3306")),
                        db=os.environ["DB_NAME"],
                        user=os.environ["DB_USER"],
                        password=os.environ["DB_PASSWORD"],
                        charset="utf8mb4",
                        autocommit=False,
                        minsize=1,
                        maxsize=5,
                        connect_timeout=5,
                        cursorclass=aiomysql.DictCursor,
                    )
        return self._pool

    async def ping(self) -> None:
        pool = await self.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute("SELECT 1")
                await cursor.fetchone()

    async def close(self) -> None:
        if self._pool is not None:
            self._pool.close()
            await self._pool.wait_closed()
            self._pool = None
