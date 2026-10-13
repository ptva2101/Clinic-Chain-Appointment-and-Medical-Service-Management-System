import { useEffect, useMemo, useState } from 'react'
import { Activity, Building2, Calendar, ClipboardList, DollarSign, LogOut, Stethoscope, Users } from 'lucide-react'
import medicalLogoImage from '../assets/medical-logo-cutout.png'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getFutureDateKey, getTodayDateKey } from '../shared/dates.js'
import { getMonthlyReport } from '../api/billing.js'
import { listAccounts } from '../api/identity.js'
import { listPatients } from '../api/patientProfile.js'
import { createBranch, createService as createRegistryService, saveBranchService, updateBranchService, updateServicePrice as saveServicePrice } from '../api/registry.js'
import { listStaffProfiles } from '../api/staffProfile.js'
import { cancelDoctorSchedules, createDoctorSchedules, listDoctorSchedules, transferDoctorSchedules } from '../api/scheduling.js'
import IdentityStaffAccounts from './IdentityStaffAccounts.jsx'

const PATIENT_PAGE_SIZE = 20
const STAFF_ROLE_NAMES = { doctor: 'Bác sĩ', letan: 'Lễ tân', xnv: 'Xét nghiệm viên' }

export default function AdminDashboard({
  user,
  onLogout,
  identityAccessToken,
  showNotification,
  addPatientNotifications,
  addScheduleAdjustment,
  catalogData = EMPTY_CATALOG_DATA,
}) {
  const [branches, setBranches] = useState([])
  const [branchForm, setBranchForm] = useState({
    MaChiNhanh: '',
    TenChiNhanh: '',
    DiaChi: '',
    SDT: '',
  })

  const [services, setServices] = useState([])
  const [priceDrafts, setPriceDrafts] = useState({})
  const [activeMenu, setActiveMenu] = useState('staff')
  const [staffList, setStaffList] = useState([])
  const [staffReload, setStaffReload] = useState(0)
  const [staffLoadError, setStaffLoadError] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [patientPage, setPatientPage] = useState(0)
  const [patientTotal, setPatientTotal] = useState(0)
  const [patientLoading, setPatientLoading] = useState(true)
  const [patientError, setPatientError] = useState('')
  const [patientReload, setPatientReload] = useState(0)
  const [serviceSearch, setServiceSearch] = useState('')
  const [newServiceForm, setNewServiceForm] = useState({
    MaDichVu: '',
    TenDichVu: '',
    LoaiDichVu: 'Khám lâm sàng',
    ChuyenKhoa: 'Nội tổng quát',
    GiaGoc: '',
  })
  const [branchServices, setBranchServices] = useState([])
  const [distributionForm, setDistributionForm] = useState({
    MaChiNhanh: '',
    MaDichVu: '',
    SlotGioiHan: '10',
  })
  const [serviceFilters, setServiceFilters] = useState({
    MaChiNhanh: 'all',
    LoaiDichVu: 'all',
  })
  const [slotDrafts, setSlotDrafts] = useState(() =>
    Object.fromEntries(
      [
        ['CH_CG_KHAMNOI', 15],
        ['CH_CG_KHAMRANG', 10],
        ['CH_CG_XNMAU', 20],
        ['CH_CG_SAOBUNG', 15],
        ['CH_CG_RANGTUY', 5],
        ['CH_HBT_KHAMNOI', 15],
        ['CH_HBT_KHAMTMH', 12],
        ['CH_HBT_XNMAU', 20],
        ['CH_HBT_KHIDUNG', 8],
      ].map(([key, value]) => [key, String(value)]),
    ),
  )
  const [doctorSchedules, setDoctorSchedules] = useState([])
  const [adminScheduleLoading, setAdminScheduleLoading] = useState(false)
  const [adminScheduleError, setAdminScheduleError] = useState('')
  const [appointments, setAppointments] = useState([
    {
      MaLichHen: 'LH_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 30000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_002',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMRANG',
      NgayKham: '2026-06-01',
      CaKham: 3,
      STT: 1,
      GiaCuoi: 200000,
      TrangThai: 'Đã xác nhận',
      MaLeTan: '',
      MaBacSi: 'BS002',
    },
    {
      MaLichHen: 'LH_003',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 2,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Chờ khám',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_004',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-06-01',
      CaKham: 2,
      STT: 2,
      GiaCuoi: 150000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_005',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_HBT_KHAMTMH',
      NgayKham: '2026-06-01',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT002',
      MaBacSi: 'BS003',
    },
    {
      MaLichHen: 'LH_006',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_KHAMNOI',
      NgayKham: '2026-05-18',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 30000,
      TrangThai: 'Hoàn thành',
      MaLeTan: 'LT001',
      MaBacSi: 'BS001',
    },
    {
      MaLichHen: 'LH_007',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_CG_KHAMRANG',
      NgayKham: '2026-05-20',
      CaKham: 3,
      STT: 1,
      GiaCuoi: 200000,
      TrangThai: 'Đã khám',
      MaLeTan: 'LT001',
      MaBacSi: 'BS002',
    },
    {
      MaLichHen: 'LH_008',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_HBT_KHAMTMH',
      NgayKham: '2026-05-22',
      CaKham: 1,
      STT: 1,
      GiaCuoi: 0,
      TrangThai: 'Đã hủy',
      MaLeTan: 'LT002',
      MaBacSi: 'BS003',
    },
  ])
  const [labTestDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'XN_MAU',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Hoàn thành',
    },
		    {
		      MaChiTietXN: 'CTXN_002',
      MaBenhAn: 'BN002',
      MaDichVu: 'XN_SINH_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Đang xử lý',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaBenhAn: 'BN003',
      MaDichVu: 'XN_DUONG_HUYET',
      MaChiNhanh: 'CN_HBT',
      MaBacSi: 'BS003',
      NgayThucHien: '2026-06-01',
      TrangThai: 'Hoàn thành',
    },
    {
      MaChiTietXN: 'CTXN_004',
      MaBenhAn: 'BN002',
      MaDichVu: 'SA_O_BUNG',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-05-20',
      TrangThai: 'Hoàn thành',
    },
  ])
  const [treatmentRevenueDetails] = useState([
    {
      MaLichTrinh: 'LTDT_AD_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DT_RANG_TUY',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-06-05',
      GiaCuoi: 240000,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_AD_002',
      MaBenhAn: 'BN003',
      MaDichVu: 'DT_KHIDUNG',
      MaChiNhanh: 'CN_HBT',
      MaBacSi: 'BS003',
      NgayThucHien: '2026-06-12',
      GiaCuoi: 0,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_AD_003',
      MaBenhAn: 'BN002',
      MaDichVu: 'DT_RANG_TUY',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayThucHien: '2026-05-24',
      GiaCuoi: 1200000,
      TrangThai: 'Hoàn thành',
    },
  ])
  const [bulkScheduleForm, setBulkScheduleForm] = useState({
    MaBacSi: '',
    MaChiNhanh: '',
    TuNgay: getTodayDateKey(),
    DenNgay: getFutureDateKey(7),
    selections: {},
  })
  const todayFilter = new Date().toISOString().slice(0, 10)
  const nextWeekFilter = new Date()
  nextWeekFilter.setDate(nextWeekFilter.getDate() + 7)
  const [scheduleFilters, setScheduleFilters] = useState({
    TuNgay: todayFilter,
    DenNgay: nextWeekFilter.toISOString().slice(0, 10),
    MaBacSi: 'all',
  })
  const [doctorTransferModal, setDoctorTransferModal] = useState({
    show: false,
    schedule: null,
    nextDoctorId: '',
  })
  const [feedback, setFeedback] = useState('')
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [reportMonth, setReportMonth] = useState('2026-06')
  const [adminReportData, setAdminReportData] = useState(null)
  const [adminReportLoading, setAdminReportLoading] = useState(false)
  const [adminReportError, setAdminReportError] = useState('')

  const serviceDepartments = ['Nội tổng quát', 'Răng hàm mặt', 'Tai mũi họng', 'Xét nghiệm']
  const serviceTypes = ['Khám lâm sàng', 'Xét nghiệm', 'Điều trị']
  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]

  useEffect(() => {
    if (Array.isArray(catalogData?.branches)) {
      setBranches(catalogData.branches)
      setDistributionForm((current) => ({
        ...current,
        MaChiNhanh: catalogData.branches.some((branch) => branch.MaChiNhanh === current.MaChiNhanh)
          ? current.MaChiNhanh : catalogData.branches[0]?.MaChiNhanh || '',
      }))
    }

    if (Array.isArray(catalogData?.services)) {
      setServices(catalogData.services)
      setPriceDrafts(Object.fromEntries(
          catalogData.services.map((service) => [
            service.MaDichVu,
            String(service.GiaGoc ?? ''),
          ]),
      ))
      setDistributionForm((current) => ({
        ...current,
        MaDichVu: catalogData.services.some((service) => service.MaDichVu === current.MaDichVu)
          ? current.MaDichVu : catalogData.services[0]?.MaDichVu || '',
      }))
    }

    if (Array.isArray(catalogData?.branchServices)) {
      setBranchServices(catalogData.branchServices)
      setSlotDrafts(Object.fromEntries(catalogData.branchServices.map((config) => [
        config.MaCauHinh, String(config.SlotGioiHan ?? 0),
      ])))
    }

    if (Array.isArray(catalogData?.doctorSchedules)) {
      setDoctorSchedules(
        catalogData.doctorSchedules.map((schedule) => ({
          ...schedule,
          TrangThai: schedule.TrangThai || 'Đang hoạt động',
        })),
      )

    }
  }, [catalogData])

  useEffect(() => {
    if (!identityAccessToken) return
    let active = true
    const load = async () => {
      try {
        const profiles = []
        for (let offset = 0; ; offset += 100) {
          const page = await listStaffProfiles(identityAccessToken, { limit: 100, offset })
          profiles.push(...page.items)
          if (profiles.length >= page.total) break
        }
        const accountGroups = await Promise.all(Object.keys(STAFF_ROLE_NAMES).map(async (role) => {
          const accounts = []
          for (let offset = 0; ; offset += 100) {
            const page = await listAccounts(identityAccessToken, role, offset)
            accounts.push(...page)
            if (page.length < 100) break
          }
          return accounts
        }))
        const activeAccounts = new Set(accountGroups.flat()
          .filter((account) => account.is_active && !account.registration_pending)
          .map((account) => `${account.role}:${account.subject_id}`))
        if (active) {
          setStaffList(profiles.filter((profile) => activeAccounts.has(`${profile.role}:${profile.staff_code}`))
            .map((profile) => ({
              MaNhanSu: profile.staff_code,
              HoTen: profile.full_name,
              VaiTro: STAFF_ROLE_NAMES[profile.role],
              ChuyenKhoa: profile.specialty || '',
              SDT: profile.phone || '',
              MaChiNhanh: profile.branch_code || '',
              TrangThai: 'active',
            })))
          setStaffLoadError('')
        }
      } catch (error) {
        if (active) {
          setStaffList([])
          setStaffLoadError(error instanceof Error ? error.message : 'Không thể tải nhân viên.')
        }
      }
    }
    load()
    return () => { active = false }
  }, [identityAccessToken, staffReload])

  useEffect(() => {
    if (activeMenu !== 'staff' || !identityAccessToken) return
    let active = true
    const timer = setTimeout(async () => {
      if (active) setPatientLoading(true)
      try {
        const result = await listPatients(identityAccessToken, {
          search: patientSearch,
          limit: PATIENT_PAGE_SIZE,
          offset: patientPage * PATIENT_PAGE_SIZE,
        })
        if (active) {
          setPatients(result.items)
          setPatientTotal(result.total)
          setPatientError('')
        }
      } catch (error) {
        if (active) {
          setPatients([])
          setPatientTotal(0)
          setPatientError(error instanceof Error ? error.message : 'Không thể tải danh sách bệnh nhân.')
        }
      } finally {
        if (active) setPatientLoading(false)
      }
    }, patientSearch ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [activeMenu, identityAccessToken, patientSearch, patientPage, patientReload])

  const doctors = useMemo(
    () => staffList.filter((staff) => staff.VaiTro === 'Bác sĩ' && staff.TrangThai === 'active'),
    [staffList],
  )

  useEffect(() => {
    setBulkScheduleForm((current) => ({
      ...current,
      MaBacSi: doctors.some((doctor) => doctor.MaNhanSu === current.MaBacSi)
        ? current.MaBacSi : doctors[0]?.MaNhanSu || '',
      MaChiNhanh: branches.some((branch) => branch.MaChiNhanh === current.MaChiNhanh)
        ? current.MaChiNhanh : branches[0]?.MaChiNhanh || '',
    }))
  }, [doctors, branches])

  const filteredServices = useMemo(() => {
    const keyword = serviceSearch.trim().toLowerCase()
    if (!keyword) return services

    return services.filter((service) =>
      [service.MaDichVu, service.TenDichVu, service.LoaiDichVu, service.ChuyenKhoa]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [services, serviceSearch])

  const getBranchName = (maChiNhanh) =>
    branches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh || maChiNhanh

  const getService = (maDichVu) =>
    services.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      LoaiDichVu: '',
      GiaGoc: 0,
    }

  const getPatient = (maBenhAn) => patients.find((patient) => patient.id === maBenhAn)

  const getBhytRate = (maBenhAn) => {
    const patient = getPatient(maBenhAn)
    if (!patient?.KyTuDauBHYT) return 0

    return (
      bhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)
        ?.TyLeHuong || 0
    )
  }

  const calculateRevenueParts = (maBenhAn, giaGoc, giaCuoiOverride = null) => {
    if (giaCuoiOverride !== null && giaCuoiOverride !== undefined && giaCuoiOverride !== '') {
      const netRevenue = Math.max(0, Number(giaCuoiOverride) || 0)
      return {
        netRevenue,
        insuranceAmount: Math.max(0, Number(giaGoc || 0) - netRevenue),
      }
    }

    const tyLeHuong = getBhytRate(maBenhAn)
    const insuranceAmount = Math.round(giaGoc * tyLeHuong)
    const netRevenue = Math.max(0, giaGoc - insuranceAmount)

    return { netRevenue, insuranceAmount }
  }

  const getConfigService = (maCauHinh) => {
    const config = branchServices.find((item) => item.MaCauHinh === maCauHinh)
    if (!config) return { config: null, service: getService('') }

    return { config, service: getService(config.MaDichVu) }
  }

  const getAppointmentCountForSchedule = (schedule) => {
    if (schedule.SoLichHenDangCo !== undefined && schedule.SoLichHenDangCo !== null) {
      return Number(schedule.SoLichHenDangCo || 0)
    }

    const configIds = branchServices
      .filter((config) => config.MaChiNhanh === schedule.MaChiNhanh)
      .map((config) => config.MaCauHinh)

    return appointments.filter(
      (appointment) =>
        appointment.NgayKham === schedule.NgayTruc &&
        Number(appointment.CaKham) === Number(schedule.CaTruc) &&
        configIds.includes(appointment.MaCauHinh) &&
        (appointment.MaBacSi ? appointment.MaBacSi === schedule.MaBacSi : true) &&
        appointment.TrangThai !== 'Đã hủy' &&
        appointment.TrangThai !== 'Đã hủy (Hệ thống hoàn tiền)',
    ).length
  }

  const getAffectedAppointmentsForSchedule = (schedule) => {
    const configIds = branchServices
      .filter((config) => config.MaChiNhanh === schedule.MaChiNhanh)
      .map((config) => config.MaCauHinh)
    const activeStatuses = ['Đã xác nhận', 'Chờ khám', 'Đang khám', 'Chờ kết luận']

    return appointments.filter(
      (appointment) =>
        appointment.NgayKham === schedule.NgayTruc &&
        Number(appointment.CaKham) === Number(schedule.CaTruc) &&
        configIds.includes(appointment.MaCauHinh) &&
        (appointment.MaBacSi ? appointment.MaBacSi === schedule.MaBacSi : true) &&
        activeStatuses.includes(appointment.TrangThai),
    )
  }

  const pushScheduleNotifications = (affectedAppointments, messageBuilder) => {
    const patientNotifications = affectedAppointments.map((appointment) => ({
      MaBenhAn: appointment.MaBenhAn,
      MaBenhNhan: appointment.MaBenhAn,
      message: messageBuilder(appointment),
    }))

    addPatientNotifications?.(patientNotifications)
    return patientNotifications.length
  }

  const filteredDoctorSchedules = doctorSchedules.filter((schedule) => {
    const matchedStartDate =
      !scheduleFilters.TuNgay || schedule.NgayTruc >= scheduleFilters.TuNgay
    const matchedEndDate =
      !scheduleFilters.DenNgay || schedule.NgayTruc <= scheduleFilters.DenNgay
    const matchedDoctor =
      scheduleFilters.MaBacSi === 'all' || schedule.MaBacSi === scheduleFilters.MaBacSi

    return matchedStartDate && matchedEndDate && matchedDoctor
  })

  useEffect(() => {
    if (activeMenu === 'schedules') {
      loadAdminDoctorSchedules()
    }
  }, [activeMenu, scheduleFilters.TuNgay, scheduleFilters.DenNgay, scheduleFilters.MaBacSi])

  const getReportMonthRangeLabel = (monthValue) => {
    const [year, month] = monthValue.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const formattedMonth = String(month).padStart(2, '0')

    return `Chu kỳ báo cáo: Từ ngày 01/${formattedMonth}/${year} đến ngày ${lastDay}/${formattedMonth}/${year}`
  }

  const isInReportMonth = (dateValue) => Boolean(dateValue?.startsWith(reportMonth))

  const isCompletedVisitStatus = (status) => status === 'Hoàn thành' || status === 'Đã khám'

  const loadAdminMonthlyReport = async () => {
    if (!reportMonth) return

    setAdminReportLoading(true)
    setAdminReportError('')

    try {
      const response = await getMonthlyReport(reportMonth)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải báo cáo tháng từ hệ thống.')
      }

      setAdminReportData(result.data || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải báo cáo tháng từ hệ thống.'
      setAdminReportError(message)
      setAdminReportData(null)
      console.warn('ADMIN_MONTHLY_REPORT_LOAD_FAILED', message)
    } finally {
      setAdminReportLoading(false)
    }
  }

  useEffect(() => {
    loadAdminMonthlyReport()
  }, [reportMonth])

  const reportData = (() => {
    const appointmentsInMonth = appointments.filter((appointment) =>
      isInReportMonth(appointment.NgayKham),
    )
    const completedAppointments = appointmentsInMonth
      .filter((appointment) => isCompletedVisitStatus(appointment.TrangThai))
      .map((appointment) => {
        const { config, service } = getConfigService(appointment.MaCauHinh)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          appointment.MaBenhAn,
          service.GiaGoc,
          appointment.GiaCuoi,
        )
        const doctor = doctorSchedules.find(
          (schedule) =>
            schedule.MaChiNhanh === config?.MaChiNhanh &&
            schedule.NgayTruc === appointment.NgayKham &&
            schedule.CaTruc === appointment.CaKham,
        )

        return {
          id: appointment.MaLichHen,
          type: 'Khám',
          groupLabel: 'Khám',
          maBenhAn: appointment.MaBenhAn,
          maChiNhanh: config?.MaChiNhanh || '',
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: appointment.MaBacSi || doctor?.MaBacSi || '',
          ngayPhatSinh: appointment.NgayKham,
        }
      })

    const completedLabTests = labTestDetails
      .filter((test) => test.TrangThai === 'Hoàn thành' && isInReportMonth(test.NgayThucHien))
      .map((test) => {
        const service = getService(test.MaDichVu)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          test.MaBenhAn,
          service.GiaGoc,
          test.GiaCuoi,
        )

        return {
          id: test.MaChiTietXN,
          type: 'Xét nghiệm',
          groupLabel: 'Xét nghiệm',
          maBenhAn: test.MaBenhAn,
          maChiNhanh: test.MaChiNhanh,
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: test.MaBacSi,
          ngayPhatSinh: test.NgayThucHien,
        }
      })

    const completedTreatmentSessions = treatmentRevenueDetails
      .filter(
        (treatment) =>
          treatment.TrangThai === 'Hoàn thành' && isInReportMonth(treatment.NgayThucHien),
      )
      .map((treatment) => {
        const service = getService(treatment.MaDichVu)
        const { netRevenue, insuranceAmount } = calculateRevenueParts(
          treatment.MaBenhAn,
          service.GiaGoc,
          treatment.GiaCuoi,
        )

        return {
          id: treatment.MaLichTrinh,
          type: 'Điều trị',
          groupLabel: 'Điều trị nhiều buổi',
          maBenhAn: treatment.MaBenhAn,
          maChiNhanh: treatment.MaChiNhanh,
          maDichVu: service.MaDichVu,
          tenDichVu: service.TenDichVu,
          chuyenKhoa: service.ChuyenKhoa,
          loaiDichVu: service.LoaiDichVu,
          giaGoc: service.GiaGoc,
          netRevenue,
          insuranceAmount,
          maBacSi: treatment.MaBacSi,
          ngayPhatSinh: treatment.NgayThucHien,
        }
      })

    const completedFinancialRecords = [
      ...completedAppointments,
      ...completedLabTests,
      ...completedTreatmentSessions,
    ]
    const totalNetRevenue = completedFinancialRecords.reduce(
      (sum, record) => sum + record.netRevenue,
      0,
    )
    const totalInsuranceAmount = completedFinancialRecords.reduce(
      (sum, record) => sum + record.insuranceAmount,
      0,
    )
    const cancelledAppointments = appointmentsInMonth.filter((appointment) =>
      appointment.TrangThai.includes('Đã hủy'),
    ).length
    const cancellationRate =
      appointmentsInMonth.length > 0
        ? Math.round((cancelledAppointments / appointmentsInMonth.length) * 1000) / 10
        : 0

    const branchRows = branches.map((branch) => {
      const branchRecords = completedFinancialRecords.filter(
        (record) => record.maChiNhanh === branch.MaChiNhanh,
      )
      const branchCompletedAppointments = completedAppointments.filter(
        (record) => record.maChiNhanh === branch.MaChiNhanh,
      )

      return {
        maChiNhanh: branch.MaChiNhanh,
        tenChiNhanh: branch.TenChiNhanh,
        completedCount: branchCompletedAppointments.length,
        netRevenue: branchRecords.reduce((sum, record) => sum + record.netRevenue, 0),
        insuranceAmount: branchRecords.reduce((sum, record) => sum + record.insuranceAmount, 0),
      }
    })

    const rankBy = (records, keyGetter, valueGetter) => {
      const map = new Map()

      records.forEach((record) => {
        const key = keyGetter(record)
        if (!key) return

        const current = map.get(key) || { key, count: 0, value: 0, sample: record }
        map.set(key, {
          ...current,
          count: current.count + 1,
          value: current.value + valueGetter(record),
        })
      })

      return Array.from(map.values()).sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value
        return b.count - a.count
      })
    }

    const serviceContributionRows = rankBy(
      completedFinancialRecords,
      (record) => record.maDichVu,
      (record) => record.netRevenue,
    ).map((item) => ({
      ...item,
      tenDichVu: item.sample.tenDichVu,
      loaiDichVu: item.sample.groupLabel,
    }))
    const doctorRows = rankBy(
      completedAppointments,
      (record) => record.maBacSi,
      () => 1,
    ).map((item) => {
      const doctor = staffList.find((staff) => staff.MaNhanSu === item.key)
      return {
        ...item,
        hoTen: doctor?.HoTen || 'Chưa phân công',
        chuyenKhoa: doctor?.ChuyenKhoa || 'Chưa rõ',
      }
    })

    return {
      totalNetRevenue,
      totalInsuranceAmount,
      completedAppointmentCount: completedAppointments.length,
      cancellationRate,
      totalServiceUsage: completedFinancialRecords.length,
      branchRows,
      doctorRows,
      serviceContributionRows,
    }
  })()

  const displayReportData = {
    ...reportData,
    ...(adminReportData || {}),
    branchRows: adminReportData?.branchRows || reportData.branchRows,
    doctorRows: adminReportData?.doctorRows || reportData.doctorRows,
    serviceContributionRows:
      adminReportData?.serviceContributionRows || reportData.serviceContributionRows,
  }

  const filteredBranchServices = branchServices.filter((config) => {
    const service = getService(config.MaDichVu)
    const matchedBranch =
      serviceFilters.MaChiNhanh === 'all' || config.MaChiNhanh === serviceFilters.MaChiNhanh
    const matchedType =
      serviceFilters.LoaiDichVu === 'all' || service.LoaiDichVu === serviceFilters.LoaiDichVu

    return matchedBranch && matchedType
  })

  const getDoctorName = (maBacSi) =>
    staffList.find((staff) => staff.MaNhanSu === maBacSi)?.HoTen || maBacSi

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const handleSaveSlot = async (maCauHinh) => {
    const nextSlot = Math.max(0, Number(slotDrafts[maCauHinh] || 0))
    try {
      const saved = await updateBranchService(identityAccessToken, maCauHinh, { SlotGioiHan: nextSlot })
      setBranchServices((current) => current.map((config) => config.MaCauHinh === maCauHinh ? saved : config))
      setSlotDrafts((current) => ({ ...current, [maCauHinh]: String(saved.SlotGioiHan) }))
      notify(`Đã lưu giới hạn slot cho ${maCauHinh}.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleUpdateServicePrice = async (maDichVu) => {
    const nextPrice = Math.max(0, Number(priceDrafts[maDichVu] || 0))
    try {
      const saved = await saveServicePrice(identityAccessToken, maDichVu, nextPrice)
      setServices((current) => current.map((service) => service.MaDichVu === maDichVu ? saved : service))
      setPriceDrafts((current) => ({ ...current, [maDichVu]: String(saved.GiaGoc) }))
      notify(`Đã lưu giá dịch vụ ${maDichVu}.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleNewServiceFormChange = (field, value) => {
    setNewServiceForm((current) => ({ ...current, [field]: value }))
  }

  const handleAddService = async (event) => {
    event.preventDefault()
    const maDichVu = newServiceForm.MaDichVu.trim().toUpperCase()
    const tenDichVu = newServiceForm.TenDichVu.trim()
    const giaGoc = Math.max(0, Number(newServiceForm.GiaGoc || 0))

    if (!maDichVu || !tenDichVu || giaGoc <= 0) {
      notify('Vui lòng nhập đầy đủ mã dịch vụ, tên dịch vụ và giá gốc lớn hơn 0.', 'error')
      return
    }

    if (services.some((service) => service.MaDichVu === maDichVu)) {
      notify(`Mã dịch vụ ${maDichVu} đã tồn tại trong danh mục.`, 'error')
      return
    }

    const newService = {
      MaDichVu: maDichVu,
      TenDichVu: tenDichVu,
      ChuyenKhoa: newServiceForm.ChuyenKhoa,
      LoaiDichVu: newServiceForm.LoaiDichVu,
      GiaGoc: giaGoc,
    }

    try {
      const saved = await createRegistryService(identityAccessToken, newService)
      setServices((current) => [...current, saved])
      setPriceDrafts((current) => ({ ...current, [maDichVu]: String(saved.GiaGoc) }))
      setDistributionForm((current) => ({ ...current, MaDichVu: maDichVu }))
      setNewServiceForm({
        MaDichVu: '', TenDichVu: '', LoaiDichVu: 'Khám lâm sàng', ChuyenKhoa: 'Nội tổng quát', GiaGoc: '',
      })
      notify(`Đã lưu dịch vụ ${maDichVu} vào Registry.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleBranchFormChange = (field, value) => {
    setBranchForm((current) => ({ ...current, [field]: value }))
  }

  const handleAddBranch = async (event) => {
    event.preventDefault()
    const maChiNhanh = branchForm.MaChiNhanh.trim().toUpperCase()
    const tenChiNhanh = branchForm.TenChiNhanh.trim()
    const diaChi = branchForm.DiaChi.trim()

    if (!maChiNhanh || !tenChiNhanh || !diaChi) {
      notify('Vui lòng nhập đầy đủ mã chi nhánh, tên chi nhánh và địa chỉ.', 'error')
      return
    }

    if (branches.some((branch) => branch.MaChiNhanh === maChiNhanh)) {
      notify(`Mã chi nhánh ${maChiNhanh} đã tồn tại.`, 'error')
      return
    }

    const newBranch = {
      MaChiNhanh: maChiNhanh,
      TenChiNhanh: tenChiNhanh,
      DiaChi: diaChi,
      SDT: branchForm.SDT.trim(),
    }

    try {
      const saved = await createBranch(identityAccessToken, newBranch)
      setBranches((current) => [...current, saved])
      setDistributionForm((current) => ({ ...current, MaChiNhanh: maChiNhanh }))
      setBranchForm({ MaChiNhanh: '', TenChiNhanh: '', DiaChi: '', SDT: '' })
      notify(`Đã lưu chi nhánh ${maChiNhanh} vào Registry.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleDistributionFormChange = (field, value) => {
    setDistributionForm((current) => ({ ...current, [field]: value }))
  }

  const buildBranchServiceCode = (maChiNhanh, maDichVu) => {
    const branchSuffix = maChiNhanh.replace('CN_', '')
    const serviceSuffix = maDichVu.replace('DV_', '').replace('DT_', '').replace('XN_', '')
    return `CH_${branchSuffix}_${serviceSuffix}`.replaceAll('__', '_')
  }

  const handleApplyBranchService = async (event) => {
    event.preventDefault()
    if (!distributionForm.MaChiNhanh || !distributionForm.MaDichVu) {
      notify('Cần có ít nhất một chi nhánh và một dịch vụ để áp dụng cấu hình.', 'error')
      return
    }

    const slot = Math.max(0, Number(distributionForm.SlotGioiHan || 0))
    const existingConfig = branchServices.find(
      (config) =>
        config.MaChiNhanh === distributionForm.MaChiNhanh &&
        config.MaDichVu === distributionForm.MaDichVu,
    )

    const maCauHinh = existingConfig?.MaCauHinh || buildBranchServiceCode(distributionForm.MaChiNhanh, distributionForm.MaDichVu)
    const newConfig = {
      MaCauHinh: maCauHinh,
      MaChiNhanh: distributionForm.MaChiNhanh,
      MaDichVu: distributionForm.MaDichVu,
      SlotGioiHan: slot,
      TrangThai: 'active',
    }

    try {
      const saved = await saveBranchService(identityAccessToken, newConfig)
      setBranchServices((current) => existingConfig
        ? current.map((config) => config.MaCauHinh === maCauHinh ? saved : config)
        : [...current, saved])
      setSlotDrafts((current) => ({ ...current, [maCauHinh]: String(saved.SlotGioiHan) }))
      notify(`Đã lưu cấu hình ${maCauHinh} vào Registry.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleToggleBranchService = async (maCauHinh) => {
    const target = branchServices.find((config) => config.MaCauHinh === maCauHinh)
    const nextStatus = target?.TrangThai === 'active' ? 'inactive' : 'active'
    try {
      const saved = await updateBranchService(identityAccessToken, maCauHinh, { TrangThai: nextStatus })
      setBranchServices((current) => current.map((config) => config.MaCauHinh === maCauHinh ? saved : config))
      notify(nextStatus === 'active' ? `Đã hiện lại ${maCauHinh}.` : `Đã ẩn ${maCauHinh}.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const handleBulkScheduleFormChange = (field, value) => {
    setBulkScheduleForm((current) => ({ ...current, [field]: value }))
  }

  const handleScheduleFilterChange = (field, value) => {
    setScheduleFilters((current) => ({ ...current, [field]: value }))
  }

  const getScheduleSelectionKey = (thu, ca) => `${thu}-${ca}`

  const normalizeAdminSchedule = (schedule) => ({
    id: schedule.id ?? null,
    MaLichTruc: schedule.MaLichTruc,
    MaBacSi: schedule.MaBacSi,
    TenBacSi: schedule.TenBacSi || '',
    MaChiNhanh: schedule.MaChiNhanh,
    TenChiNhanh: schedule.TenChiNhanh || '',
    NgayTruc: schedule.NgayTruc,
    CaTruc: Number(schedule.CaTruc),
    TrangThai: schedule.TrangThai || 'Đang hoạt động',
    SoLichHenDangCo: Number(schedule.SoLichHenDangCo || 0),
    SDT: schedule.SDT || '',
    ChuyenKhoa: schedule.ChuyenKhoa || '',
  })

  const isSameDoctorSchedule = (leftSchedule, rightSchedule) => {
    if (!leftSchedule || !rightSchedule) return false

    if (leftSchedule.id && rightSchedule.id) {
      return Number(leftSchedule.id) === Number(rightSchedule.id)
    }

    return (
      leftSchedule.MaLichTruc === rightSchedule.MaLichTruc &&
      leftSchedule.MaBacSi === rightSchedule.MaBacSi &&
      leftSchedule.MaChiNhanh === rightSchedule.MaChiNhanh &&
      leftSchedule.NgayTruc === rightSchedule.NgayTruc &&
      Number(leftSchedule.CaTruc) === Number(rightSchedule.CaTruc)
    )
  }

  const loadAdminDoctorSchedules = async () => {
    setAdminScheduleLoading(true)
    setAdminScheduleError('')

    const params = new URLSearchParams()
    if (scheduleFilters.TuNgay) params.set('from_date', scheduleFilters.TuNgay)
    if (scheduleFilters.DenNgay) params.set('to_date', scheduleFilters.DenNgay)
    if (scheduleFilters.MaBacSi !== 'all') params.set('ma_bac_si', scheduleFilters.MaBacSi)

    try {
      const result = await listDoctorSchedules(params.toString())
      setDoctorSchedules(result.map(normalizeAdminSchedule))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch trực từ database.'
      setAdminScheduleError(message)
      setDoctorSchedules([])
      console.warn('ADMIN_SCHEDULE_LOAD_FAILED', message)
    } finally {
      setAdminScheduleLoading(false)
    }
  }

  const handleToggleScheduleSelection = (thu, ca) => {
    const key = getScheduleSelectionKey(thu, ca)
    setBulkScheduleForm((current) => ({
      ...current,
      selections: {
        ...current.selections,
        [key]: !current.selections[key],
      },
    }))
  }

  const parseDateInput = (value) => new Date(`${value}T00:00:00`)

  const formatDateInput = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const handleBulkAssignSchedule = async (event) => {
    event.preventDefault()
    const activeDoctor = doctors.some((doctor) => doctor.MaNhanSu === bulkScheduleForm.MaBacSi)
    const selectedKeys = Object.entries(bulkScheduleForm.selections)
      .filter(([, selected]) => selected)
      .map(([key]) => key)

    if (!activeDoctor) {
      notify('Chỉ có thể xếp lịch cho bác sĩ đang active.', 'error')
      return
    }

    if (!bulkScheduleForm.MaChiNhanh) {
      notify('Vui lòng chọn chi nhánh trước khi xếp lịch.', 'error')
      return
    }

    if (!bulkScheduleForm.TuNgay || !bulkScheduleForm.DenNgay) {
      notify('Vui lòng chọn đầy đủ khoảng ngày.', 'error')
      return
    }

    if (selectedKeys.length === 0) {
      notify('Vui lòng tích ít nhất một ô Thứ/Ca trong ma trận lịch trực.', 'error')
      return
    }

    const startDate = parseDateInput(bulkScheduleForm.TuNgay)
    const endDate = parseDateInput(bulkScheduleForm.DenNgay)

    if (startDate > endDate) {
      notify('Khoảng ngày không hợp lệ: Từ ngày phải nhỏ hơn hoặc bằng Đến ngày.', 'error')
      return
    }

    const existingKeys = new Set(
      doctorSchedules
        .filter((schedule) => schedule.TrangThai !== 'Đã hủy')
        .map(
          (schedule) =>
            `${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`,
        ),
    )
    const newSchedules = []

    for (
      const cursor = new Date(startDate);
      cursor <= endDate;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const weekday = cursor.getDay() === 0 ? 1 : cursor.getDay() + 1
      const ngayTruc = formatDateInput(cursor)

      for (let ca = 1; ca <= 4; ca += 1) {
        const selected = selectedKeys.includes(getScheduleSelectionKey(weekday, ca))
        const duplicateKey = `${bulkScheduleForm.MaBacSi}-${bulkScheduleForm.MaChiNhanh}-${ngayTruc}-${ca}`

        if (selected && !existingKeys.has(duplicateKey)) {
          newSchedules.push({
            MaBacSi: bulkScheduleForm.MaBacSi,
            MaChiNhanh: bulkScheduleForm.MaChiNhanh,
            NgayTruc: ngayTruc,
            CaTruc: ca,
          })
          existingKeys.add(duplicateKey)
        }
      }
    }

    if (newSchedules.length === 0) {
      notify('Không có lịch trực mới được tạo vì toàn bộ lựa chọn đã trùng lịch hiện có.', 'error')
      return
    }

    try {
      const createdSchedules = await createDoctorSchedules(identityAccessToken, newSchedules)
      await loadAdminDoctorSchedules()
      notify(`Đã xếp ${createdSchedules.length} ca trực mới cho ${getDoctorName(bulkScheduleForm.MaBacSi)}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xếp lịch trực vào database.'
      notify(message, 'error')
    }
  }

  const handleCancelSchedule = async (schedule) => {
    const affectedAppointments = getAffectedAppointmentsForSchedule(schedule)
    const affectedCount = Number(schedule.SoLichHenDangCo ?? affectedAppointments.length)
    const affectedAppointmentIds = new Set(affectedAppointments.map((appointment) => appointment.MaLichHen))

    if (affectedCount > 0) {
      const confirmed = window.confirm(
        `Ca trực này đang có ${affectedCount} lịch hẹn chưa hoàn thành. Bạn có chắc chắn muốn hủy ca trực này và tự động hoàn tiền cho bệnh nhân?`,
      )

      if (!confirmed) {
        return
      }
    }

    try {
      const response = await cancelDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể hủy ca trực.')
      }

      setAppointments((current) =>
        current.map((appointment) =>
          affectedAppointmentIds.has(appointment.MaLichHen)
            ? { ...appointment, TrangThai: 'Đã hủy' }
            : appointment,
        ),
      )

      setDoctorSchedules((current) =>
        current.map((item) =>
          isSameDoctorSchedule(item, schedule)
            ? { ...item, TrangThai: 'Đã hủy', SoLichHenDangCo: 0 }
            : item,
        ),
      )

      const affectedPatients = result.data?.affectedPatients || []
      addPatientNotifications?.(affectedPatients)

      addScheduleAdjustment?.({
        type: 'cancel',
        MaLichTruc: schedule.MaLichTruc,
        MaBacSi: schedule.MaBacSi,
        MaChiNhanh: schedule.MaChiNhanh,
        NgayTruc: schedule.NgayTruc,
        CaTruc: schedule.CaTruc,
      })

      notify(
        affectedPatients.length > 0
          ? `Đã hủy ca trực và phát thông báo cảnh báo đến ${affectedPatients.length} bệnh nhân bị ảnh hưởng!`
          : `Đã hủy ca trực ${schedule.MaLichTruc}.`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hủy ca trực.'
      notify(message, 'error')
    }
  }

  const getTransferDoctorOptions = (schedule) => {
    if (!schedule) return []

    const currentDoctor = staffList.find((staff) => staff.MaNhanSu === schedule.MaBacSi)
    const sameSpecialtyDoctors = staffList.filter(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        staff.TrangThai === 'active' &&
        staff.MaNhanSu !== schedule.MaBacSi &&
        staff.ChuyenKhoa === currentDoctor?.ChuyenKhoa,
    )

    if (sameSpecialtyDoctors.length > 0) return sameSpecialtyDoctors

    return staffList.filter(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        staff.TrangThai === 'active' &&
        staff.MaNhanSu !== schedule.MaBacSi,
    )
  }

  const handleOpenDoctorTransfer = (schedule) => {
    const options = getTransferDoctorOptions(schedule)
    setDoctorTransferModal({
      show: true,
      schedule,
      nextDoctorId: options[0]?.MaNhanSu || '',
    })
  }

  const handleCloseDoctorTransfer = () => {
    setDoctorTransferModal({ show: false, schedule: null, nextDoctorId: '' })
  }

  const handleConfirmDoctorTransfer = async () => {
    const schedule = doctorTransferModal.schedule
    const nextDoctorId = doctorTransferModal.nextDoctorId

    if (!schedule || !nextDoctorId) {
      notify('Vui lòng chọn bác sĩ mới để điều chuyển ca trực.', 'error')
      return
    }

    const nextDoctor = staffList.find((staff) => staff.MaNhanSu === nextDoctorId)
    const affectedAppointments = getAffectedAppointmentsForSchedule(schedule)
    const affectedAppointmentIds = new Set(affectedAppointments.map((appointment) => appointment.MaLichHen))

    try {
      const response = await transferDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
          newMaBacSi: nextDoctorId,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể điều chuyển bác sĩ trực.')
      }

      setDoctorSchedules((current) =>
        current.map((item) =>
          isSameDoctorSchedule(item, schedule)
            ? {
                ...item,
                ...normalizeAdminSchedule(result.data?.schedule || {}),
                MaBacSi: nextDoctorId,
                TenBacSi: nextDoctor?.HoTen || result.data?.schedule?.TenBacSi || nextDoctorId,
              }
            : item,
        ),
      )
      setAppointments((current) =>
        current.map((appointment) =>
          affectedAppointmentIds.has(appointment.MaLichHen)
            ? { ...appointment, MaBacSi: nextDoctorId }
            : appointment,
        ),
      )

      const affectedPatients = result.data?.affectedPatients || []
      addPatientNotifications?.(affectedPatients)

      addScheduleAdjustment?.({
        type: 'transfer',
        MaLichTruc: schedule.MaLichTruc,
        oldMaBacSi: schedule.MaBacSi,
        newMaBacSi: nextDoctorId,
        MaChiNhanh: schedule.MaChiNhanh,
        NgayTruc: schedule.NgayTruc,
        CaTruc: schedule.CaTruc,
      })

      handleCloseDoctorTransfer()
      notify(
        `Đã điều chuyển bác sĩ trực và phát thông báo cảnh báo đến ${affectedPatients.length} bệnh nhân bị ảnh hưởng!`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể điều chuyển bác sĩ trực.'
      notify(message, 'error')
    }
  }

  const renderStaffManagement = () => (
    <div className="admin-stack">
      <IdentityStaffAccounts accessToken={identityAccessToken} showNotification={showNotification} onChanged={() => setStaffReload((value) => value + 1)} />
      {staffLoadError && <p role="alert" className="admin-feedback">{staffLoadError}</p>}
      <section className="admin-card">
        <div className="admin-section-header">
          <div>
            <h2>Danh sách bệnh nhân</h2>
            <p>Hồ sơ thật từ Registry. Họ tên và số điện thoại sẽ hiện sau khi bệnh nhân cập nhật hồ sơ.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={() => { setPatientLoading(true); setPatientReload((value) => value + 1) }} disabled={patientLoading}>
            Làm mới
          </button>
        </div>
        <label className="admin-search-field">
          <span>Tìm kiếm bệnh nhân</span>
          <input
            className="admin-input"
            value={patientSearch}
            onChange={(event) => { setPatientLoading(true); setPatientSearch(event.target.value); setPatientPage(0) }}
            placeholder="Tìm theo CCCD, họ tên hoặc số điện thoại"
            maxLength={100}
          />
        </label>
        {patientError && <p className="admin-feedback" role="alert">{patientError}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Họ tên</th>
                <th>Số CCCD</th>
                <th>Số điện thoại</th>
                <th>Ngày sinh</th>
              </tr>
            </thead>
            <tbody>
              {!patientLoading && !patientError && patients.map((patient) => (
                <tr key={patient.id}>
                  <td title={patient.id}>{patient.id.slice(0, 8)}…</td>
                  <td>{patient.full_name || 'Chưa cập nhật'}</td>
                  <td>{patient.cccd}</td>
                  <td>{patient.phone || 'Chưa cập nhật'}</td>
                  <td>{patient.date_of_birth || 'Chưa cập nhật'}</td>
                </tr>
              ))}
              {(patientLoading || patientError || patients.length === 0) && (
                <tr>
                  <td colSpan="5">{patientLoading ? 'Đang tải bệnh nhân...' : patientError ? 'Không thể tải danh sách. Hãy thử làm mới.' : 'Không tìm thấy bệnh nhân phù hợp.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!patientError && patientTotal > 0 && (
          <div className="admin-patient-pagination">
            <span>Hiển thị {patientPage * PATIENT_PAGE_SIZE + 1}–{Math.min((patientPage + 1) * PATIENT_PAGE_SIZE, patientTotal)} / {patientTotal} bệnh nhân</span>
            <div className="admin-actions-row">
              <button type="button" className="admin-secondary-button" disabled={patientLoading || patientPage === 0} onClick={() => { setPatientLoading(true); setPatientPage((page) => page - 1) }}>Trang trước</button>
              <button type="button" className="admin-secondary-button" disabled={patientLoading || (patientPage + 1) * PATIENT_PAGE_SIZE >= patientTotal} onClick={() => { setPatientLoading(true); setPatientPage((page) => page + 1) }}>Trang sau</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )

  const renderServiceConfig = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <h2>Quản lý giá danh mục dịch vụ</h2>
        <p>Giá gốc nằm tại bảng DICH_VU. Khi cập nhật tại đây, mọi chi nhánh đang phân phối dịch vụ sẽ dùng cùng mức giá mới.</p>

        <form className="admin-form-grid admin-form-grid-wide" onSubmit={handleAddService}>
          <label>
            Mã dịch vụ mới
            <input
              className="admin-input"
              value={newServiceForm.MaDichVu}
              onChange={(event) => handleNewServiceFormChange('MaDichVu', event.target.value)}
              placeholder="VD: DV_KHAM_DA_LIEU"
              required
            />
          </label>
          <label>
            Tên dịch vụ
            <input
              className="admin-input"
              value={newServiceForm.TenDichVu}
              onChange={(event) => handleNewServiceFormChange('TenDichVu', event.target.value)}
              placeholder="Nhập tên dịch vụ"
              required
            />
          </label>
          <label>
            Loại dịch vụ
            <select
              className="admin-input"
              value={newServiceForm.LoaiDichVu}
              onChange={(event) => handleNewServiceFormChange('LoaiDichVu', event.target.value)}
            >
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chuyên khoa
            <select
              className="admin-input"
              value={newServiceForm.ChuyenKhoa}
              onChange={(event) => handleNewServiceFormChange('ChuyenKhoa', event.target.value)}
            >
              {serviceDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giá gốc ban đầu
            <input
              className="admin-input"
              type="number"
              min="0"
              step="1000"
              value={newServiceForm.GiaGoc}
              onChange={(event) => handleNewServiceFormChange('GiaGoc', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm dịch vụ
          </button>
        </form>

        <label className="admin-search-field">
          <span>Tìm kiếm dịch vụ</span>
          <input
            className="admin-input"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
            placeholder="Tìm theo mã, tên, loại dịch vụ hoặc chuyên khoa"
          />
        </label>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã dịch vụ</th>
                <th>Tên dịch vụ</th>
                <th>Loại dịch vụ</th>
                <th>Chuyên khoa</th>
                <th>Giá dịch vụ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.MaDichVu}>
                  <td>{service.MaDichVu}</td>
                  <td>{service.TenDichVu}</td>
                  <td>{service.LoaiDichVu}</td>
                  <td>{service.ChuyenKhoa}</td>
                  <td>
                    <input
                      className="admin-money-input"
                      type="number"
                      min="0"
                      step="1000"
                      value={priceDrafts[service.MaDichVu]}
                      onChange={(event) =>
                        setPriceDrafts((current) => ({
                          ...current,
                          [service.MaDichVu]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div className="admin-actions-row">
                      <button
                        type="button"
                        className="admin-primary-button compact"
                        onClick={() => handleUpdateServicePrice(service.MaDichVu)}
                      >
                        Cập nhật giá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan="6">Không tìm thấy dịch vụ phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Quản lý danh sách Chi nhánh</h2>
        <p>Theo dõi các cơ sở đang vận hành và thêm chi nhánh mới khi phòng khám mở rộng.</p>

        <form className="admin-form-grid" onSubmit={handleAddBranch}>
          <label>
            Mã chi nhánh
            <input
              className="admin-input"
              value={branchForm.MaChiNhanh}
              onChange={(event) => handleBranchFormChange('MaChiNhanh', event.target.value)}
              placeholder="VD: CN_DD"
              required
            />
          </label>
          <label>
            Tên chi nhánh
            <input
              className="admin-input"
              value={branchForm.TenChiNhanh}
              onChange={(event) => handleBranchFormChange('TenChiNhanh', event.target.value)}
              placeholder="Medicare - Cơ sở ..."
              required
            />
          </label>
          <label>
            Địa chỉ
            <input
              className="admin-input"
              value={branchForm.DiaChi}
              onChange={(event) => handleBranchFormChange('DiaChi', event.target.value)}
              placeholder="Nhập địa chỉ chi nhánh"
              required
            />
          </label>
          <label>
            Số điện thoại
            <input
              className="admin-input"
              value={branchForm.SDT}
              onChange={(event) => handleBranchFormChange('SDT', event.target.value)}
              placeholder="Nhập số điện thoại"
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm chi nhánh
          </button>
        </form>

        <div className="admin-branch-grid">
          {branches.map((branch) => (
            <div className="admin-branch-card" key={branch.MaChiNhanh}>
              <strong>{branch.MaChiNhanh}</strong>
              <span>{branch.TenChiNhanh}</span>
              <small>{branch.DiaChi}</small>
              <small>{branch.SDT || 'Chưa có số điện thoại'}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h2>Phân phối & Cấu hình Slot theo Chi nhánh</h2>
        <p>Bảng CHI_NHANH_DICH_VU chỉ quản lý dịch vụ đang được bật tại từng cơ sở, SlotGioiHan và trạng thái ẩn/hiện.</p>

        <form className="admin-form-grid" onSubmit={handleApplyBranchService}>
          <label>
            Chi nhánh
            <select
              className="admin-input"
              value={distributionForm.MaChiNhanh}
              onChange={(event) => handleDistributionFormChange('MaChiNhanh', event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                  {branch.TenChiNhanh}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dịch vụ
            <select
              className="admin-input"
              value={distributionForm.MaDichVu}
              onChange={(event) => handleDistributionFormChange('MaDichVu', event.target.value)}
            >
              {services.map((service) => (
                <option key={service.MaDichVu} value={service.MaDichVu}>
                  {service.MaDichVu} - {service.TenDichVu} ({formatMoney(service.GiaGoc)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Slot giới hạn
            <input
              className="admin-input"
              type="number"
              min="0"
              value={distributionForm.SlotGioiHan}
              onChange={(event) => handleDistributionFormChange('SlotGioiHan', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Áp dụng cho chi nhánh
          </button>
        </form>

        <div className="admin-price-preview">
          Giá chuẩn hiện tại:{' '}
          <strong>{formatMoney(getService(distributionForm.MaDichVu).GiaGoc)}</strong>
        </div>

        <div className="admin-filter-row">
          <label>
            Lọc theo Chi nhánh
            <select
              className="admin-input"
              value={serviceFilters.MaChiNhanh}
              onChange={(event) =>
                setServiceFilters((current) => ({ ...current, MaChiNhanh: event.target.value }))
              }
            >
              <option value="all">Tất cả</option>
              {branches.map((branch) => (
                <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                  {branch.TenChiNhanh.replace('Medicare - Cơ sở ', '')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lọc theo Loại dịch vụ
            <select
              className="admin-input"
              value={serviceFilters.LoaiDichVu}
              onChange={(event) =>
                setServiceFilters((current) => ({ ...current, LoaiDichVu: event.target.value }))
              }
            >
              <option value="all">Tất cả</option>
              <option value="Khám lâm sàng">Khám lâm sàng</option>
              <option value="Xét nghiệm">Xét nghiệm</option>
              <option value="Điều trị">Điều trị</option>
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>Tên dịch vụ</th>
                <th>Loại dịch vụ</th>
                <th>Giá hiện tại</th>
                <th>Slot giới hạn</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranchServices.map((config) => {
                const service = getService(config.MaDichVu)
                return (
                  <tr key={config.MaCauHinh}>
                    <td>{getBranchName(config.MaChiNhanh)}</td>
                    <td>{service.TenDichVu}</td>
                    <td>{service.LoaiDichVu}</td>
                    <td>{formatMoney(service.GiaGoc)}</td>
                    <td>
                      <input
                        className="admin-slot-input"
                        type="number"
                        min="0"
                        value={slotDrafts[config.MaCauHinh]}
                        onChange={(event) =>
                          setSlotDrafts((current) => ({
                            ...current,
                            [config.MaCauHinh]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>
                      <span className={`status-pill ${config.TrangThai === 'active' ? 'active' : 'muted'}`}>
                        {config.TrangThai === 'active' ? 'Đang hiện' : 'Đang ẩn'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions-row">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => handleSaveSlot(config.MaCauHinh)}
                        >
                          Lưu Slot
                        </button>
                        <button
                          type="button"
                          className={
                            config.TrangThai === 'active'
                              ? 'admin-danger-button'
                              : 'admin-success-button'
                          }
                          onClick={() => handleToggleBranchService(config.MaCauHinh)}
                        >
                          {config.TrangThai === 'active' ? 'Ẩn' : 'Hiện'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredBranchServices.length === 0 && (
                <tr>
                  <td colSpan="7">Không có cấu hình dịch vụ phù hợp với bộ lọc hiện tại.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )

  const renderSchedules = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <h2>Xếp lịch trực hàng loạt</h2>
        <p>Chọn bác sĩ, chi nhánh, khoảng ngày và ma trận Thứ/Ca để sinh lịch trực tự động.</p>

        <form className="admin-schedule-form" onSubmit={handleBulkAssignSchedule}>
          <div className="admin-form-grid">
            <label>
              Bác sĩ
              <select
                className="admin-input"
                value={bulkScheduleForm.MaBacSi}
                onChange={(event) => handleBulkScheduleFormChange('MaBacSi', event.target.value)}
              >
                {doctors.map((doctor) => (
                  <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                    {doctor.MaNhanSu} - {doctor.HoTen}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chi nhánh
              <select
                className="admin-input"
                value={bulkScheduleForm.MaChiNhanh}
                onChange={(event) => handleBulkScheduleFormChange('MaChiNhanh', event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày
              <input
                className="admin-input"
                type="date"
                value={bulkScheduleForm.TuNgay}
                onChange={(event) => handleBulkScheduleFormChange('TuNgay', event.target.value)}
                required
              />
            </label>
            <label>
              Đến ngày
              <input
                className="admin-input"
                type="date"
                value={bulkScheduleForm.DenNgay}
                onChange={(event) => handleBulkScheduleFormChange('DenNgay', event.target.value)}
                required
              />
            </label>
          </div>

          <div className="schedule-matrix-wrap">
            <div className="schedule-matrix">
              <div className="schedule-matrix-cell header">Ca / Thứ</div>
              {[2, 3, 4, 5, 6, 7, 1].map((weekday) => (
                <div className="schedule-matrix-cell header" key={weekday}>
                  {weekday === 1 ? 'Chủ Nhật' : `Thứ ${weekday}`}
                </div>
              ))}
              {[1, 2, 3, 4].map((shift) => (
                <div className="schedule-matrix-row" key={shift}>
                  <div className="schedule-matrix-cell shift-label">Ca {shift}</div>
                  {[2, 3, 4, 5, 6, 7, 1].map((weekday) => {
                    const key = getScheduleSelectionKey(weekday, shift)
                    return (
                      <label className="schedule-checkbox-cell" key={key}>
                        <input
                          type="checkbox"
                          checked={Boolean(bulkScheduleForm.selections[key])}
                          onChange={() => handleToggleScheduleSelection(weekday, shift)}
                        />
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="admin-primary-button">
            Xếp lịch hàng loạt
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Danh sách lịch trực</h2>
        {adminScheduleLoading && <p className="admin-muted-text">Đang tải lịch trực từ database...</p>}
        {adminScheduleError && <p className="auth-catalog-error">{adminScheduleError}</p>}
        <div className="admin-filter-row">
          <label>
            Từ ngày
            <input
              className="admin-input"
              type="date"
              value={scheduleFilters.TuNgay}
              onChange={(event) => handleScheduleFilterChange('TuNgay', event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              className="admin-input"
              type="date"
              value={scheduleFilters.DenNgay}
              onChange={(event) => handleScheduleFilterChange('DenNgay', event.target.value)}
            />
          </label>
          <label>
            Lọc theo Bác sĩ
            <select
              className="admin-input"
              value={scheduleFilters.MaBacSi}
              onChange={(event) => handleScheduleFilterChange('MaBacSi', event.target.value)}
            >
              <option value="all">Tất cả bác sĩ</option>
              {doctors.map((doctor) => (
                <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                  {doctor.MaNhanSu} - {doctor.HoTen}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Bác sĩ</th>
                <th>Chi nhánh</th>
                <th>Ngày</th>
                <th>Ca trực</th>
                <th>Số lịch hẹn đang có</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctorSchedules.map((schedule) => {
                const isCancelled = schedule.TrangThai === 'Đã hủy'
                return (
                  <tr key={schedule.id ? `schedule-${schedule.id}` : `${schedule.MaLichTruc}-${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`}>
                    <td>{getDoctorName(schedule.MaBacSi)}</td>
                    <td>{getBranchName(schedule.MaChiNhanh)}</td>
                    <td>{schedule.NgayTruc}</td>
                    <td>Ca {schedule.CaTruc}</td>
                    <td>Chưa liên kết Appointment</td>
                    <td>
                      <span className={`status-pill ${isCancelled ? 'danger' : 'active'}`}>
                        {isCancelled ? 'Đã hủy' : 'Đang hoạt động'}
                      </span>
                    </td>
                    <td>Chưa hỗ trợ hủy/chuyển ca</td>
                  </tr>
                )
              })}
              {filteredDoctorSchedules.length === 0 && (
                <tr>
                  <td colSpan="7">Không có lịch trực phù hợp với bộ lọc hiện tại.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {doctorTransferModal.show && (
        <div className="admin-modal-overlay">
          <section className="admin-transfer-modal">
            <button
              type="button"
              className="admin-modal-close"
              onClick={handleCloseDoctorTransfer}
              aria-label="Đóng modal điều chuyển bác sĩ"
            >
              ×
            </button>
            <span className="admin-section-kicker">Điều chuyển nhân sự</span>
            <h2>Điều chuyển nhân sự ca trực</h2>
            <div className="transfer-summary-grid">
              <div>
                <span>Ngày trực</span>
                <strong>{doctorTransferModal.schedule?.NgayTruc}</strong>
              </div>
              <div>
                <span>Ca trực</span>
                <strong>Ca {doctorTransferModal.schedule?.CaTruc}</strong>
              </div>
              <div>
                <span>Chi nhánh</span>
                <strong>{getBranchName(doctorTransferModal.schedule?.MaChiNhanh)}</strong>
              </div>
              <div>
                <span>Bác sĩ cũ</span>
                <strong>{getDoctorName(doctorTransferModal.schedule?.MaBacSi)}</strong>
              </div>
            </div>
            <label className="transfer-select-field">
              Chọn Bác sĩ mới
              <select
                className="admin-input"
                value={doctorTransferModal.nextDoctorId}
                onChange={(event) =>
                  setDoctorTransferModal((current) => ({
                    ...current,
                    nextDoctorId: event.target.value,
                  }))
                }
              >
                {getTransferDoctorOptions(doctorTransferModal.schedule).map((doctor) => (
                  <option key={doctor.MaNhanSu} value={doctor.MaNhanSu}>
                    {doctor.MaNhanSu} - {doctor.HoTen} ({doctor.ChuyenKhoa})
                  </option>
                ))}
              </select>
            </label>
            <div className="transfer-modal-actions">
              <button type="button" className="admin-primary-button" onClick={handleConfirmDoctorTransfer}>
                Xác nhận đổi
              </button>
              <button type="button" className="admin-secondary-button" onClick={handleCloseDoctorTransfer}>
                Hủy bỏ
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )

  const renderReports = () => (
    <div className="admin-stack">
      <section className="admin-card monthly-report-header">
        <div>
          <span className="admin-section-kicker">Monthly Analytical Report</span>
          <h2>Báo cáo tài chính và vận hành theo tháng</h2>
          <p>{getReportMonthRangeLabel(reportMonth)}</p>
          {adminReportLoading && <p>Đang tải báo cáo từ cơ sở dữ liệu...</p>}
          {adminReportError && <p className="auth-catalog-error">{adminReportError}</p>}
        </div>
        <label className="month-picker-field">
          Chọn tháng báo cáo
          <input
            className="admin-input"
            type="month"
            value={reportMonth}
            onChange={(event) => setReportMonth(event.target.value || '2026-06')}
          />
        </label>
      </section>

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card revenue">
          <DollarSign size={24} />
          <span>Tổng Doanh thu Tháng</span>
          <strong>{formatMoney(displayReportData.totalNetRevenue)}</strong>
          <small>Chỉ tính dịch vụ phát sinh trong tháng đã chọn</small>
        </div>
        <div className="finance-kpi-card insurance">
          <ClipboardList size={24} />
          <span>Tổng BHYT Chi Trả</span>
          <strong>{formatMoney(displayReportData.totalInsuranceAmount)}</strong>
          <small>Phần bảo hiểm hỗ trợ bệnh nhân trong tháng</small>
        </div>
        <div className="finance-kpi-card success">
          <Activity size={24} />
          <span>Tổng Lượt Khám</span>
          <strong>{displayReportData.completedAppointmentCount}</strong>
          <small>Trạng thái Hoàn thành hoặc Đã khám trong tháng</small>
        </div>
        <div className="finance-kpi-card danger">
          <Users size={24} />
          <span>Tỷ lệ hủy hẹn trong tháng</span>
          <strong>{displayReportData.cancellationRate}%</strong>
          <small>Đối chiếu trên lịch hẹn phát sinh cùng tháng</small>
        </div>
      </div>

      <section className="admin-card">
        <h2>Hiệu suất Chi nhánh theo tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>Tổng lượt khám thành công</th>
                <th>Doanh thu thực thu</th>
                <th>Tiền bảo hiểm chi trả</th>
              </tr>
            </thead>
            <tbody>
              {displayReportData.branchRows.map((row) => (
                <tr key={row.maChiNhanh}>
                  <td>{row.tenChiNhanh}</td>
                  <td>{row.completedCount}</td>
                  <td>{formatMoney(row.netRevenue)}</td>
                  <td>{formatMoney(row.insuranceAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Bảng xếp hạng Bác sĩ Xuất sắc trong tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thứ hạng</th>
                <th>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Số ca đã khám</th>
              </tr>
            </thead>
            <tbody>
              {displayReportData.doctorRows.map((item, index) => (
                <tr key={item.key}>
                  <td>#{index + 1}</td>
                  <td>{item.hoTen}</td>
                  <td>{item.chuyenKhoa}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
              {displayReportData.doctorRows.length === 0 && (
                <tr>
                  <td colSpan="4">Chưa có bác sĩ nào phát sinh lượt khám hoàn thành trong tháng này.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Danh mục Dịch vụ đóng góp theo tháng</h2>
        <div className="ranking-grid monthly-service-grid">
          <div className="ranking-panel wide">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>Loại dịch vụ</th>
                  <th>Dịch vụ</th>
                  <th>Lượt sử dụng</th>
                  <th>Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                {displayReportData.serviceContributionRows.map((item) => (
                  <tr key={item.key}>
                    <td>{item.loaiDichVu}</td>
                    <td>{item.tenDichVu}</td>
                    <td>{item.count}</td>
                    <td>{formatMoney(item.value)}</td>
                  </tr>
                ))}
                {displayReportData.serviceContributionRows.length === 0 && (
                  <tr>
                    <td colSpan="4">Chưa có dịch vụ nào phát sinh doanh thu trong tháng này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )

  const renderContent = () => {
    if (activeMenu === 'staff') return renderStaffManagement()
    if (activeMenu === 'services') return renderServiceConfig()
    if (activeMenu === 'schedules') return renderSchedules()
    return renderReports()
  }

  const navItems = [
    { key: 'staff', label: 'Quản lý Nhân sự & Bệnh nhân', icon: Users },
    { key: 'services', label: 'Cấu hình Dịch vụ Chi nhánh', icon: Building2 },
    { key: 'schedules', label: 'Quản lý Lịch trực', icon: Calendar },
    { key: 'reports', label: 'Báo cáo Thống kê', icon: Activity },
  ]

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src={medicalLogoImage} alt="Medicare" />
          <div>
            <strong>Medicare</strong>
            <span>Admin Dashboard</span>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={`admin-nav-button ${activeMenu === item.key ? 'active' : ''}`}
                onClick={() => setActiveMenu(item.key)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-box">
            <Stethoscope size={18} />
            <div>
              <strong>{user?.name || 'Quản trị viên'}</strong>
              <span>Toàn quyền hệ thống</span>
            </div>
          </div>
          <button type="button" className="admin-logout-button" onClick={onLogout}>
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">Medicare</span>
            <h1>{navItems.find((item) => item.key === activeMenu)?.label}</h1>
          </div>
          {feedback && <p className="admin-feedback">{feedback}</p>}
        </header>

        {renderContent()}
      </section>
    </main>
  )
}
