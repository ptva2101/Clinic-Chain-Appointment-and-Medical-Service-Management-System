from fastapi import APIRouter, HTTPException , Form, Query
from pydantic import BaseModel
from typing import Optional, Any, List
from service.auth_service import *
from service.admin_service import *

router = APIRouter()
class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


class CancelDoctorScheduleRequest(BaseModel):
    id: Optional[int] = None
    MaLichTruc: Optional[str] = None


class TransferDoctorScheduleRequest(BaseModel):
    id: Optional[int] = None
    MaLichTruc: Optional[str] = None
    newMaBacSi: str


class ServicePriceRequest(BaseModel):
    GiaGoc: int


class BranchServiceRequest(BaseModel):
    MaChiNhanh: str
    MaDichVu: str
    SlotGioiHan: int


class BranchServiceSlotRequest(BaseModel):
    SlotGioiHan: int


class BranchServiceStatusRequest(BaseModel):
    TrangThai: str


class StaffCreateRequest(BaseModel):
    HoTen: str
    VaiTro: str
    ChuyenKhoa: Optional[str] = None
    SDT: str
    MatKhau: str
    MaChiNhanh: Optional[str] = None


class StaffStatusRequest(BaseModel):
    TrangThai: str


@router.get("/staff", response_model=ResponseModel)
async def get_admin_staff_api():
    return await get_admin_staff()


@router.get("/patients", response_model=ResponseModel)
async def get_admin_patients_api():
    return await get_admin_patients()


@router.post("/staff", response_model=ResponseModel)
async def create_staff_account_api(request: StaffCreateRequest):
    return await create_staff_account(
        ho_ten=request.HoTen,
        vai_tro=request.VaiTro,
        chuyen_khoa=request.ChuyenKhoa or "",
        sdt=request.SDT,
        mat_khau=request.MatKhau,
        ma_chi_nhanh=request.MaChiNhanh,
    )


@router.put("/staff/{ma_nhan_su}/status", response_model=ResponseModel)
async def update_staff_status_api(ma_nhan_su: str, request: StaffStatusRequest):
    return await update_staff_status(ma_nhan_su, request.TrangThai)


@router.post(
    "/branches/create",
    response_model=ResponseModel
)
async def create_branch_api(
    ma_chi_nhanh: Optional[str] = Form(None),
    ten_chi_nhanh: str = Form(...),
    dia_chi: str = Form(...),
    sdt: Optional[str] = Form(None)
):

    result = await create_branch(
        ten_chi_nhanh=ten_chi_nhanh,
        dia_chi=dia_chi,
        sdt=sdt,
        ma_chi_nhanh=ma_chi_nhanh
    )
    return result


@router.delete("/branches/{ma_chi_nhanh}", response_model=ResponseModel)
async def delete_branch_api(ma_chi_nhanh: str):
    return await delete_branch(ma_chi_nhanh)

@router.post(
    "/services/create",
    response_model=ResponseModel
)
async def create_service_api(
    ma_dich_vu: Optional[str] = Form(None),
    ten_dich_vu: str = Form(...),
    chuyen_khoa: str = Form(...),
    loai_dich_vu: str = Form(...),
    gia_goc: int = Form(...)
):

    result = await create_service(
        ten_dich_vu=ten_dich_vu,
        chuyen_khoa=chuyen_khoa,
        loai_dich_vu=loai_dich_vu,
        gia_goc=gia_goc,
        ma_dich_vu=ma_dich_vu
    )
    return result


@router.put("/services/{ma_dich_vu}/price", response_model=ResponseModel)
async def update_service_price_api(ma_dich_vu: str, request: ServicePriceRequest):
    return await update_service_price(ma_dich_vu, request.GiaGoc)


@router.delete("/services/{ma_dich_vu}", response_model=ResponseModel)
async def delete_service_api(ma_dich_vu: str):
    return await delete_service(ma_dich_vu)


@router.post("/branch-services", response_model=ResponseModel)
async def upsert_branch_service_api(request: BranchServiceRequest):
    return await upsert_branch_service(
        ma_chi_nhanh=request.MaChiNhanh,
        ma_dich_vu=request.MaDichVu,
        slot_gioi_han=request.SlotGioiHan,
    )


@router.put("/branch-services/{ma_cau_hinh}/slot", response_model=ResponseModel)
async def update_branch_service_slot_api(ma_cau_hinh: str, request: BranchServiceSlotRequest):
    return await update_branch_service_slot(ma_cau_hinh, request.SlotGioiHan)


@router.put("/branch-services/{ma_cau_hinh}/status", response_model=ResponseModel)
async def update_branch_service_status_api(ma_cau_hinh: str, request: BranchServiceStatusRequest):
    return await update_branch_service_status(ma_cau_hinh, request.TrangThai)


@router.delete("/branch-services/{ma_cau_hinh}", response_model=ResponseModel)
async def delete_branch_service_api(ma_cau_hinh: str):
    return await delete_branch_service(ma_cau_hinh)

@router.post(
    "/doctor-schedules/create",
    response_model=ResponseModel
)
async def create_doctor_schedule_api(
    ma_bac_si: str = Form(...),
    ma_chi_nhanh: str = Form(...),
    ngay_truc: str = Form(...),
    ca_truc: int = Form(...)
):

    result = await create_doctor_schedule(
        ma_bac_si=ma_bac_si,
        ma_chi_nhanh=ma_chi_nhanh,
        ngay_truc=ngay_truc,
        ca_truc=ca_truc
    )
    return result


@router.get("/doctor-schedules", response_model=ResponseModel)
async def get_admin_doctor_schedules_api(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    ma_bac_si: Optional[str] = Query(None),
):
    return await get_admin_doctor_schedules(
        from_date=from_date,
        to_date=to_date,
        ma_bac_si=ma_bac_si,
    )


@router.post("/doctor-schedules/cancel", response_model=ResponseModel)
async def cancel_doctor_schedule_api(request: CancelDoctorScheduleRequest):
    return await cancel_doctor_schedule(
        schedule_id=request.id,
        ma_lich_truc=request.MaLichTruc,
    )


@router.post("/doctor-schedules/transfer", response_model=ResponseModel)
async def transfer_doctor_schedule_api(request: TransferDoctorScheduleRequest):
    return await transfer_doctor_schedule(
        schedule_id=request.id,
        ma_lich_truc=request.MaLichTruc,
        new_ma_bac_si=request.newMaBacSi,
    )

@router.post(
    "/reports",
    response_model=ResponseModel
)
async def get_report_api(
    start_date: str = Form(...),
    end_date: str = Form(...)
):

    result = await get_report(
        start_date=start_date,
        end_date=end_date
    )
    return result


@router.get("/reports/monthly", response_model=ResponseModel)
async def get_monthly_report_api(month: str = Query(...)):
    return await get_monthly_report(month)
