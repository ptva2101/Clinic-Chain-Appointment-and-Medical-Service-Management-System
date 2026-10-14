"""Registry-owned branch and medical-service catalogue. No demo rows are seeded."""

from typing import Annotated, Literal

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from common.database import MySQLDatabase
from registry.api import current_admin_account


router = APIRouter(prefix="/api/v1/registry/catalog", tags=["Registry catalogue"])
Admin = Annotated[dict, Depends(current_admin_account)]


class Branch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    MaChiNhanh: str = Field(min_length=2, max_length=32, pattern=r"^[A-Z0-9_-]+$")
    TenChiNhanh: str = Field(min_length=1, max_length=160)
    DiaChi: str = Field(min_length=1, max_length=255)
    SDT: str | None = Field(default=None, max_length=20)

    @field_validator("TenChiNhanh", "DiaChi")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class MedicalService(BaseModel):
    model_config = ConfigDict(extra="forbid")
    MaDichVu: str = Field(min_length=2, max_length=40, pattern=r"^[A-Z0-9_-]+$")
    TenDichVu: str = Field(min_length=1, max_length=200)
    ChuyenKhoa: str = Field(min_length=1, max_length=160)
    LoaiDichVu: Literal["Khám lâm sàng", "Xét nghiệm", "Điều trị"]
    GiaGoc: int = Field(ge=0)

    @field_validator("TenDichVu", "ChuyenKhoa")
    @classmethod
    def nonblank_text(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class PriceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    GiaGoc: int = Field(ge=0)


class BranchService(BaseModel):
    model_config = ConfigDict(extra="forbid")
    MaCauHinh: str = Field(min_length=2, max_length=96, pattern=r"^[A-Z0-9_-]+$")
    MaChiNhanh: str = Field(min_length=2, max_length=32)
    MaDichVu: str = Field(min_length=2, max_length=40)
    SlotGioiHan: int = Field(ge=0)
    TrangThai: Literal["active", "inactive"] = "active"


class BranchServiceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    SlotGioiHan: int | None = Field(default=None, ge=0)
    TrangThai: Literal["active", "inactive"] | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Updated fields cannot be null")
        return self


class CatalogRepository:
    def __init__(self, database: MySQLDatabase) -> None:
        self.database = database

    async def all(self, sql: str) -> list[dict]:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql)
                rows = await cursor.fetchall()
                await connection.rollback()
                return rows

    async def one(self, sql: str, params: tuple) -> dict | None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            async with connection.cursor() as cursor:
                await cursor.execute(sql, params)
                row = await cursor.fetchone()
                await connection.rollback()
                return row

    async def write(self, sql: str, params: tuple) -> int:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(sql, params)
                    changed = cursor.rowcount
                await connection.commit()
                return changed
            except Exception:
                await connection.rollback()
                raise

    async def put_branch_service(self, value: BranchService) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(
                        "SELECT branch_code, service_code FROM branch_services WHERE code = %s FOR UPDATE",
                        (value.MaCauHinh,),
                    )
                    existing = await cursor.fetchone()
                    if existing:
                        if (existing["branch_code"] != value.MaChiNhanh
                                or existing["service_code"] != value.MaDichVu):
                            raise ValueError("Configuration code belongs to another branch/service")
                        await cursor.execute(
                            "UPDATE branch_services SET slot_limit = %s, active = %s WHERE code = %s",
                            (value.SlotGioiHan, value.TrangThai == "active", value.MaCauHinh),
                        )
                    else:
                        await cursor.execute(
                            "INSERT INTO branch_services (code, branch_code, service_code, slot_limit, active) "
                            "VALUES (%s, %s, %s, %s, %s)",
                            (value.MaCauHinh, value.MaChiNhanh, value.MaDichVu,
                             value.SlotGioiHan, value.TrangThai == "active"),
                        )
                await connection.commit()
            except Exception:
                await connection.rollback()
                raise


def get_catalog_repository(request: Request) -> CatalogRepository:
    return CatalogRepository(request.app.state.database)


Repository = Annotated[CatalogRepository, Depends(get_catalog_repository)]


@router.get("/branches", response_model=list[Branch])
async def list_branches(repository: Repository) -> list[Branch]:
    rows = await repository.all(
        "SELECT code AS MaChiNhanh, name AS TenChiNhanh, address AS DiaChi, phone AS SDT "
        "FROM branches ORDER BY name, code"
    )
    return [Branch.model_validate(row) for row in rows]


