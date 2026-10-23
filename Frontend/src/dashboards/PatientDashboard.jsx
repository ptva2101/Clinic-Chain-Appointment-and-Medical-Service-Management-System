import { Fragment, useEffect, useEffectEvent, useState } from 'react'
import { LogOut } from 'lucide-react'
import medicalLogoImage from '../assets/medical-logo-cutout.png'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { NotificationBell } from '../shared/Widgets.jsx'
import { bookTreatment, cancelPatientAppointment, createPatientAppointment, getPatientAppointments, getPatientNotifications } from '../api/appointment.js'
import { getPatientMedicalHistory } from '../api/clinical.js'
import { getSchedulingAvailability } from '../api/scheduling.js'
import { getPatientProfile, updatePatientProfile } from '../api/patientProfile.js'
import { createPatientInvoice, getPatientInvoices, simulatePatientPayment } from '../api/billing.js'
import { getFutureDateKey, getTodayDateKey } from '../shared/dates.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows } from './tablePagination.js'

export default function PatientDashboard({
  user,
  onLogout,
  onChangePassword,
  onUpdateUser,
  showNotification,
  notifications = [],
  addPatientNotifications,
  onMarkNotificationsRead,
  identityAccessToken,
  catalogData = EMPTY_CATALOG_DATA,
}) {
  const [activeMenu, setActiveMenu] = useState('booking')
  const [serviceSearch, setServiceSearch] = useState('')
  const [bookingMethod, setBookingMethod] = useState('time')
	  const initialPatientProfile = {
	    MaBenhAn: user?.MaBenhAn || user?.id || '',
	    HoTen: user?.HoTen || user?.name || '',
	    NgaySinh: user?.NgaySinh || '',
	    GioiTinh: user?.GioiTinh || '',
	    SDT: user?.SDT || '',
	    DiaChi: user?.DiaChi || '',
	    CCCD: user?.CCCD || '',
	    MaSoBHYT: user?.MaSoBHYT || '',
	    KyTuDauBHYT: user?.KyTuDauBHYT || '',
	    BHYTVerified: Boolean(user?.BHYTVerified),
	  }
	  const [patient, setPatient] = useState(initialPatientProfile)
  const patientNotifications = notifications.filter(
    (notification) =>
      notification.MaBenhAn === patient.MaBenhAn ||
      notification.MaBenhNhan === patient.MaBenhAn,
  )
	  const [bookings, setBookings] = useState([])
  const [invoicesByAppointment, setInvoicesByAppointment] = useState({})
  const [billingBusyId, setBillingBusyId] = useState('')
	  const [diseases] = useState([])
  const [visitRecords, setVisitRecords] = useState([])
	  const [medicines] = useState([])
  const [prescriptionDetails, setPrescriptionDetails] = useState([])
  const [labDetails, setLabDetails] = useState([])
	  const [labTechnicians] = useState([])
  const [treatmentSchedules, setTreatmentSchedules] = useState([])
  const [bookingForm, setBookingForm] = useState({
    MaChiNhanh: '',
    MaDichVu: '',
    NgayKham: getTodayDateKey(),
    CaKham: '',
    MaBacSi: '',
  })
	  const [treatmentDrafts, setTreatmentDrafts] = useState({})
	  const [activeTreatmentId, setActiveTreatmentId] = useState('')
  const [selectedVisitId, setSelectedVisitId] = useState('')
	  const [paymentModal, setPaymentModal] = useState(null)
	  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
	  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)
	  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
	  const [appointmentsError, setAppointmentsError] = useState('')
	  const [medicalHistoryLoading, setMedicalHistoryLoading] = useState(false)
	  const [medicalHistoryError, setMedicalHistoryError] = useState('')
	  const [appointmentSearch, setAppointmentSearch] = useState('')
	  const [appointmentPage, setAppointmentPage] = useState(0)
	  const [medicalHistoryPage, setMedicalHistoryPage] = useState(0)
	  const [isEditingContact, setIsEditingContact] = useState(false)
	  const [isSavingContact, setIsSavingContact] = useState(false)
	  const [isEditingInsurance, setIsEditingInsurance] = useState(false)
	  const [isSavingInsurance, setIsSavingInsurance] = useState(false)
	  const [insuranceForm, setInsuranceForm] = useState({
	    card: initialPatientProfile.MaSoBHYT,
	    category: initialPatientProfile.KyTuDauBHYT,
	  })
	  const [contactForm, setContactForm] = useState({
	    SDT: initialPatientProfile.SDT,
	    DiaChi: initialPatientProfile.DiaChi,
	  })
	  const [showPasswordForm, setShowPasswordForm] = useState(false)
	  const [passwordForm, setPasswordForm] = useState({
	    currentPassword: '',
	    newPassword: '',
	    confirmPassword: '',
	  })

  const effectiveBranches = (catalogData?.branches || []).filter((branch) => branch.TrangThai !== 'inactive')
  const effectiveServices = (catalogData?.services || []).filter((service) => service.TrangThai !== 'inactive')
  const effectiveStaffList = catalogData?.doctors || []
  const activeDoctorCodes = new Set(effectiveStaffList.map((doctor) => doctor.MaBacSi))
  const effectiveDiseases = catalogData?.diseases?.length ? catalogData.diseases : diseases
  const effectiveMedicines = catalogData?.medicines?.length ? catalogData.medicines : medicines
  const effectiveBhytCategories = catalogData?.bhyt || []
  const normalizedCatalogSchedules = (catalogData?.doctorSchedules || [])
    .filter((schedule) => activeDoctorCodes.has(schedule.MaBacSi))
    .map((schedule) => ({
      ...schedule,
      TrangThai: schedule.TrangThai || 'Đang hoạt động',
    }))
  const effectiveDoctorSchedules = normalizedCatalogSchedules
  const allKnownServices = effectiveServices
  const allKnownBranches = effectiveBranches
  const effectiveBranchServices = (catalogData?.branchServices || [])
    .filter((config) => config.TrangThai === 'active')
    .map((config) => {
    const branch = effectiveBranches.find((item) => item.MaChiNhanh === config.MaChiNhanh)
    const service = effectiveServices.find((item) => item.MaDichVu === config.MaDichVu)
    return {
        MaCauHinh: config.MaCauHinh,
        MaChiNhanh: config.MaChiNhanh,
        MaDichVu: config.MaDichVu,
        SlotGioiHan: Number(config.SlotGioiHan ?? 0),
        TrangThai: config.TrangThai,
        TenChiNhanh: branch?.TenChiNhanh || '',
        TenDichVu: service?.TenDichVu || '',
        ChuyenKhoa: service?.ChuyenKhoa || '',
        LoaiDichVu: service?.LoaiDichVu || '',
        GiaGoc: Number(service?.GiaGoc ?? 0),
    }
    })
  const allKnownBranchServices = effectiveBranchServices
  const allKnownDoctorSchedules = effectiveDoctorSchedules

  const normalizeAppointmentRow = (appointment) => ({
    MaLichHen: appointment.id || appointment.MaLichHen,
    MaBenhAn: appointment.patient_id || appointment.MaBenhAn || patient.MaBenhAn,
    MaCauHinh: appointment.config_code || appointment.MaCauHinh || '',
    MaDichVu: appointment.service_code || appointment.MaDichVu || '',
    TenDichVu: appointment.TenDichVu || '',
    MaChiNhanh: appointment.branch_code || appointment.MaChiNhanh || '',
    TenChiNhanh: appointment.TenChiNhanh || '',
    NgayKham: appointment.date || appointment.NgayKham || '',
    CaKham: appointment.shift || appointment.CaKham || '',
    STT: appointment.STT || appointment.STT_HangDoi || '',
    MaBacSi: appointment.doctor_code || appointment.MaBacSi || '',
    TenBacSi: appointment.TenBacSi || '',
    PaymentToken: appointment.PaymentToken || '',
    GiaCuoi: appointment.GiaCuoi || 0,
    TrangThai: appointment.status === 'confirmed' ? 'Đã xác nhận' :
      appointment.status === 'cancelled' ? 'Đã hủy' :
      appointment.status === 'cancel_pending' ? 'Đang hủy' :
      appointment.status === 'pending' ? 'Đang xác nhận' :
      appointment.status === 'failed' ? 'Lỗi đặt lịch' :
      appointment.legacy_status || appointment.TrangThai || 'Lịch sử',
    apiStatus: appointment.status || '',
  })

  const loadPatientAppointments = async () => {
    if (!patient.MaBenhAn || !identityAccessToken) return

    setAppointmentsLoading(true)
    setAppointmentsError('')

    try {
      const response = await getPatientAppointments(identityAccessToken)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.detail || 'Không thể tải lịch hẹn của bệnh nhân.')
      }

      if (Array.isArray(result)) {
        setBookings(result.map(normalizeAppointmentRow))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch hẹn của bệnh nhân.'
      setAppointmentsError(message)
      console.warn('PATIENT_APPOINTMENTS_LOAD_FAILED', message)
    } finally {
      setAppointmentsLoading(false)
    }
  }

  const loadPatientInvoices = async () => {
    if (!identityAccessToken) return
    try {
      const response = await getPatientInvoices(identityAccessToken)
      const result = await response.json()
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải hóa đơn.')
      }
      setInvoicesByAppointment(Object.fromEntries(result.map((invoice) => [invoice.appointment_id, invoice])))
    } catch (error) {
      console.warn('PATIENT_INVOICES_LOAD_FAILED', error)
    }
  }

  const ensureInvoice = async (appointmentId) => {
    const response = await createPatientInvoice(identityAccessToken, appointmentId)
    const result = await response.json()
    if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tạo hóa đơn.')
    setInvoicesByAppointment((current) => ({ ...current, [appointmentId]: result }))
    return result
  }

  const loadPatientNotifications = async () => {
    if (!patient.MaBenhAn || !identityAccessToken) return

    try {
      const response = await getPatientNotifications(identityAccessToken)
      const result = await response.json()

      if (!response.ok || !Array.isArray(result)) {
        throw new Error(result?.detail || 'Không thể tải thông báo bệnh nhân.')
      }

      addPatientNotifications?.(
        result.map((item) => ({
          MaThongBao: item.id,
          MaBenhAn: patient.MaBenhAn,
          MaLichHen: item.appointment_id,
          NoiDung: item.content,
          ThoiGianGui: item.created_at,
          read: item.read,
        })),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải thông báo bệnh nhân.'
      console.warn('PATIENT_NOTIFICATIONS_LOAD_FAILED', message)
    }
  }

  const normalizeMedicalHistory = (rows) => {
    const historyRows = Array.isArray(rows) ? rows : []
    const nextVisits = historyRows.map((visit) => ({
      MaLuotKham: visit.MaLuotKham,
      MaLichHen: visit.MaLichHen,
      TrieuChung: visit.TrieuChung || '',
      LoiDan: visit.LoiDan || '',
      MaBenh: visit.MaBenh || '',
      TenBenh: visit.TenBenh || '',
    }))
    const nextPrescriptions = historyRows.flatMap((visit) =>
      (visit.DonThuoc || []).map((item) => ({
        MaDonThuoc: item.MaDonThuoc,
        MaLuotKham: visit.MaLuotKham,
        MaThuoc: item.MaThuoc,
        TenThuoc: item.TenThuoc,
        DonViTinh: item.DonViTinh,
        SoLuong: item.SoLuong,
        LieuDung: item.LieuDung,
      })),
    )
    const nextLabs = historyRows.flatMap((visit) =>
      (visit.XetNghiem || []).map((item) => ({
        MaChiTietXN: item.MaChiTietXN,
        MaLuotKham: visit.MaLuotKham,
        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        KetQuaXetNghiem: item.KetQuaXetNghiem || '',
        MaXNV: item.MaXNV || '',
        GiaCuoi: item.GiaCuoi || 0,
        PaymentToken: item.PaymentToken || '',
        TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
      })),
    )
	    const nextTreatments = historyRows.flatMap((visit) =>
	      (visit.DieuTri || []).map((item) => ({
	        MaLichTrinh: item.MaLichTrinh,
	        MaLichHen: item.MaLichHen || '',
	        MaLuotKham: visit.MaLuotKham,
	        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        BuoiSo: item.BuoiSo,
        NgayThucHien: item.NgayThucHien || '',
        CaKham: item.CaKham || '',
        TrangThai: item.TrangThai || 'Chưa đặt lịch',
      })),
    )
    const completedBookings = historyRows.map((visit) => ({
      MaLichHen: visit.MaLichHen,
      MaBenhAn: patient.MaBenhAn,
      MaCauHinh: '',
      MaDichVu: visit.MaDichVuKham || '',
      TenDichVu: visit.TenDichVuKham || '',
      MaChiNhanh: visit.MaChiNhanh || '',
      TenChiNhanh: visit.TenChiNhanh || '',
      NgayKham: visit.NgayKham || '',
      CaKham: visit.CaKham || '',
      MaBacSi: visit.MaBacSi || '',
      TenBacSi: visit.TenBacSi || '',
      SDTBacSi: visit.SDTBacSi || '',
      PaymentToken: '',
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
    }))

    return {
      nextVisits,
      nextPrescriptions,
      nextLabs,
      nextTreatments,
      completedBookings,
    }
  }

  const loadMedicalHistory = async () => {
    if (!patient.MaBenhAn) return

    setMedicalHistoryLoading(true)
    setMedicalHistoryError('')

    try {
      const response = await getPatientMedicalHistory(patient.MaBenhAn, identityAccessToken)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải sổ khám bệnh.')
      }

      const normalized = normalizeMedicalHistory(result.data)
      setVisitRecords(normalized.nextVisits)
      setPrescriptionDetails(normalized.nextPrescriptions)
      setLabDetails(normalized.nextLabs)
      setTreatmentSchedules(normalized.nextTreatments)
      setBookings((current) => {
        const historyIds = new Set(normalized.completedBookings.map((booking) => booking.MaLichHen))
        return [
          ...normalized.completedBookings,
          ...current.filter((booking) => !historyIds.has(booking.MaLichHen)),
        ]
      })
      setSelectedVisitId(normalized.nextVisits[0]?.MaLuotKham || '')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải sổ khám bệnh.'
      setMedicalHistoryError(message)
      console.warn('MEDICAL_HISTORY_LOAD_FAILED', message)
    } finally {
      setMedicalHistoryLoading(false)
    }
  }

  const patientBookingStartDate = getTodayDateKey()
  const patientBookingEndDate = getFutureDateKey(30)
  const weekDayHeaders = [
    { label: 'Thứ Hai', shortLabel: 'T2', dayIndex: 1 },
    { label: 'Thứ Ba', shortLabel: 'T3', dayIndex: 2 },
    { label: 'Thứ Tư', shortLabel: 'T4', dayIndex: 3 },
    { label: 'Thứ Năm', shortLabel: 'T5', dayIndex: 4 },
    { label: 'Thứ Sáu', shortLabel: 'T6', dayIndex: 5 },
    { label: 'Thứ Bảy', shortLabel: 'T7', dayIndex: 6 },
    { label: 'Chủ Nhật', shortLabel: 'CN', dayIndex: 0 },
  ]

  const clinicalServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Khám lâm sàng')
  const filteredClinicalServices = clinicalServices.filter((service) => {
    const keyword = serviceSearch.trim().toLowerCase()
    if (!keyword) return true
    return [service.MaDichVu, service.TenDichVu, service.ChuyenKhoa]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
  const groupedClinicalServices = Object.values(
    filteredClinicalServices.reduce((groups, service) => {
      const department = service.ChuyenKhoa || 'Chưa phân khoa'
      const currentGroup = groups[department] || { department, services: [] }
      currentGroup.services.push(service)
      groups[department] = currentGroup
      return groups
    }, {}),
  ).sort((first, second) => first.department.localeCompare(second.department, 'vi'))

  const getService = (maDichVu) =>
    allKnownServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      ChuyenKhoa: '',
      LoaiDichVu: '',
      GiaGoc: 0,
    }

  const getBranchName = (maChiNhanh) =>
    allKnownBranches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh || maChiNhanh

  const getBranchConfig = (maChiNhanh, maDichVu) =>
    allKnownBranchServices.find((config) => config.MaChiNhanh === maChiNhanh && config.MaDichVu === maDichVu)

	  const getDoctorInfo = (maBacSi) =>
	    effectiveStaffList.find((doctor) => doctor.MaBacSi === maBacSi) || {
	      MaBacSi: maBacSi,
	      HoTen: maBacSi,
	      ChuyenKhoa: '',
	      SDT: 'Chưa cập nhật',
	    }

  const getDoctorInfoFromBooking = (booking) => {
    const catalogDoctor = getDoctorInfo(booking?.MaBacSi || '')
    return {
      ...catalogDoctor,
      HoTen: booking?.TenBacSi || catalogDoctor.HoTen,
      SDT: booking?.SDTBacSi || catalogDoctor.SDT,
    }
  }

	  const formatDoctorFullInfo = (doctor) =>
	    `Bác sĩ ${doctor.HoTen} - Khoa: ${doctor.ChuyenKhoa || 'Chưa cập nhật'} (SĐT: ${doctor.SDT || 'Chưa cập nhật'})`

  const getDiseaseInfo = (maBenh, tenBenh = '') =>
    effectiveDiseases.find((disease) => disease.MaBenh === maBenh) || {
      MaBenh: maBenh || 'Chưa xác định',
      TenBenh: tenBenh || 'Chưa xác định',
    }

  const getMedicineInfo = (maThuoc) =>
    effectiveMedicines.find((medicine) => medicine.MaThuoc === maThuoc) || {
      MaThuoc: maThuoc,
      TenThuoc: maThuoc,
      DonViTinh: '',
    }

	  const getLabTechnicianName = (maXNV) =>
	    labTechnicians.find((technician) => technician.MaXNV === maXNV)?.HoTen || 'Chưa phân công'

  const getBhytRate = () => patient.BHYTVerified
    ? effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0
    : 0

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const toDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00`)

  const addDays = (date, amount) => {
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + amount)
    return nextDate
  }

  const getWeekdayLabel = (dateKey) => {
    const day = parseDateKey(dateKey).getDay()
    return weekDayHeaders.find((header) => header.dayIndex === day)?.label || dateKey
  }

  const buildBookingWeeks = () => {
    const startDate = parseDateKey(patientBookingStartDate)
    const endDate = parseDateKey(patientBookingEndDate)
    const startWeekDay = startDate.getDay() || 7
    let weekStart = addDays(startDate, -(startWeekDay - 1))
    const weeks = []

    while (weekStart <= endDate) {
      const weekDates = weekDayHeaders.map((_, dayOffset) => {
        const date = addDays(weekStart, dayOffset)
        return {
          dateKey: toDateKey(date),
          isInBookingRange: date >= startDate && date <= endDate,
        }
      })

      weeks.push({
        label: `Tuần ${weeks.length + 1}`,
        range: `${weekDates[0].dateKey} - ${weekDates[6].dateKey}`,
        dates: weekDates,
      })

      weekStart = addDays(weekStart, 7)
    }

    return weeks
  }

  const buildInvoice = ({ maDichVu, maChiNhanh, ngayKham, caKham }) => {
    const service = getService(maDichVu)
    const tyLeHuong = getBhytRate()
    const bhytAmount = Math.round(service.GiaGoc * tyLeHuong)
    const finalAmount = Math.max(0, service.GiaGoc - bhytAmount)

    return {
      maDichVu,
      tenDichVu: service.TenDichVu,
      maChiNhanh,
      tenChiNhanh: getBranchName(maChiNhanh),
      ngayKham,
      caKham,
      giaGoc: service.GiaGoc,
      bhytAmount,
      finalAmount,
    }
  }

  const normalizeScheduleParams = (params) => ({
    maChiNhanh: params.maChiNhanh ?? params.MaChiNhanh ?? '',
    maDichVu: params.maDichVu ?? params.MaDichVu ?? '',
    ngayKham: params.ngayKham ?? params.NgayKham ?? '',
    caKham: params.caKham ?? params.CaKham ?? '',
  })

  const getBookedCountForSlot = (params) => {
    const { maChiNhanh, ngayKham, caKham } = normalizeScheduleParams(params)
    return bookings.filter(
      (booking) =>
        booking.MaChiNhanh === maChiNhanh &&
        booking.NgayKham === ngayKham &&
        Number(booking.CaKham) === Number(caKham) &&
        !String(booking.TrangThai || '').includes('Đã hủy'),
    ).length
  }

  const getSlotLimit = (params) => {
    const { maChiNhanh, maDichVu } = normalizeScheduleParams(params)
    const config = getBranchConfig(maChiNhanh, maDichVu)
    return config ? Number(config.SlotGioiHan || 15) : 0
  }

  const getRemainingSlots = (params) =>
    Math.max(0, getSlotLimit(params) - getBookedCountForSlot(params))

  const isScheduleActive = (schedule) => !schedule.TrangThai || schedule.TrangThai === 'Đang hoạt động'

  const getAvailableShifts = (params) => {
    const { maChiNhanh, maDichVu, ngayKham } = normalizeScheduleParams(params)

    const result = [1, 2, 3, 4].filter((shift) => {
      const hasWorkingDoctor = allKnownDoctorSchedules.some(
        (schedule) =>
          schedule.MaChiNhanh === maChiNhanh &&
          schedule.NgayTruc === ngayKham &&
          Number(schedule.CaTruc) === Number(shift) &&
          isScheduleActive(schedule),
      )
      const bookedCount = getBookedCountForSlot({
        maChiNhanh,
        maDichVu,
        ngayKham,
        caKham: shift,
      })
      const slotLimit = getSlotLimit({ maChiNhanh, maDichVu })

      return hasWorkingDoctor && bookedCount < slotLimit
    })

    return result
  }

  const getShiftTimeLabel = (shift) => {
    const shiftTimes = {
      1: 'Ca 1 (07:30 - 10:15)',
      2: 'Ca 2 (10:15 - 12:00)',
      3: 'Ca 3 (13:30 - 16:30)',
      4: 'Ca 4 (16:30 - 19:30)',
    }

    return shiftTimes[Number(shift)] || `Ca ${shift}`
  }

  const getAvailableDoctorsForShift = (params, options = {}) => {
    const { maChiNhanh, maDichVu, ngayKham, caKham } = normalizeScheduleParams(params)
    const service = getService(maDichVu)
    const shouldMatchSpecialty = options.matchSpecialty !== false
    const selectedDoctorIds = new Set()

    return allKnownDoctorSchedules
      .filter((schedule) => {
        const doctor = getDoctorInfo(schedule.MaBacSi)
        const isMatched =
          schedule.MaChiNhanh === maChiNhanh &&
          schedule.NgayTruc === ngayKham &&
          Number(schedule.CaTruc) === Number(caKham) &&
          isScheduleActive(schedule) &&
          (!shouldMatchSpecialty || doctor.ChuyenKhoa === service.ChuyenKhoa) &&
          !selectedDoctorIds.has(schedule.MaBacSi)

        if (isMatched) selectedDoctorIds.add(schedule.MaBacSi)
        return isMatched
      })
      .map((schedule) => {
        const doctor = getDoctorInfo(schedule.MaBacSi)
	        return {
	          MaBacSi: schedule.MaBacSi,
	          TenBacSi: doctor.HoTen,
	          ChuyenKhoa: doctor.ChuyenKhoa,
	          SDT: doctor.SDT,
	        }
      })
      .sort((first, second) => first.TenBacSi.localeCompare(second.TenBacSi, 'vi'))
  }

  const getDoctorBookingOptions = (params) => {
    const { maChiNhanh, maDichVu } = normalizeScheduleParams(params)
    const service = getService(maDichVu)

    return effectiveStaffList
      .filter((doctor) => {
        if (doctor.ChuyenKhoa !== service.ChuyenKhoa) return false

        return allKnownDoctorSchedules.some(
          (schedule) =>
            schedule.MaBacSi === doctor.MaBacSi &&
            schedule.MaChiNhanh === maChiNhanh &&
            isScheduleActive(schedule) &&
            schedule.NgayTruc >= patientBookingStartDate &&
            schedule.NgayTruc <= patientBookingEndDate &&
            getRemainingSlots({
              maChiNhanh,
              maDichVu,
              ngayKham: schedule.NgayTruc,
              caKham: schedule.CaTruc,
            }) > 0,
        )
      })
      .sort((first, second) => first.HoTen.localeCompare(second.HoTen, 'vi'))
      .map((doctor) => ({
        MaBacSi: doctor.MaBacSi,
        TenBacSi: doctor.HoTen,
        ChuyenKhoa: doctor.ChuyenKhoa,
        SDT: doctor.SDT,
      }))
  }

  const getDoctorScheduleForGridCell = ({ dateKey, shift }) =>
    allKnownDoctorSchedules.find(
      (schedule) =>
        schedule.MaBacSi === bookingForm.MaBacSi &&
        schedule.MaChiNhanh === bookingForm.MaChiNhanh &&
        schedule.NgayTruc === dateKey &&
        Number(schedule.CaTruc) === Number(shift) &&
        isScheduleActive(schedule) &&
        getRemainingSlots({
          maChiNhanh: bookingForm.MaChiNhanh,
          maDichVu: bookingForm.MaDichVu,
          ngayKham: dateKey,
          caKham: shift,
        }) > 0,
    )

  const getDefaultSlotSelection = (params) => {
    const { maChiNhanh, maDichVu, ngayKham } = normalizeScheduleParams(params)
    const shifts = getAvailableShifts({ maChiNhanh, maDichVu, ngayKham })
    const shiftWithDoctor = shifts.find((shift) =>
      getAvailableDoctorsForShift({
        maChiNhanh,
        maDichVu,
        ngayKham,
        caKham: shift,
      }).length > 0,
    )
    const selectedShift = shiftWithDoctor || shifts[0]
    const doctorsForShift = selectedShift
      ? getAvailableDoctorsForShift({
          maChiNhanh,
          maDichVu,
          ngayKham,
          caKham: selectedShift,
        })
      : []

    return {
      CaKham: selectedShift ? String(selectedShift) : '',
      MaBacSi: doctorsForShift[0]?.MaBacSi || '',
    }
  }

  const onSyncBookingForm = useEffectEvent(() => {
    if (!effectiveBranches.length || !clinicalServices.length) return

    setBookingForm((current) => {
      const next = { ...current }

      if (!effectiveBranches.some((branch) => branch.MaChiNhanh === next.MaChiNhanh)) {
        next.MaChiNhanh = effectiveBranches[0]?.MaChiNhanh || ''
      }

      if (!clinicalServices.some((service) => service.MaDichVu === next.MaDichVu)) {
        next.MaDichVu = clinicalServices[0]?.MaDichVu || ''
      }

      if (!next.NgayKham || next.NgayKham < patientBookingStartDate || next.NgayKham > patientBookingEndDate) {
        next.NgayKham = patientBookingStartDate
      }

      if (bookingMethod === 'time') {
        const shifts = getAvailableShifts(next)
        const hasSelectedShift = shifts.some((shift) => Number(shift) === Number(next.CaKham))
        const doctorsForCurrentShift = hasSelectedShift
          ? getAvailableDoctorsForShift(
              {
                maChiNhanh: next.MaChiNhanh,
                maDichVu: next.MaDichVu,
                ngayKham: next.NgayKham,
                caKham: next.CaKham,
              },
            )
          : []

        if (
          !hasSelectedShift ||
          !doctorsForCurrentShift.some((doctor) => doctor.MaBacSi === next.MaBacSi)
        ) {
          const nextSelection = getDefaultSlotSelection(next)
          next.CaKham = nextSelection.CaKham
          next.MaBacSi = nextSelection.MaBacSi
        }
      } else {
        const doctorOptions = getDoctorBookingOptions(next)
        if (!doctorOptions.some((doctor) => doctor.MaBacSi === next.MaBacSi)) {
          next.MaBacSi = doctorOptions[0]?.MaBacSi || ''
          next.NgayKham = ''
          next.CaKham = ''
        }
      }

      const hasChanged = Object.keys(next).some((key) => next[key] !== current[key])
      return hasChanged ? next : current
    })
  })
  useEffect(() => {
    const timer = window.setTimeout(() => onSyncBookingForm(), 0)
    return () => window.clearTimeout(timer)
  }, [catalogData, bookingMethod])

  const onLoadPatientData = useEffectEvent(() => {
    void loadPatientAppointments()
    void loadPatientInvoices()
    void loadMedicalHistory()
    void loadPatientNotifications()
  })
  useEffect(() => {
    const timer = window.setTimeout(() => onLoadPatientData(), 0)
    return () => window.clearTimeout(timer)
  }, [patient.MaBenhAn, identityAccessToken])

  const bookingAvailableShifts = getAvailableShifts(bookingForm)
  const bookingAvailableDoctors = getAvailableDoctorsForShift({
    maChiNhanh: bookingForm.MaChiNhanh,
    maDichVu: bookingForm.MaDichVu,
    ngayKham: bookingForm.NgayKham,
    caKham: bookingForm.CaKham,
  })
  const doctorBookingOptions = getDoctorBookingOptions(bookingForm)
  const patientBookingWeeks = buildBookingWeeks()
  const filteredBookings = bookings.filter((booking) => {
    const keyword = appointmentSearch.trim().toLowerCase()
    if (!keyword) return true

    return [
      booking.MaLichHen,
      getService(booking.MaDichVu).TenDichVu,
      getBranchName(booking.MaChiNhanh),
      booking.NgayKham,
      booking.TrangThai,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })

  const handleBookingFormChange = (field, value) => {
    setBookingForm((current) => {
      const next = { ...current, [field]: value }
      if (bookingMethod === 'time' && field !== 'CaKham') {
        const nextSelection = getDefaultSlotSelection(next)
        next.CaKham = nextSelection.CaKham
        next.MaBacSi = nextSelection.MaBacSi
      } else if (bookingMethod === 'doctor') {
        const doctorOptions = getDoctorBookingOptions(next)
        const shouldResetDoctor =
          field === 'MaDichVu' ||
          field === 'MaChiNhanh' ||
          !doctorOptions.some((doctor) => doctor.MaBacSi === next.MaBacSi)

        if (shouldResetDoctor) {
          next.MaBacSi = doctorOptions[0]?.MaBacSi || ''
          next.NgayKham = ''
          next.CaKham = ''
        }
      }
      return next
    })
  }

  const handleBookingShiftChange = (value) => {
    const doctorsForShift = getAvailableDoctorsForShift({
      maChiNhanh: bookingForm.MaChiNhanh,
      maDichVu: bookingForm.MaDichVu,
      ngayKham: bookingForm.NgayKham,
      caKham: value,
    })
    setBookingForm((current) => ({
      ...current,
      CaKham: value,
      MaBacSi: doctorsForShift[0]?.MaBacSi || '',
    }))
  }

	  const handleBookingDoctorChange = (value) => {
	    setBookingForm((current) => ({
	      ...current,
	      MaBacSi: value,
	      ...(bookingMethod === 'doctor' ? { NgayKham: '', CaKham: '' } : {}),
	    }))
	  }

  const handleBookingMethodChange = (method) => {
    setBookingMethod(method)
    setBookingForm((current) => {
      if (method === 'time') {
        const next = {
          ...current,
          NgayKham: current.NgayKham || patientBookingStartDate,
        }
        const nextSelection = getDefaultSlotSelection(next)
        return {
          ...next,
          CaKham: nextSelection.CaKham,
          MaBacSi: nextSelection.MaBacSi,
        }
      }

      const next = {
        ...current,
        NgayKham: '',
        CaKham: '',
      }
      const doctorOptions = getDoctorBookingOptions(next)
      return {
        ...next,
        MaBacSi: doctorOptions[0]?.MaBacSi || '',
      }
    })
  }

  const handleDoctorScheduleCellClick = (schedule) => {
    setBookingForm((current) => ({
      ...current,
      NgayKham: schedule.NgayTruc,
      CaKham: String(schedule.CaTruc),
      MaBacSi: schedule.MaBacSi,
    }))

    window.requestAnimationFrame(() => {
      document.getElementById('patient-booking-invoice')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })
  }

	  const handleStartEditContact = () => {
	    setContactForm({
	      SDT: patient.SDT,
	      DiaChi: patient.DiaChi,
	    })
	    setIsEditingContact(true)
	  }

	  const handleCancelEditContact = () => {
	    setContactForm({
	      SDT: patient.SDT,
	      DiaChi: patient.DiaChi,
	    })
	    setIsEditingContact(false)
	  }

	  const handleSaveContact = async () => {
      const phone = contactForm.SDT.trim()
      if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) {
        showNotification?.('Số điện thoại phải có 9–15 chữ số.', 'error')
        return
      }
      if (!identityAccessToken) {
        showNotification?.('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error')
        return
      }
      setIsSavingContact(true)
      try {
        const updated = await updatePatientProfile(identityAccessToken, { phone: phone || null })
        setPatient((current) => ({ ...current, SDT: updated.phone || '' }))
        onUpdateUser?.({ SDT: updated.phone || '' })
        setIsEditingContact(false)
        showNotification?.('Đã cập nhật số điện thoại tại Registry.')
      } catch (error) {
        showNotification?.(error instanceof Error ? error.message : 'Không thể cập nhật số điện thoại.', 'error')
      } finally {
        setIsSavingContact(false)
      }
	  }

  const handleStartEditInsurance = () => {
    setInsuranceForm({ card: patient.MaSoBHYT, category: patient.KyTuDauBHYT })
    setIsEditingInsurance(true)
  }

  const applyInsuranceProfile = (profile) => {
    const changes = {
      MaSoBHYT: profile.insurance_card_number || '',
      KyTuDauBHYT: profile.insurance_category_code || '',
      BHYTVerified: Boolean(profile.insurance_verified),
    }
    setPatient((current) => ({ ...current, ...changes }))
    onUpdateUser?.(changes)
  }

  const handleRefreshInsurance = async () => {
    if (!identityAccessToken) return
    setIsSavingInsurance(true)
    try {
      applyInsuranceProfile(await getPatientProfile(identityAccessToken))
      showNotification?.('Đã làm mới trạng thái BHYT từ Registry.')
    } catch (error) {
      showNotification?.(error instanceof Error ? error.message : 'Không thể làm mới BHYT.', 'error')
    } finally {
      setIsSavingInsurance(false)
    }
  }

  const handleSaveInsurance = async () => {
    const card = insuranceForm.card.trim().toUpperCase()
    const category = insuranceForm.category
    if ((card && !category) || (!card && category) || (card && !/^[A-Z0-9]{4,20}$/.test(card))) {
      showNotification?.('Nhập đủ mã thẻ hợp lệ và nhóm BHYT, hoặc để trống cả hai để bỏ thẻ.', 'error')
      return
    }
    if (!identityAccessToken) {
      showNotification?.('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error')
      return
    }
    setIsSavingInsurance(true)
    try {
      const updated = await updatePatientProfile(identityAccessToken, {
        insurance_card_number: card || null,
        insurance_category_code: category || null,
      })
      applyInsuranceProfile(updated)
      setIsEditingInsurance(false)
      showNotification?.(card ? 'Đã lưu BHYT tại Registry; chờ admin xác minh trước khi áp dụng mức hưởng.' : 'Đã bỏ thông tin BHYT.')
    } catch (error) {
      showNotification?.(error instanceof Error ? error.message : 'Không thể lưu thông tin BHYT.', 'error')
    } finally {
      setIsSavingInsurance(false)
    }
  }

	  const handlePasswordFormChange = (field, value) => {
	    setPasswordForm((current) => ({
	      ...current,
	      [field]: value,
	    }))
	  }

	  const handleCancelPasswordChange = () => {
	    setPasswordForm({
	      currentPassword: '',
	      newPassword: '',
	      confirmPassword: '',
	    })
	    setShowPasswordForm(false)
	  }

	  const handleConfirmPasswordChange = async () => {
	    if (passwordForm.newPassword.length < 6 || passwordForm.newPassword !== passwordForm.confirmPassword) {
	      showNotification?.('Mật khẩu mới cần ít nhất 6 ký tự và phải khớp xác nhận.', 'error')
	      return
	    }
	    try {
	      await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword)
	      handleCancelPasswordChange()
	    } catch (error) {
	      showNotification?.(error instanceof Error ? error.message : 'Không đổi được mật khẩu.', 'error')
	    }
	  }

	  const handleTreatmentDraftChange = (maLichTrinh, field, value) => {
    setTreatmentDrafts((current) => {
      const currentDraft = current[maLichTrinh] || {
        MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
        NgayKham: getTodayDateKey(),
        CaKham: '',
        MaBacSi: '',
      }
      const nextDraft = { ...currentDraft, [field]: value }
      const treatment = treatmentSchedules.find((item) => item.MaLichTrinh === maLichTrinh)

      if (field !== 'CaKham' && treatment) {
        const nextSelection = getDefaultSlotSelection({
          maChiNhanh: nextDraft.MaChiNhanh,
          maDichVu: treatment.MaDichVu,
          ngayKham: nextDraft.NgayKham,
        })
        nextDraft.CaKham = nextSelection.CaKham
        nextDraft.MaBacSi = nextSelection.MaBacSi
      }

      return { ...current, [maLichTrinh]: nextDraft }
    })
  }

  const handleTreatmentShiftChange = (maLichTrinh, value) => {
    const currentDraft = treatmentDrafts[maLichTrinh]
    const treatment = treatmentSchedules.find((item) => item.MaLichTrinh === maLichTrinh)
    const doctorsForShift = treatment
      ? getAvailableDoctorsForShift({
	        maChiNhanh: currentDraft?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || '',
          maDichVu: treatment.MaDichVu,
          ngayKham: currentDraft?.NgayKham || getTodayDateKey(),
          caKham: value,
        })
      : []

    setTreatmentDrafts((current) => ({
      ...current,
      [maLichTrinh]: {
        ...current[maLichTrinh],
        CaKham: value,
        MaBacSi: doctorsForShift[0]?.MaBacSi || '',
      },
    }))
  }

  const handleTreatmentDoctorChange = (maLichTrinh, value) => {
    setTreatmentDrafts((current) => ({
      ...current,
      [maLichTrinh]: {
        ...current[maLichTrinh],
        MaBacSi: value,
      },
    }))
  }

  const startTreatmentBooking = (treatment) => {
    const initialDraft = {
      MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
      NgayKham: getTodayDateKey(),
      CaKham: '',
      MaBacSi: '',
    }
    const initialSelection = getDefaultSlotSelection({
      maChiNhanh: initialDraft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: initialDraft.NgayKham,
    })
    setTreatmentDrafts((current) => ({
      ...current,
      [treatment.MaLichTrinh]: {
        ...initialDraft,
        CaKham: initialSelection.CaKham,
        MaBacSi: initialSelection.MaBacSi,
      },
    }))
    setActiveTreatmentId(treatment.MaLichTrinh)
  }

  const openBookingPayment = async () => {
    if (!bookingForm.CaKham || !bookingForm.MaBacSi) {
      showNotification?.('Hiện chưa có ca trống phù hợp. Vui lòng chọn ngày hoặc chi nhánh khác.', 'error')
      return
    }

    const config = getBranchConfig(bookingForm.MaChiNhanh, bookingForm.MaDichVu)
    if (!config) {
      showNotification?.('Dịch vụ này chưa được phân phối tại chi nhánh đã chọn.', 'error')
      return
    }

    setIsCheckingAvailability(true)
    try {
      const availability = await getSchedulingAvailability({
        configCode: config.MaCauHinh,
        doctorCode: bookingForm.MaBacSi,
        date: bookingForm.NgayKham,
        shift: bookingForm.CaKham,
      })
      if (availability.available < 1) {
        throw new Error('Ca khám này đã hết chỗ hoặc bác sĩ không còn lịch trực. Vui lòng chọn ca khác.')
      }
      setPaymentModal({
        type: 'new-booking',
        idempotencyKey: crypto.randomUUID(),
        availability: availability.available,
        invoice: buildInvoice({
          maDichVu: bookingForm.MaDichVu,
          maChiNhanh: bookingForm.MaChiNhanh,
          ngayKham: bookingForm.NgayKham,
          caKham: Number(bookingForm.CaKham),
        }),
        payload: {
          ...bookingForm,
          MaCauHinh: config.MaCauHinh,
          CaKham: Number(bookingForm.CaKham),
          MaBacSi: bookingForm.MaBacSi,
        },
      })
    } catch (error) {
      showNotification?.(error instanceof Error ? error.message : 'Không thể kiểm tra chỗ trống.', 'error')
    } finally {
      setIsCheckingAvailability(false)
    }
  }

  const openTreatmentPayment = (treatment) => {
    const draft = treatmentDrafts[treatment.MaLichTrinh]
    if (!draft?.CaKham || !draft?.MaBacSi) {
      showNotification?.('Hiện chưa có ca điều trị trống phù hợp. Vui lòng chọn ngày hoặc chi nhánh khác.', 'error')
      return
    }

    const config = getBranchConfig(draft.MaChiNhanh, treatment.MaDichVu)
    if (!config) {
      showNotification?.('Dịch vụ điều trị này chưa được phân phối tại chi nhánh đã chọn.', 'error')
      return
    }

    setPaymentModal({
      type: 'treatment-booking',
      invoice: buildInvoice({
        maDichVu: treatment.MaDichVu,
        maChiNhanh: draft.MaChiNhanh,
        ngayKham: draft.NgayKham,
        caKham: Number(draft.CaKham),
      }),
      payload: {
        MaLichTrinh: treatment.MaLichTrinh,
        MaDichVu: treatment.MaDichVu,
        MaCauHinh: config.MaCauHinh,
        MaChiNhanh: draft.MaChiNhanh,
        NgayKham: draft.NgayKham,
        CaKham: Number(draft.CaKham),
        MaBacSi: draft.MaBacSi,
      },
    })
  }

  const confirmBookingAction = async () => {
    if (!paymentModal) return

	    if (paymentModal.type === 'new-booking') {
	      setIsConfirmingPayment(true)
	      try {
        if (!identityAccessToken) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        const response = await createPatientAppointment(identityAccessToken, {
          config_code: paymentModal.payload.MaCauHinh,
          doctor_code: paymentModal.payload.MaBacSi,
          date: paymentModal.invoice.ngayKham,
          shift: Number(paymentModal.invoice.caKham),
          idempotency_key: paymentModal.idempotencyKey,
        })
        const result = await response.json()

        if (!response.ok) {
          throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tạo lịch hẹn.')
        }

        const nextBooking = normalizeAppointmentRow(result)
        setBookings((current) => [nextBooking, ...current.filter((booking) => booking.MaLichHen !== nextBooking.MaLichHen)])
        let invoiceCreated = false
        try {
          await ensureInvoice(result.id)
          invoiceCreated = true
        } catch (invoiceError) {
          console.warn('PATIENT_INVOICE_CREATE_FAILED', invoiceError)
        }
        await loadPatientAppointments()
        setPaymentModal(null)
        showNotification?.(invoiceCreated
          ? 'Đã đặt lịch và tạo hóa đơn chờ thanh toán.'
          : 'Đã đặt lịch nhưng chưa tạo được hóa đơn. Mở “Lịch hẹn của tôi” để thử lại.',
        invoiceCreated ? 'success' : 'error')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể tạo lịch hẹn.'
        showNotification?.(message, 'error')
      } finally {
        setIsConfirmingPayment(false)
	      }
	      return
	    }

	    if (paymentModal.type === 'treatment-booking') {
	      setIsConfirmingPayment(true)
	      try {
	        const response = await bookTreatment({
	          method: 'POST',
	          headers: { 'Content-Type': 'application/json' },
	          body: JSON.stringify({
	            ma_lich_trinh: paymentModal.payload.MaLichTrinh,
	            ma_benh_an: patient.MaBenhAn,
	            ma_cau_hinh: paymentModal.payload.MaCauHinh,
	            ngay_thuc_hien: paymentModal.invoice.ngayKham,
	            ca_kham: Number(paymentModal.invoice.caKham),
	            ma_bac_si: paymentModal.payload.MaBacSi,
	          }),
	        }, identityAccessToken)
	        const result = await response.json()

	        if (!response.ok || !result?.success) {
	          throw new Error(result?.message || 'Không thể đặt lịch điều trị.')
	        }

	        const appointment = result.data?.appointment
	        const treatment = result.data?.treatment

	        if (appointment) {
	          setBookings((current) => {
	            const nextBooking = normalizeAppointmentRow({
	              ...appointment,
	              MaDichVu: appointment.MaDichVu || paymentModal.invoice.maDichVu,
	              MaChiNhanh: appointment.MaChiNhanh || paymentModal.invoice.maChiNhanh,
	            })
	            return [nextBooking, ...current.filter((booking) => booking.MaLichHen !== nextBooking.MaLichHen)]
	          })
	        }

	        if (treatment) {
	          setTreatmentSchedules((current) =>
	            current.map((item) =>
	              item.MaLichTrinh === treatment.MaLichTrinh
	                ? {
	                    ...item,
	                    MaLichHen: treatment.MaLichHen || '',
	                    NgayThucHien: treatment.NgayThucHien || paymentModal.invoice.ngayKham,
	                    CaKham: treatment.CaKham || paymentModal.invoice.caKham,
	                    MaBacSi: paymentModal.payload.MaBacSi,
	                    TrangThai: treatment.TrangThai || 'Đã đặt lịch',
	                  }
	                : item,
	            ),
	          )
	        }

	        await loadPatientAppointments()
	        await loadPatientInvoices()
	        await loadMedicalHistory()
	        setActiveTreatmentId('')
	        setPaymentModal(null)
	        showNotification?.('Đã đặt buổi điều trị và tạo hóa đơn chờ thanh toán. Vào Lịch hẹn của tôi để ghi nhận thanh toán.')
	      } catch (error) {
	        const message = error instanceof Error ? error.message : 'Không thể đặt lịch điều trị.'
	        showNotification?.(message, 'error')
	      } finally {
	        setIsConfirmingPayment(false)
	      }
	      return
	    }

  }

  const cancelBooking = async (booking) => {
    if (!identityAccessToken || !window.confirm(`Hủy lịch hẹn ${booking.MaLichHen}?`)) return
    try {
      const response = await cancelPatientAppointment(identityAccessToken, booking.MaLichHen)
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể hủy lịch hẹn.')
      setBookings((current) => current.map((item) => item.MaLichHen === booking.MaLichHen ? normalizeAppointmentRow(result) : item))
      await loadPatientAppointments()
      showNotification?.('Đã hủy lịch hẹn.')
    } catch (error) {
      showNotification?.(error instanceof Error ? error.message : 'Không thể hủy lịch hẹn.', 'error')
    }
  }

  const handleBillingAction = async (booking) => {
    if (!identityAccessToken) return
    setBillingBusyId(booking.MaLichHen)
    try {
      const existing = invoicesByAppointment[booking.MaLichHen]
      if (!existing) {
        await ensureInvoice(booking.MaLichHen)
        showNotification?.('Đã tạo hóa đơn chờ thanh toán.')
        return
      }
      const invoice = existing
      if (invoice.status === 'pending' && window.confirm('Ghi nhận hóa đơn đã thanh toán? Thao tác này chỉ cập nhật trạng thái trong hệ thống, không thực hiện giao dịch ngân hàng.')) {
        const response = await simulatePatientPayment(identityAccessToken, invoice.id)
        const result = await response.json()
        if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể ghi nhận thanh toán.')
        setInvoicesByAppointment((current) => ({ ...current, [booking.MaLichHen]: result }))
        showNotification?.('Đã ghi nhận thanh toán.')
      }
    } catch (error) {
      showNotification?.(error instanceof Error ? error.message : 'Không thể xử lý hóa đơn.', 'error')
    } finally {
      setBillingBusyId('')
    }
  }

  const renderPaymentModal = () => {
    if (!paymentModal) return null

    return (
      <div className="payment-overlay">
        <div className="payment-modal">
          <div className="payment-modal-header">
            <div>
              <span>{paymentModal.type === 'new-booking' ? 'Lịch khám' : 'Lịch điều trị'}</span>
              <h2>{paymentModal.type === 'new-booking' ? 'Xác nhận đặt lịch' : 'Xác nhận đặt buổi điều trị'}</h2>
            </div>
            <button type="button" onClick={() => setPaymentModal(null)} disabled={isConfirmingPayment}>
              Đóng
            </button>
          </div>

          <div className="payment-invoice">
            <div>
              <span>Dịch vụ</span>
              <strong>{paymentModal.invoice.tenDichVu}</strong>
            </div>
            <div>
              <span>Chi nhánh</span>
              <strong>{paymentModal.invoice.tenChiNhanh}</strong>
            </div>
            <div>
              <span>Ngày/Ca khám</span>
              <strong>
                {paymentModal.invoice.ngayKham} - Ca {paymentModal.invoice.caKham}
              </strong>
            </div>
            <div>
              <span>Giá gốc</span>
              <strong>{formatMoney(paymentModal.invoice.giaGoc)}</strong>
            </div>
            {paymentModal.type !== 'new-booking' && <div>
              <span>BHYT giảm</span>
              <strong>{formatMoney(paymentModal.invoice.bhytAmount)}</strong>
            </div>}
            <div>
              <span>{paymentModal.type === 'new-booking' ? 'Giá niêm yết tham khảo' : 'Chi phí dự kiến'}</span>
              <strong>{formatMoney(paymentModal.type === 'new-booking' ? paymentModal.invoice.giaGoc : paymentModal.invoice.finalAmount)}</strong>
            </div>
          </div>

          {paymentModal.type === 'new-booking' && <p>Còn {paymentModal.availability} chỗ tại thời điểm kiểm tra. Thao tác này chỉ xác nhận lịch hẹn; chưa thu hoặc xác nhận thanh toán.</p>}
          {paymentModal.type === 'treatment-booking' && <p>Thao tác này tạo lịch điều trị và hóa đơn chờ thanh toán; chưa thu hoặc xác nhận thanh toán.</p>}

          <button
            type="button"
            className="payment-confirm-button"
            onClick={confirmBookingAction}
            disabled={isConfirmingPayment}
          >
            {isConfirmingPayment ? 'Đang xử lý...' : paymentModal.type === 'new-booking' ? 'Xác nhận đặt lịch' : 'Xác nhận đặt buổi điều trị'}
          </button>
        </div>
      </div>
    )
  }

  const renderBooking = () => {
    const invoice = buildInvoice({
      maDichVu: bookingForm.MaDichVu,
      maChiNhanh: bookingForm.MaChiNhanh,
      ngayKham: bookingForm.NgayKham,
      caKham: Number(bookingForm.CaKham || 0),
	    })
	    const selectedDoctor = bookingForm.MaBacSi ? getDoctorInfo(bookingForm.MaBacSi) : null
	    const selectedBranchConfig = getBranchConfig(bookingForm.MaChiNhanh, bookingForm.MaDichVu)
	    const canStartPayment = Boolean(
	      bookingForm.MaDichVu &&
	        bookingForm.MaChiNhanh &&
	        bookingForm.NgayKham &&
	        bookingForm.CaKham &&
	        bookingForm.MaBacSi &&
	        selectedBranchConfig,
	    )

    const renderDoctorBookingGrid = () => {
      if (!bookingForm.MaBacSi) {
        return (
          <div className="patient-doctor-note">
            Chọn bác sĩ phù hợp để xem lưới lịch trực từ {patientBookingStartDate} đến {patientBookingEndDate}.
          </div>
        )
      }

      return (
        <div className="patient-doctor-week-stack">
          {patientBookingWeeks.map((week) => (
            <section key={week.range} className="patient-doctor-week-card">
              <header>
                <div>
                  <h3>{week.label}</h3>
                  <span>{week.range}</span>
                </div>
                <strong>{formatDoctorFullInfo(selectedDoctor)}</strong>
              </header>

              <div className="patient-booking-week-grid">
                <div className="patient-booking-week-cell header">Ca trực</div>
                {week.dates.map((date) => (
                  <div key={date.dateKey} className="patient-booking-week-cell header">
                    <strong>{getWeekdayLabel(date.dateKey)}</strong>
                    <span>{date.dateKey}</span>
                  </div>
                ))}

                {[1, 2, 3, 4].map((shift) => (
                  <Fragment key={`${week.range}-${shift}`}>
                    <div className="patient-booking-week-cell shift-label">{getShiftTimeLabel(shift)}</div>
                    {week.dates.map((date) => {
                      const schedule = date.isInBookingRange
                        ? getDoctorScheduleForGridCell({ dateKey: date.dateKey, shift })
                        : null
                      const isSelected =
                        bookingForm.NgayKham === date.dateKey &&
                        Number(bookingForm.CaKham) === Number(shift)

                      return (
                        <div key={`${date.dateKey}-${shift}`} className="patient-booking-week-cell">
                          {schedule ? (
                            <button
                              type="button"
                              className={`patient-booking-slot-button ${isSelected ? 'active' : ''}`}
                              onClick={() => handleDoctorScheduleCellClick(schedule)}
                            >
                              <strong>Ca {shift}</strong>
                              <span>{getWeekdayLabel(date.dateKey)}</span>
                              <em>Kiểm tra chỗ khi xác nhận</em>
                            </button>
                          ) : (
                            <span className="patient-booking-slot-empty">-</span>
                          )}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </section>
          ))}
        </div>
      )
    }

    return (
      <div className="patient-card">
        <h2>Đặt lịch khám mới</h2>
        <p>Chọn dịch vụ khám lâm sàng rồi đặt theo khung giờ mong muốn hoặc chọn thẳng bác sĩ yêu thích.</p>
        {effectiveDoctorSchedules.length === 0 && <p className="auth-catalog-error">Chưa có lịch trực trong 30 ngày tới. Vui lòng liên hệ cơ sở để xếp lịch khám.</p>}

        <div className="booking-method-tabs">
          <button
            type="button"
            className={`booking-method-tab ${bookingMethod === 'time' ? 'active' : ''}`}
            onClick={() => handleBookingMethodChange('time')}
          >
            <span>📅</span>
            <strong>Đặt lịch theo thời gian</strong>
            <em>Chọn ngày, ca khám rồi chọn bác sĩ đang trực</em>
          </button>
          <button
            type="button"
            className={`booking-method-tab ${bookingMethod === 'doctor' ? 'active' : ''}`}
            onClick={() => handleBookingMethodChange('doctor')}
          >
            <span>👨‍⚕️</span>
            <strong>Đặt lịch theo bác sĩ</strong>
            <em>Xem lưới lịch trực tương lai của bác sĩ</em>
          </button>
        </div>

        <div className="patient-service-picker">
          <div className="patient-service-picker-head">
            <div>
              <span>Dịch vụ khám lâm sàng</span>
              <strong>{getService(bookingForm.MaDichVu).TenDichVu}</strong>
            </div>
            <input
              type="search"
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="Tìm mã, tên dịch vụ hoặc chuyên khoa"
            />
          </div>
          <div className="patient-service-groups">
            {groupedClinicalServices.length === 0 && <div className="patient-empty-service">Không tìm thấy dịch vụ phù hợp</div>}
            {groupedClinicalServices.map((group) => (
              <section key={group.department} className="patient-service-group">
                <h3>Khoa {group.department}</h3>
                <div className="patient-service-list">
                  {group.services.map((service) => (
                    <button
                      type="button"
                      key={service.MaDichVu}
                      className={`patient-service-option ${bookingForm.MaDichVu === service.MaDichVu ? 'active' : ''}`}
                      onClick={() => handleBookingFormChange('MaDichVu', service.MaDichVu)}
                    >
                      <span>{service.MaDichVu}</span>
                      <strong>{service.TenDichVu}</strong>
                      <em>{formatMoney(service.GiaGoc)}</em>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {bookingMethod === 'time' ? (
          <div className="patient-form-grid">
            <label>
              Chi nhánh
              <select
                value={bookingForm.MaChiNhanh}
                onChange={(event) => handleBookingFormChange('MaChiNhanh', event.target.value)}
              >
                {effectiveBranches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày khám
              <input
                type="date"
                value={bookingForm.NgayKham}
                onChange={(event) => handleBookingFormChange('NgayKham', event.target.value)}
              />
            </label>
            <label>
              Ca khám
              <select value={bookingForm.CaKham} onChange={(event) => handleBookingShiftChange(event.target.value)}>
                {bookingAvailableShifts.length === 0 && <option value="">Không có ca trống</option>}
                {bookingAvailableShifts.map((shift) => (
                  <option key={shift} value={shift}>
                    {getShiftTimeLabel(shift)} - còn{' '}
                    {getRemainingSlots({
                      maChiNhanh: bookingForm.MaChiNhanh,
                      maDichVu: bookingForm.MaDichVu,
                      ngayKham: bookingForm.NgayKham,
                      caKham: shift,
                    })}{' '}
                    slot
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chọn Bác sĩ phụ trách
              <select
                value={bookingForm.MaBacSi}
                onChange={(event) => handleBookingDoctorChange(event.target.value)}
                disabled={bookingAvailableDoctors.length === 0}
              >
                {bookingAvailableDoctors.length === 0 && <option value="">Không có bác sĩ đang trực ca này</option>}
                {bookingAvailableDoctors.map((doctor) => (
                  <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                    {formatDoctorFullInfo({
                      HoTen: doctor.TenBacSi,
                      ChuyenKhoa: doctor.ChuyenKhoa,
                      SDT: doctor.SDT,
                    })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <div className="patient-form-grid doctor-first-form">
              <label>
                Chi nhánh
                <select
                  value={bookingForm.MaChiNhanh}
                  onChange={(event) => handleBookingFormChange('MaChiNhanh', event.target.value)}
                >
                  {effectiveBranches.map((branch) => (
                    <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                      {branch.TenChiNhanh}
                    </option>
                  ))}
                </select>
              </label>
              <label className="doctor-first-select">
                Chọn Bác sĩ
                <select
                  value={bookingForm.MaBacSi}
                  onChange={(event) => handleBookingDoctorChange(event.target.value)}
                  disabled={doctorBookingOptions.length === 0}
                >
                  {doctorBookingOptions.length === 0 && <option value="">Chưa có bác sĩ phù hợp</option>}
                  {doctorBookingOptions.map((doctor) => (
                    <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                      {formatDoctorFullInfo({
                        HoTen: doctor.TenBacSi,
                        ChuyenKhoa: doctor.ChuyenKhoa,
                        SDT: doctor.SDT,
                      })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="doctor-first-grid-panel">
              <div className="doctor-first-grid-head">
                <div>
                  <span>Lưới lịch trực tương lai</span>
                  <strong>
                    {selectedDoctor
                      ? `${selectedDoctor.HoTen} - ${selectedDoctor.ChuyenKhoa}`
                      : 'Chưa chọn bác sĩ'}
                  </strong>
                </div>
                <p>
                  Nhấn vào ô còn slot để chọn ngày và ca khám. Hệ thống hiển thị từ {patientBookingStartDate} đến{' '}
                  {patientBookingEndDate}.
                </p>
              </div>
              {renderDoctorBookingGrid()}
            </div>
          </>
        )}

        <div id="patient-booking-invoice" className="patient-invoice-preview">
           <strong>Thông tin lịch và giá tham khảo</strong>
          {canStartPayment && selectedDoctor && (
            <span>
              Lịch chọn: {bookingForm.NgayKham} - {getShiftTimeLabel(bookingForm.CaKham)} - Bác sĩ{' '}
              {selectedDoctor.HoTen}
            </span>
          )}
	          <span>Giá niêm yết: {formatMoney(invoice.giaGoc)} (chưa xác minh BHYT, chưa thanh toán)</span>
	          {!selectedBranchConfig && (
	            <span className="auth-catalog-error">
	              Dịch vụ này chưa được cấu hình tại chi nhánh đã chọn.
	            </span>
	          )}
	        </div>

        <button
          type="button"
          className="patient-primary-button"
          onClick={openBookingPayment}
          disabled={!canStartPayment || isCheckingAvailability}
        >
          {isCheckingAvailability ? 'Đang kiểm tra chỗ trống...' : 'Xác nhận đặt lịch'}
        </button>
      </div>
    )
  }

	  const renderMyBookings = () => (
	    <div className="patient-card">
	      <h2>Lịch hẹn của tôi</h2>
	      <button type="button" className="patient-secondary-button" onClick={() => { void loadPatientAppointments(); void loadPatientInvoices() }}>
	        Làm mới lịch và hóa đơn
	      </button>
	      <div className="patient-appointment-toolbar">
	        <input
	          type="search"
	          value={appointmentSearch}
	          onChange={(event) => { setAppointmentSearch(event.target.value); setAppointmentPage(0) }}
	          placeholder="Tìm kiếm theo mã lịch hẹn, dịch vụ, chi nhánh, ngày, trạng thái..."
	        />
	        <span>{filteredBookings.length} lịch hẹn</span>
	      </div>
	      {appointmentsLoading && <p>Đang tải lịch hẹn từ hệ thống...</p>}
	      {appointmentsError && <p className="auth-catalog-error">{appointmentsError}</p>}
	      <div className="patient-table-wrap">
	        <table className="patient-table">
	          <thead>
	            <tr>
	              <th>Mã lịch hẹn</th>
	              <th>Dịch vụ</th>
	              <th>Chi nhánh</th>
	              <th>Bác sĩ phụ trách</th>
	              <th>Ngày</th>
	              <th>Ca</th>
	              <th>Trạng thái</th>
              <th>Thanh toán</th>
              <th>Thao tác</th>
	            </tr>
	          </thead>
	          <tbody>
	            {getPageRows(filteredBookings, appointmentPage).map((booking) => (
	              <tr key={booking.MaLichHen}>
	                <td>{booking.MaLichHen}</td>
	                <td>{getService(booking.MaDichVu).TenDichVu}</td>
	                <td>{getBranchName(booking.MaChiNhanh)}</td>
	                <td>{booking.MaBacSi ? getDoctorInfo(booking.MaBacSi).HoTen : 'Đang điều phối'}</td>
	                <td>{booking.NgayKham}</td>
	                <td>Ca {booking.CaKham}</td>
	                <td>{booking.TrangThai}</td>
                <td>{invoicesByAppointment[booking.MaLichHen]?.status === 'paid'
                  ? 'Đã thanh toán'
                  : invoicesByAppointment[booking.MaLichHen]?.status === 'refunded' ? 'Đã hoàn tiền'
                    : invoicesByAppointment[booking.MaLichHen]?.status === 'pending' ? 'Chờ thanh toán' : 'Chưa có hóa đơn'}</td>
                <td>
                  {booking.apiStatus === 'confirmed' && booking.NgayKham >= getTodayDateKey() && invoicesByAppointment[booking.MaLichHen]?.status !== 'paid' && (
                    <>
                      {invoicesByAppointment[booking.MaLichHen]?.status !== 'refunded' && (
                        <button type="button" className="patient-secondary-button" onClick={() => handleBillingAction(booking)} disabled={billingBusyId === booking.MaLichHen}>
                          {invoicesByAppointment[booking.MaLichHen] ? 'Ghi nhận thanh toán' : 'Tạo hóa đơn'}
                        </button>
                      )}
                      <button type="button" className="patient-secondary-button" onClick={() => cancelBooking(booking)}>Hủy lịch</button>
                    </>
                  )}
                </td>
	              </tr>
	            ))}
	            {filteredBookings.length === 0 && (
	              <tr>
                <td colSpan="9" className="patient-empty-row">
	                  Không tìm thấy lịch hẹn phù hợp.
	                </td>
	              </tr>
	            )}
	          </tbody>
	        </table>
	      </div>
	      <TablePagination page={appointmentPage} total={filteredBookings.length} label="lịch hẹn" onPageChange={setAppointmentPage} />
	    </div>
  )

	  const renderTreatmentBookingControl = (treatment) => {
	    const draft = treatmentDrafts[treatment.MaLichTrinh] || {
	      MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
	      NgayKham: getTodayDateKey(),
	      CaKham: '',
	      MaBacSi: '',
    }
    const shifts = getAvailableShifts({
      maChiNhanh: draft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: draft.NgayKham,
    })
    const treatmentDoctors = getAvailableDoctorsForShift({
      maChiNhanh: draft.MaChiNhanh,
      maDichVu: treatment.MaDichVu,
      ngayKham: draft.NgayKham,
      caKham: draft.CaKham,
    })
    const invoice = buildInvoice({
      maDichVu: treatment.MaDichVu,
      maChiNhanh: draft.MaChiNhanh,
      ngayKham: draft.NgayKham,
      caKham: Number(draft.CaKham || 0),
    })

    if (treatment.TrangThai !== 'Chưa đặt lịch') return null

    if (activeTreatmentId !== treatment.MaLichTrinh) {
      return (
        <button
          type="button"
          className="patient-secondary-button"
          onClick={() => startTreatmentBooking(treatment)}
        >
          Đặt lịch cho buổi này
        </button>
      )
    }

    return (
      <div className="treatment-inline-form">
        <select
          value={draft.MaChiNhanh}
          onChange={(event) => handleTreatmentDraftChange(treatment.MaLichTrinh, 'MaChiNhanh', event.target.value)}
        >
	          {effectiveBranches.map((branch) => (
	            <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
	              {branch.TenChiNhanh}
	            </option>
          ))}
        </select>
        <input
          type="date"
          value={draft.NgayKham}
          onChange={(event) => handleTreatmentDraftChange(treatment.MaLichTrinh, 'NgayKham', event.target.value)}
        />
        <select
          value={draft.CaKham}
          onChange={(event) => handleTreatmentShiftChange(treatment.MaLichTrinh, event.target.value)}
        >
          {shifts.length === 0 && <option value="">Không có ca trống</option>}
          {shifts.map((shift) => (
            <option key={shift} value={shift}>
              {getShiftTimeLabel(shift)} - còn{' '}
              {getRemainingSlots({
                maChiNhanh: draft.MaChiNhanh,
                maDichVu: treatment.MaDichVu,
                ngayKham: draft.NgayKham,
                caKham: shift,
              })}{' '}
              slot
            </option>
          ))}
        </select>
        {treatmentDoctors.length > 1 ? (
          <select
            value={draft.MaBacSi}
            onChange={(event) => handleTreatmentDoctorChange(treatment.MaLichTrinh, event.target.value)}
          >
            {treatmentDoctors.map((doctor) => (
              <option key={doctor.MaBacSi} value={doctor.MaBacSi}>
                {doctor.TenBacSi} - {doctor.ChuyenKhoa}
              </option>
            ))}
          </select>
        ) : (
          <div className="patient-doctor-note compact">
            {treatmentDoctors[0]
              ? `Bác sĩ phụ trách: ${treatmentDoctors[0].TenBacSi}`
              : 'Ca này không có bác sĩ chuyên khoa phù hợp, vui lòng chọn ca khác'}
          </div>
        )}
        <div className="patient-invoice-preview compact">
          <span>Giá gốc: {formatMoney(invoice.giaGoc)}</span>
          <span>BHYT giảm: {formatMoney(invoice.bhytAmount)}</span>
          <strong>Giá cuối: {formatMoney(invoice.finalAmount)}</strong>
        </div>
        <button
          type="button"
          className="patient-primary-button"
          onClick={() => openTreatmentPayment(treatment)}
        >
          Tiến hành thanh toán
        </button>
      </div>
    )
  }

  const renderHealthRecordSection = () => {
    if (medicalHistoryLoading) {
      return (
        <section className="patient-card">
          <h2>Sổ khám bệnh</h2>
          <p>Đang tải sổ khám bệnh từ hệ thống...</p>
        </section>
      )
    }

    const completedVisits = visitRecords
      .map((visit) => ({
        ...visit,
        booking: bookings.find(
          (booking) =>
            booking.MaLichHen === visit.MaLichHen &&
            booking.MaBenhAn === patient.MaBenhAn &&
            booking.TrangThai === 'Hoàn thành',
        ),
      }))
      .filter((visit) => visit.booking)
      .sort((first, second) => new Date(second.booking.NgayKham) - new Date(first.booking.NgayKham))
    const selectedVisit = completedVisits.find((visit) => visit.MaLuotKham === selectedVisitId) || completedVisits[0]

    if (!selectedVisit) {
      return (
        <section className="patient-card">
          <h2>Sổ khám bệnh</h2>
          {medicalHistoryError && <p className="auth-catalog-error">{medicalHistoryError}</p>}
          <p>Chưa có lượt khám hoàn thành để hiển thị hồ sơ sức khỏe.</p>
        </section>
      )
    }

    const disease = getDiseaseInfo(selectedVisit.MaBenh, selectedVisit.TenBenh)
    const selectedDoctor = getDoctorInfoFromBooking(selectedVisit.booking)
    const selectedPrescriptions = prescriptionDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const selectedLabs = labDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const selectedTreatments = treatmentSchedules.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    const treatmentGroups = Object.values(
      selectedTreatments.reduce((groups, item) => {
        const currentGroup = groups[item.MaDichVu] || {
          MaDichVu: item.MaDichVu,
          sessions: [],
        }
        currentGroup.sessions.push(item)
        groups[item.MaDichVu] = currentGroup
        return groups
      }, {}),
    )

    return (
      <section className="patient-card health-record-card">
        <div className="health-record-header">
          <div>
            <h2>Sổ khám bệnh</h2>
            <p>Hồ sơ sức khỏe cá nhân theo từng lượt khám đã hoàn thành.</p>
          </div>
          <span>{completedVisits.length} lượt khám</span>
        </div>

        <div className="health-record-layout">
          <aside className="health-timeline">
            {getPageRows(completedVisits, medicalHistoryPage).map((visit) => {
              const visitDisease = getDiseaseInfo(visit.MaBenh, visit.TenBenh)
              const visitDoctor = getDoctorInfoFromBooking(visit.booking)
              return (
                <button
                  type="button"
                  key={visit.MaLuotKham}
                  className={`health-timeline-card ${selectedVisit.MaLuotKham === visit.MaLuotKham ? 'active' : ''}`}
                  onClick={() => setSelectedVisitId(visit.MaLuotKham)}
                >
                  <span>{visit.booking.NgayKham}</span>
                  <strong>{visit.MaLuotKham}</strong>
                  <em>
                    BS: {visitDoctor.HoTen} ({visitDoctor.ChuyenKhoa || 'Chưa cập nhật'})
                  </em>
                  <small>{visitDisease.TenBenh}</small>
                </button>
              )
            })}
            <TablePagination page={medicalHistoryPage} total={completedVisits.length} label="lượt khám" onPageChange={(page) => {
              setMedicalHistoryPage(page)
              setSelectedVisitId(getPageRows(completedVisits, page)[0]?.MaLuotKham || '')
            }} />
          </aside>

          <div className="health-detail">
            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Chẩn đoán lâm sàng</span>
                <strong>
                  {disease.MaBenh} - {disease.TenBenh}
                </strong>
              </div>
              <div className="clinical-grid">
                <div>
                  <span>Triệu chứng lâm sàng</span>
                  <p>{selectedVisit.TrieuChung}</p>
                </div>
                <div className="clinical-doctor-info">
                  <span>Bác sĩ chủ trị</span>
                  <p>
                    Bác sĩ chủ trị: Bác sĩ {selectedDoctor.HoTen} | Chuyên khoa:{' '}
                    {selectedDoctor.ChuyenKhoa || 'Chưa cập nhật'} | Số điện thoại liên hệ:{' '}
                    {selectedDoctor.SDT || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="clinical-advice">
                  <span>Lời dặn tái khám</span>
                  <p>{selectedVisit.LoiDan}</p>
                </div>
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Đơn thuốc được kê</span>
                <strong>{selectedPrescriptions.length} thuốc</strong>
              </div>
              <div className="patient-table-wrap">
                <table className="patient-table compact">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên thuốc</th>
                      <th>Số lượng</th>
                      <th>Đơn vị tính</th>
                      <th>Liều dùng & Cách dùng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPrescriptions.map((item, index) => {
                      const medicine = getMedicineInfo(item.MaThuoc)
                      return (
                        <tr key={item.MaDonThuoc}>
                          <td>{index + 1}</td>
                          <td>{medicine.TenThuoc}</td>
                          <td>{item.SoLuong}</td>
                          <td>{medicine.DonViTinh}</td>
                          <td>{item.LieuDung}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Nhật ký xét nghiệm cận lâm sàng</span>
                <strong>{selectedLabs.length} chỉ định</strong>
              </div>
              <div className="lab-card-grid">
                {selectedLabs.map((lab) => (
                  <article key={lab.MaChiTietXN} className="lab-result-card">
                    <div>
                      <strong>{getService(lab.MaDichVu).TenDichVu}</strong>
                      <span>{formatMoney(lab.GiaCuoi)}</span>
                    </div>
                    <span className={`lab-status ${lab.TrangThaiXetNghiem === 'Đã có kết quả' ? 'done' : 'pending'}`}>
                      {lab.TrangThaiXetNghiem}
                    </span>
                    {lab.TrangThaiXetNghiem === 'Đã có kết quả' && (
                      <p>
                        {lab.KetQuaXetNghiem}
                        <br />
                        Xét nghiệm viên: {getLabTechnicianName(lab.MaXNV)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="health-detail-section">
              <div className="health-section-title">
                <span>Liệu trình điều trị chuyên sâu</span>
                <strong>{selectedTreatments.length} buổi</strong>
              </div>
              <div className="treatment-plan-list">
                {treatmentGroups.map((group) => {
                  const orderedSessions = [...group.sessions].sort((first, second) => first.BuoiSo - second.BuoiSo)
                  const completedCount = orderedSessions.filter((item) => item.TrangThai === 'Hoàn thành').length
                  const progressPercent = Math.round((completedCount / orderedSessions.length) * 100)

                  return (
                    <article key={group.MaDichVu} className="treatment-plan-card">
                      <div className="treatment-plan-head">
                        <div>
                          <strong>{getService(group.MaDichVu).TenDichVu}</strong>
                          <span>
                            Đã đi {completedCount} / {orderedSessions.length} buổi
                          </span>
                        </div>
                        <em>{progressPercent}%</em>
                      </div>
                      <div className="treatment-progress">
                        <span style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="treatment-session-list">
                        {orderedSessions.map((session) => (
                          <div key={session.MaLichTrinh} className="treatment-session-row">
                            <div>
                              <strong>Buổi {session.BuoiSo}</strong>
                              <span>
                                {session.NgayThucHien || 'Chưa đặt'} {session.CaKham ? `- Ca ${session.CaKham}` : ''}
                              </span>
                            </div>
                            <span className={`treatment-status ${session.TrangThai === 'Hoàn thành' ? 'done' : session.TrangThai === 'Đã đặt lịch' ? 'booked' : 'pending'}`}>
                              {session.TrangThai}
                            </span>
                            {renderTreatmentBookingControl(session)}
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </section>
    )
  }

  const renderTreatment = () => (
    <div className="patient-stack">
	      <section className="patient-card patient-profile-card">
	        <div className="patient-profile-header">
	          <div>
	            <h2>Thông tin hành chính cá nhân</h2>
	            <p>Quản lý thông tin định danh và cập nhật kênh liên hệ đang sử dụng.</p>
	          </div>
	          <div className="patient-profile-actions">
	            {!isEditingContact ? (
	              <button type="button" className="patient-secondary-button" onClick={handleStartEditContact}>
	                Cập nhật thông tin liên hệ
	              </button>
	            ) : (
	              <>
	                <button type="button" className="patient-primary-button" onClick={handleSaveContact} disabled={isSavingContact}>
	                  {isSavingContact ? 'Đang lưu...' : 'Lưu thay đổi'}
	                </button>
	                <button type="button" className="patient-plain-button" onClick={handleCancelEditContact}>
	                  Hủy bỏ
	                </button>
	              </>
	            )}
	            <button
	              type="button"
	              className="patient-secondary-button"
	              onClick={() => setShowPasswordForm((current) => !current)}
	            >
	              Đổi mật khẩu
	            </button>
	            {!isEditingInsurance ? (
	              <>
	                <button type="button" className="patient-secondary-button" onClick={handleStartEditInsurance}>
	                  Cập nhật BHYT
	                </button>
	                <button type="button" className="patient-plain-button" onClick={handleRefreshInsurance} disabled={isSavingInsurance}>
	                  Làm mới BHYT
	                </button>
	              </>
	            ) : (
	              <>
	                <button type="button" className="patient-primary-button" onClick={handleSaveInsurance} disabled={isSavingInsurance}>
	                  {isSavingInsurance ? 'Đang lưu...' : 'Lưu BHYT'}
	                </button>
	                <button type="button" className="patient-plain-button" onClick={() => setIsEditingInsurance(false)}>
	                  Hủy
	                </button>
	              </>
	            )}
	          </div>
	        </div>

	        <div className="patient-profile-form-grid">
	          <label>
	            Họ tên
	            <input type="text" value={patient.HoTen} disabled />
	          </label>
	          <label>
	            Ngày sinh
	            <input type="date" value={patient.NgaySinh} disabled />
	          </label>
	          <label>
	            Số CCCD
	            <input type="text" value={patient.CCCD} disabled />
	          </label>
	          <label>
	            Mã số BHYT
	            <input type="text" value={isEditingInsurance ? insuranceForm.card : patient.MaSoBHYT}
	              placeholder="Không sử dụng" disabled={!isEditingInsurance} maxLength={20}
	              onChange={(event) => setInsuranceForm((current) => ({ ...current, card: event.target.value }))} />
	          </label>
	          <label>
	            Nhóm BHYT
	            <select value={isEditingInsurance ? insuranceForm.category : patient.KyTuDauBHYT}
	              disabled={!isEditingInsurance}
	              onChange={(event) => setInsuranceForm((current) => ({ ...current, category: event.target.value }))}>
	              <option value="">Không sử dụng</option>
	              {effectiveBhytCategories.map((category) => (
	                <option key={category.KyTuDauBHYT} value={category.KyTuDauBHYT}>
	                  {category.KyTuDauBHYT} · {category.DoiTuongChinhSach}
	                </option>
	              ))}
	            </select>
	          </label>
	          <label>
	            Mức hưởng BHYT
	            <input type="text" value={patient.BHYTVerified ? `${Math.round(getBhytRate() * 100)}% · Đã xác minh` : 'Chưa xác minh · 0%'} disabled />
	          </label>
	          <label>
	            Số điện thoại
	            <input
	              type="tel"
	              value={contactForm.SDT}
	              disabled={!isEditingContact}
	              onChange={(event) => setContactForm((current) => ({ ...current, SDT: event.target.value }))}
	            />
	          </label>
	          <label className="patient-profile-address">
	            Địa chỉ
	            <input
	              type="text"
	              value={contactForm.DiaChi}
	              disabled
	            />
	          </label>
	        </div>

	        {showPasswordForm && (
	          <div className="patient-password-panel">
	            <label>
	              Mật khẩu hiện tại
	              <input
	                type="password"
	                value={passwordForm.currentPassword}
	                onChange={(event) => handlePasswordFormChange('currentPassword', event.target.value)}
	              />
	            </label>
	            <label>
	              Mật khẩu mới
	              <input
	                type="password"
	                value={passwordForm.newPassword}
	                onChange={(event) => handlePasswordFormChange('newPassword', event.target.value)}
	              />
	            </label>
	            <label>
	              Xác nhận mật khẩu mới
	              <input
	                type="password"
	                value={passwordForm.confirmPassword}
	                onChange={(event) => handlePasswordFormChange('confirmPassword', event.target.value)}
	              />
	            </label>
	            <div className="patient-password-actions">
	              <button type="button" className="patient-primary-button" onClick={handleConfirmPasswordChange}>
	                Xác nhận đổi mật khẩu
	              </button>
	              <button type="button" className="patient-plain-button" onClick={handleCancelPasswordChange}>
	                Hủy bỏ
	              </button>
	            </div>
	          </div>
	        )}
	      </section>

      {renderHealthRecordSection()}

    </div>
  )

  const navItems = [
    { key: 'booking', label: 'Đặt lịch khám mới', icon: '🏥' },
    { key: 'appointments', label: 'Lịch hẹn của tôi', icon: '📅' },
    { key: 'treatment', label: 'Lịch trình Điều trị & Sổ khám bệnh', icon: '📑' },
  ]

  const renderContent = () => {
    if (activeMenu === 'appointments') return renderMyBookings()
    if (activeMenu === 'treatment') return renderTreatment()
    return renderBooking()
  }

  return (
    <main className="patient-shell">
      <aside className="patient-sidebar">
        <div className="patient-brand">
          <img src={medicalLogoImage} alt="Medicare" />
          <div>
            <strong>Medicare</strong>
            <span>Cổng Bệnh nhân</span>
          </div>
        </div>
        <nav className="patient-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`patient-nav-button ${activeMenu === item.key ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <button type="button" className="patient-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>

      <section className="patient-content">
        <header className="patient-topbar">
          <div>
            <span>Xin chào</span>
            <h1>{patient.HoTen}</h1>
          </div>
          <div className="patient-topbar-actions">
            <p>BHYT: {patient.MaSoBHYT || 'Không sử dụng'} - Mức hưởng {Math.round(getBhytRate() * 100)}%</p>
            <NotificationBell
              notifications={patientNotifications}
              onMarkAllRead={() => onMarkNotificationsRead?.(patient.MaBenhAn)}
            />
          </div>
        </header>
        {renderContent()}
      </section>
      {renderPaymentModal()}
    </main>
  )
}
