from fastapi import APIRouter, Form, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Any
from service.patient_service import *

router = APIRouter()

class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class BookAndPayRequest(BaseModel):
    ma_benh_an: str
    ma_cau_hinh: str
    ngay_kham: str
    ca_kham: int
    ma_bac_si: str


class BookTreatmentRequest(BaseModel):
    ma_lich_trinh: str
    ma_benh_an: str
    ma_cau_hinh: str
    ngay_thuc_hien: str
    ca_kham: int
    ma_bac_si: str


@router.post("/register-account", response_model=ResponseModel)
async def register_account_api(request: Request):
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        body = await request.json()
    else:
        form = await request.form()
        body = dict(form)

    cccd = str(body.get("cccd", "")).strip()
    if not cccd.isdigit() or len(cccd) != 12:
        raise HTTPException(status_code=400, detail="Số CCCD không hợp lệ")

    return await register_account({
        "hoten": body.get("hoten"),
        "cccd": cccd,
        "ngaysinh": body.get("ngaysinh"),
        "gioitinh": body.get("gioitinh"),
        "sdt": body.get("sdt"),
        "matkhau": body.get("matkhau"),
        "diachi": body.get("diachi"),
        "ma_so_bhyt": body.get("ma_so_bhyt"),
        "ky_tu_bhyt": body.get("ky_tu_bhyt"),
    })


@router.post("/search-available-slots", response_model=ResponseModel)
async def search_available_slots_api(
    ma_chi_nhanh: str = Form(...),
    chuyen_khoa: str = Form(...),
    ngay_kham: str = Form(...)
):
    return await search_available_slots(ma_chi_nhanh, chuyen_khoa, ngay_kham)


@router.post("/book-and-pay", response_model=ResponseModel)
async def book_and_pay_api(request: BookAndPayRequest):
    return await book_and_pay(
        request.ma_benh_an,
        request.ma_cau_hinh,
        request.ngay_kham,
        request.ca_kham,
        request.ma_bac_si,
    )


@router.get("/appointments", response_model=ResponseModel)
async def get_patient_appointments_api(ma_benh_an: str):
    return await get_patient_appointments(ma_benh_an)


@router.post("/book-treatment", response_model=ResponseModel)
async def book_treatment_api(request: BookTreatmentRequest):
    return await book_treatment(
        request.ma_lich_trinh,
        request.ma_benh_an,
        request.ma_cau_hinh,
        request.ngay_thuc_hien,
        request.ca_kham,
        request.ma_bac_si,
    )

@router.get("/medical-history", response_model=ResponseModel)
async def get_medical_history_api(ma_benh_an: str):
    return await get_medical_history(ma_benh_an)

@router.get("/notifications", response_model=ResponseModel)
async def get_notifications_api(ma_benh_an: str):
    return await receive_notification(ma_benh_an)


@router.post("/notifications/mark-read", response_model=ResponseModel)
async def mark_notifications_read_api(ma_benh_an: str = Form(...)):
    return await mark_notifications_read(ma_benh_an)