@router.post("/branches", response_model=Branch, status_code=status.HTTP_201_CREATED)
async def create_branch(body: Branch, repository: Repository, _admin: Admin) -> Branch:
    try:
        await repository.write(
            "INSERT INTO branches (code, name, address, phone) VALUES (%s, %s, %s, %s)",
            (body.MaChiNhanh, body.TenChiNhanh, body.DiaChi, body.SDT),
        )
    except aiomysql.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Branch code already exists") from exc
    return body


@router.get("/services", response_model=list[MedicalService])
async def list_services(repository: Repository) -> list[MedicalService]:
    rows = await repository.all(
        "SELECT code AS MaDichVu, name AS TenDichVu, specialty AS ChuyenKhoa, "
        "kind AS LoaiDichVu, price AS GiaGoc FROM medical_services ORDER BY name, code"
    )
    return [MedicalService.model_validate(row) for row in rows]


@router.post("/services", response_model=MedicalService, status_code=status.HTTP_201_CREATED)
async def create_service(body: MedicalService, repository: Repository, _admin: Admin) -> MedicalService:
    try:
        await repository.write(
            "INSERT INTO medical_services (code, name, specialty, kind, price) VALUES (%s, %s, %s, %s, %s)",
            (body.MaDichVu, body.TenDichVu, body.ChuyenKhoa, body.LoaiDichVu, body.GiaGoc),
        )
    except aiomysql.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Service code already exists") from exc
    return body


@router.patch("/services/{code}/price", response_model=MedicalService)
async def update_service_price(code: str, body: PriceUpdate, repository: Repository,
                               _admin: Admin) -> MedicalService:
    select = (
        "SELECT code AS MaDichVu, name AS TenDichVu, specialty AS ChuyenKhoa, "
        "kind AS LoaiDichVu, price AS GiaGoc FROM medical_services WHERE code = %s"
    )
    row = await repository.one(select, (code,))
    if row is None:
        raise HTTPException(status_code=404, detail="Service not found")
    await repository.write(
        "UPDATE medical_services SET price = %s WHERE code = %s", (body.GiaGoc, code)
    )
    row = await repository.one(select, (code,))
    return MedicalService.model_validate(row)


@router.get("/branch-services", response_model=list[BranchService])
async def list_branch_services(repository: Repository) -> list[BranchService]:
    rows = await repository.all(
        "SELECT code AS MaCauHinh, branch_code AS MaChiNhanh, service_code AS MaDichVu, "
        "slot_limit AS SlotGioiHan, IF(active, 'active', 'inactive') AS TrangThai "
        "FROM branch_services ORDER BY branch_code, service_code"
    )
    return [BranchService.model_validate(row) for row in rows]


@router.get("/branch-services/{code}", response_model=BranchService)
async def get_branch_service(code: str, repository: Repository) -> BranchService:
    row = await repository.one(
        "SELECT code AS MaCauHinh, branch_code AS MaChiNhanh, service_code AS MaDichVu, "
        "slot_limit AS SlotGioiHan, IF(active, 'active', 'inactive') AS TrangThai "
        "FROM branch_services WHERE code = %s", (code,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Branch/service configuration not found")
    return BranchService.model_validate(row)


@router.put("/branch-services/{code}", response_model=BranchService)
async def put_branch_service(code: str, body: BranchService, repository: Repository,
                             _admin: Admin) -> BranchService:
    if code != body.MaCauHinh:
        raise HTTPException(status_code=422, detail="Configuration code mismatch")
    try:
        await repository.put_branch_service(body)
    except (aiomysql.IntegrityError, ValueError) as exc:
        raise HTTPException(status_code=409, detail="Invalid or duplicate branch/service configuration") from exc
    return body


@router.patch("/branch-services/{code}", response_model=BranchService)
async def update_branch_service(code: str, body: BranchServiceUpdate, repository: Repository,
                                _admin: Admin) -> BranchService:
    current = await repository.one(
        "SELECT code AS MaCauHinh, branch_code AS MaChiNhanh, service_code AS MaDichVu, "
        "slot_limit AS SlotGioiHan, IF(active, 'active', 'inactive') AS TrangThai "
        "FROM branch_services WHERE code = %s", (code,),
    )
    if current is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
    updated = BranchService.model_validate({**current, **body.model_dump(exclude_unset=True)})
    await repository.put_branch_service(updated)
    return updated
