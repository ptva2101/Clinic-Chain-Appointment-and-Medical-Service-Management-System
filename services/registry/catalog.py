"""Registry-owned branch and medical-service catalogue. No demo rows are seeded."""

from typing import Annotated, Literal

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from common.database import MySQLDatabase
from registry.api import current_admin_account, get_identity_client
from registry.identity_client import IdentityClient, IdentityUnavailable


router = APIRouter(prefix="/api/v1/registry/catalog", tags=["Registry catalogue"])
Admin = Annotated[dict, Depends(current_admin_account)]
Identity = Annotated[IdentityClient, Depends(get_identity_client)]


class Branch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    MaChiNhanh: str = Field(min_length=2, max_length=32, pattern=r"^[A-Z0-9_-]+$")
    TenChiNhanh: str = Field(min_length=1, max_length=160)
    DiaChi: str = Field(min_length=1, max_length=255)
    SDT: str | None = Field(default=None, max_length=20)
    TrangThai: Literal["active", "inactive"] = "active"

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
    TrangThai: Literal["active", "inactive"] = "active"

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


class CatalogStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    TrangThai: Literal["active", "inactive"]


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


class Doctor(BaseModel):
    MaBacSi: str
    HoTen: str
    ChuyenKhoa: str | None
    SDT: str | None
    TrangThai: Literal["active"] = "active"


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

    async def set_catalog_status(self, kind: Literal["branch", "service"],
                                 code: str, active: bool) -> bool:
        table, child_column = (
            ("branches", "branch_code") if kind == "branch"
            else ("medical_services", "service_code")
        )
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    await cursor.execute(f"SELECT code FROM {table} WHERE code = %s FOR UPDATE", (code,))
                    if await cursor.fetchone() is None:
                        await connection.rollback()
                        return False
                    await cursor.execute(
                        f"UPDATE {table} SET active = %s WHERE code = %s", (active, code)
                    )
                    if not active:
                        await cursor.execute(
                            f"UPDATE branch_services SET active = FALSE WHERE {child_column} = %s",
                            (code,),
                        )
                await connection.commit()
                return True
            except Exception:
                await connection.rollback()
                raise

    async def put_branch_service(self, value: BranchService) -> None:
        pool = await self.database.pool()
        async with pool.acquire() as connection:
            try:
                async with connection.cursor() as cursor:
                    if value.TrangThai == "active":
                        await cursor.execute(
                            "SELECT b.active AS branch_active, s.active AS service_active "
                            "FROM branches b JOIN medical_services s ON s.code = %s "
                            "WHERE b.code = %s", (value.MaDichVu, value.MaChiNhanh),
                        )
                        parents = await cursor.fetchone()
                        if not parents or not parents["branch_active"] or not parents["service_active"]:
                            raise ValueError("Branch and service must be active")
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


@router.get("/doctors", response_model=list[Doctor])
async def list_doctors(repository: Repository, identity: Identity) -> list[Doctor]:
    rows = await repository.all(
        "SELECT staff_code AS MaBacSi, full_name AS HoTen, specialty AS ChuyenKhoa, "
        "phone AS SDT FROM staff_profiles WHERE role = 'doctor' "
        "AND identity_account_id IS NOT NULL ORDER BY full_name, staff_code"
    )
    try:
        active = await identity.active_staff_codes("doctor", [row["MaBacSi"] for row in rows])
    except IdentityUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [Doctor.model_validate(row) for row in rows if row["MaBacSi"] in active]


