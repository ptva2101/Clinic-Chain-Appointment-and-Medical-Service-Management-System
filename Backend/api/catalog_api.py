from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from service.catalog_service import (
    get_bhyt_categories,
    get_branch_services,
    get_branches,
    get_diseases,
    get_doctors,
    get_doctor_schedules,
    get_medicines,
    get_services,
)


router = APIRouter()


class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    meta: Optional[Any] = None


@router.get("/branches", response_model=ResponseModel)
async def get_branches_api():
    return await get_branches()


@router.get("/services", response_model=ResponseModel)
async def get_services_api():
    return await get_services()


@router.get("/doctors", response_model=ResponseModel)
async def get_doctors_api():
    return await get_doctors()


@router.get("/branch-services", response_model=ResponseModel)
async def get_branch_services_api():
    return await get_branch_services()


@router.get("/diseases", response_model=ResponseModel)
async def get_diseases_api():
    return await get_diseases()


@router.get("/medicines", response_model=ResponseModel)
async def get_medicines_api():
    return await get_medicines()


@router.get("/bhyt", response_model=ResponseModel)
async def get_bhyt_categories_api():
    return await get_bhyt_categories()


@router.get("/doctor-schedules", response_model=ResponseModel)
async def get_doctor_schedules_api(
    from_date: Optional[str] = Query(None, description="Ngày bắt đầu YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="Ngày kết thúc YYYY-MM-DD"),
):
    return await get_doctor_schedules(from_date=from_date, to_date=to_date)