@router.get("/doctors/{code}", response_model=Doctor)
async def get_doctor(code: str, repository: Repository, identity: Identity) -> Doctor:
    row = await repository.one(
        "SELECT staff_code AS MaBacSi, full_name AS HoTen, specialty AS ChuyenKhoa, "
        "phone AS SDT FROM staff_profiles WHERE role = 'doctor' "
        "AND identity_account_id IS NOT NULL AND staff_code = %s", (code,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Active doctor not found")
    try:
        active = await identity.active_staff_codes("doctor", [code])
    except IdentityUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if code not in active:
        raise HTTPException(status_code=404, detail="Active doctor not found")
    return Doctor.model_validate(row)


@router.get("/branches", response_model=list[Branch])
async def list_branches(repository: Repository) -> list[Branch]:
    rows = await repository.all(
        "SELECT code AS MaChiNhanh, name AS TenChiNhanh, address AS DiaChi, phone AS SDT, "
        "IF(active, 'active', 'inactive') AS TrangThai "
        "FROM branches ORDER BY name, code"
    )
    return [Branch.model_validate(row) for row in rows]


@router.post("/branches", response_model=Branch, status_code=status.HTTP_201_CREATED)
async def create_branch(body: Branch, repository: Repository, _admin: Admin) -> Branch:
    try:
        await repository.write(
            "INSERT INTO branches (code, name, address, phone, active) VALUES (%s, %s, %s, %s, %s)",
            (body.MaChiNhanh, body.TenChiNhanh, body.DiaChi, body.SDT, body.TrangThai == "active"),
        )
    except aiomysql.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Branch code already exists") from exc
    return body


@router.patch("/branches/{code}/status", response_model=Branch)
async def update_branch_status(code: str, body: CatalogStatusUpdate, repository: Repository,
                               _admin: Admin) -> Branch:
    if not await repository.set_catalog_status("branch", code, body.TrangThai == "active"):
        raise HTTPException(status_code=404, detail="Branch not found")
    row = await repository.one(
        "SELECT code AS MaChiNhanh, name AS TenChiNhanh, address AS DiaChi, phone AS SDT, "
        "IF(active, 'active', 'inactive') AS TrangThai FROM branches WHERE code = %s", (code,),
    )
    return Branch.model_validate(row)


@router.delete("/branches/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_branch(code: str, repository: Repository, _admin: Admin) -> None:
    if not await repository.set_catalog_status("branch", code, False):
        raise HTTPException(status_code=404, detail="Branch not found")


@router.get("/services", response_model=list[MedicalService])
async def list_services(repository: Repository) -> list[MedicalService]:
    rows = await repository.all(
        "SELECT code AS MaDichVu, name AS TenDichVu, specialty AS ChuyenKhoa, "
        "kind AS LoaiDichVu, price AS GiaGoc, "
        "IF(active, 'active', 'inactive') AS TrangThai FROM medical_services ORDER BY name, code"
    )
    return [MedicalService.model_validate(row) for row in rows]


@router.post("/services", response_model=MedicalService, status_code=status.HTTP_201_CREATED)
async def create_service(body: MedicalService, repository: Repository, _admin: Admin) -> MedicalService:
    try:
        await repository.write(
            "INSERT INTO medical_services (code, name, specialty, kind, price, active) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (body.MaDichVu, body.TenDichVu, body.ChuyenKhoa, body.LoaiDichVu,
             body.GiaGoc, body.TrangThai == "active"),
        )
    except aiomysql.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Service code already exists") from exc
    return body


@router.patch("/services/{code}/status", response_model=MedicalService)
async def update_service_status(code: str, body: CatalogStatusUpdate, repository: Repository,
                                _admin: Admin) -> MedicalService:
    if not await repository.set_catalog_status("service", code, body.TrangThai == "active"):
        raise HTTPException(status_code=404, detail="Service not found")
    row = await repository.one(
        "SELECT code AS MaDichVu, name AS TenDichVu, specialty AS ChuyenKhoa, "
        "kind AS LoaiDichVu, price AS GiaGoc, "
        "IF(active, 'active', 'inactive') AS TrangThai FROM medical_services WHERE code = %s",
        (code,),
    )
    return MedicalService.model_validate(row)


@router.delete("/services/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_service(code: str, repository: Repository, _admin: Admin) -> None:
    if not await repository.set_catalog_status("service", code, False):
        raise HTTPException(status_code=404, detail="Service not found")


@router.patch("/services/{code}/price", response_model=MedicalService)
async def update_service_price(code: str, body: PriceUpdate, repository: Repository,
                               _admin: Admin) -> MedicalService:
    select = (
        "SELECT code AS MaDichVu, name AS TenDichVu, specialty AS ChuyenKhoa, "
        "kind AS LoaiDichVu, price AS GiaGoc, "
        "IF(active, 'active', 'inactive') AS TrangThai FROM medical_services WHERE code = %s"
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
    try:
        await repository.put_branch_service(updated)
    except (aiomysql.IntegrityError, ValueError) as exc:
        raise HTTPException(status_code=409, detail="Invalid branch/service configuration") from exc
    return updated


@router.delete("/branch-services/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_branch_service(code: str, repository: Repository, _admin: Admin) -> None:
    changed = await repository.write(
        "UPDATE branch_services SET active = FALSE WHERE code = %s", (code,)
    )
    if not changed and await repository.one(
        "SELECT code FROM branch_services WHERE code = %s", (code,)
    ) is None:
        raise HTTPException(status_code=404, detail="Configuration not found")
