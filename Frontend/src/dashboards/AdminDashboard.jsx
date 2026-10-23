import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Activity, Building2, Calendar, ClipboardList, DollarSign, LogOut, Stethoscope, Users } from 'lucide-react'
import medicalLogoImage from '../assets/medical-logo-cutout.png'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getFutureDateKey, getTodayDateKey } from '../shared/dates.js'
import { getAdminInvoices, getGroupedReport, getMonthlyReport, simulateAdminRefund } from '../api/billing.js'
import { listAccounts } from '../api/identity.js'
import { listPatients } from '../api/patientProfile.js'
import { createBranch, createService as createRegistryService, saveBranchService, updateBranchService, updateServicePrice as saveServicePrice, verifyPatientInsurance } from '../api/registry.js'
import { listStaffProfiles } from '../api/staffProfile.js'
import { cancelDoctorSchedules, createDoctorSchedules, getDoctorScheduleImpact, listDoctorSchedules, transferDoctorSchedules } from '../api/scheduling.js'
import IdentityStaffAccounts from './IdentityStaffAccounts.jsx'
import TablePagination from './TablePagination.jsx'
import { getCurrentPage, getPageRows, TABLE_PAGE_SIZE } from './tablePagination.js'

const STAFF_ROLE_NAMES = { doctor: 'Bác sĩ', letan: 'Lễ tân', xnv: 'Xét nghiệm viên' }

export default function AdminDashboard({
  user,
  onLogout,
  identityAccountId,
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
  const [patientInsuranceBusyId, setPatientInsuranceBusyId] = useState('')
  const [patientReload, setPatientReload] = useState(0)
  const [serviceSearch, setServiceSearch] = useState('')
  const [servicePage, setServicePage] = useState(0)
  const [branchPage, setBranchPage] = useState(0)
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
  const [branchServicePage, setBranchServicePage] = useState(0)
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
  const [appointments, setAppointments] = useState([])
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
  const [schedulePage, setSchedulePage] = useState(0)
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
  const [reportMonth, setReportMonth] = useState(() => getTodayDateKey().slice(0, 7))
  const [reportBranchPage, setReportBranchPage] = useState(0)
  const [reportDoctorPage, setReportDoctorPage] = useState(0)
  const [reportServicePage, setReportServicePage] = useState(0)
  const [adminReportData, setAdminReportData] = useState(null)
  const [adminReportLoading, setAdminReportLoading] = useState(false)
  const [adminReportError, setAdminReportError] = useState('')
  const [billingPage, setBillingPage] = useState(0)
  const [billingInvoices, setBillingInvoices] = useState([])
  const [billingTotal, setBillingTotal] = useState(0)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [billingReload, setBillingReload] = useState(0)
  const [refundBusyId, setRefundBusyId] = useState('')

  const serviceDepartments = ['Nội tổng quát', 'Răng hàm mặt', 'Tai mũi họng', 'Xét nghiệm']
  const serviceTypes = ['Khám lâm sàng', 'Xét nghiệm', 'Điều trị']

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    }, 0)
    return () => window.clearTimeout(timer)
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
          limit: TABLE_PAGE_SIZE,
          offset: patientPage * TABLE_PAGE_SIZE,
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
    const timer = window.setTimeout(() => {
      setBulkScheduleForm((current) => ({
        ...current,
        MaBacSi: doctors.some((doctor) => doctor.MaNhanSu === current.MaBacSi)
          ? current.MaBacSi : doctors[0]?.MaNhanSu || '',
        MaChiNhanh: branches.some((branch) => branch.MaChiNhanh === current.MaChiNhanh)
          ? current.MaChiNhanh : branches[0]?.MaChiNhanh || '',
      }))
    }, 0)
    return () => window.clearTimeout(timer)
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

  const handleVerifyPatientInsurance = async (patient) => {
    if (!patient.insurance_card_number || !patient.insurance_category_code) return
    const verified = !patient.insurance_verified
    const action = verified ? 'xác minh' : 'hủy xác minh'
    if (!window.confirm(`Bạn chắc chắn muốn ${action} BHYT của ${patient.full_name || patient.cccd || patient.id}?`)) return
    setPatientInsuranceBusyId(patient.id)
    try {
      const updated = await verifyPatientInsurance(identityAccessToken, patient.id, verified)
      setPatients((current) => current.map((item) => item.id === patient.id ? updated : item))
      notify(`Đã ${action} BHYT của bệnh nhân.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể cập nhật xác minh BHYT.', 'error')
    } finally {
      setPatientInsuranceBusyId('')
    }
  }

  const getService = (maDichVu) =>
    services.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      LoaiDichVu: '',
      GiaGoc: 0,
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


  const filteredDoctorSchedules = doctorSchedules.filter((schedule) => {
    const matchedStartDate =
      !scheduleFilters.TuNgay || schedule.NgayTruc >= scheduleFilters.TuNgay
    const matchedEndDate =
      !scheduleFilters.DenNgay || schedule.NgayTruc <= scheduleFilters.DenNgay
    const matchedDoctor =
      scheduleFilters.MaBacSi === 'all' || schedule.MaBacSi === scheduleFilters.MaBacSi

    return matchedStartDate && matchedEndDate && matchedDoctor
  })

  const getReportMonthRangeLabel = (monthValue) => {
    const [year, month] = monthValue.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const formattedMonth = String(month).padStart(2, '0')

    return `Chu kỳ báo cáo: Từ ngày 01/${formattedMonth}/${year} đến ngày ${lastDay}/${formattedMonth}/${year}`
  }

  const loadAdminMonthlyReport = async () => {
    if (!reportMonth) return

    setAdminReportLoading(true)
    setAdminReportError('')

    try {
      const responses = await Promise.all([
        getMonthlyReport(reportMonth, identityAccessToken),
        getGroupedReport('branch', reportMonth, identityAccessToken),
        getGroupedReport('doctor', reportMonth, identityAccessToken),
        getGroupedReport('service', reportMonth, identityAccessToken),
      ])
      const [result, branchReport, doctorReport, serviceReport] = await Promise.all(
        responses.map((response) => response.json()),
      )
      const failedIndex = responses.findIndex((response) => !response.ok)
      if (failedIndex !== -1) {
        const errorBody = [result, branchReport, doctorReport, serviceReport][failedIndex]
        throw new Error(errorBody?.detail || 'Không thể tải báo cáo tháng từ hệ thống.')
      }

      setAdminReportData({
        totalNetRevenue: result.revenue,
        totalInsuranceAmount: result.insurance_discount,
        completedAppointmentCount: result.paid_count,
        cancellationRate: null,
        totalServiceUsage: result.paid_count,
        legacyEstimatedCount: result.legacy_estimated_count,
        branchRows: branchReport.map((item) => ({
          maChiNhanh: item.code || '',
          tenChiNhanh: branches.find((branch) => branch.MaChiNhanh === item.code)?.TenChiNhanh || item.code || 'Không rõ chi nhánh',
          completedCount: item.paid_count,
          netRevenue: item.revenue,
          insuranceAmount: item.insurance_discount,
        })),
        doctorRows: doctorReport.map((item) => {
          const doctor = staffList.find((staff) => staff.MaNhanSu === item.code)
          return {
            key: item.code || 'unknown',
            hoTen: doctor?.HoTen || item.code || 'Không rõ bác sĩ',
            chuyenKhoa: doctor?.ChuyenKhoa || 'Chưa rõ',
            count: item.paid_count,
          }
        }),
        serviceContributionRows: serviceReport.map((item) => {
          const service = services.find((entry) => entry.MaDichVu === item.code)
          return {
            key: item.code || 'unknown',
            tenDichVu: service?.TenDichVu || item.code || 'Không rõ dịch vụ',
            loaiDichVu: service?.LoaiDichVu || 'Chưa rõ',
            count: item.paid_count,
            value: item.revenue,
          }
        }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải báo cáo tháng từ hệ thống.'
      setAdminReportError(message)
      setAdminReportData(null)
      console.warn('ADMIN_MONTHLY_REPORT_LOAD_FAILED', message)
    } finally {
      setAdminReportLoading(false)
    }
  }

  const onLoadAdminMonthlyReport = useEffectEvent(() => { void loadAdminMonthlyReport() })
  useEffect(() => {
    if (!identityAccessToken) return undefined
    const timer = window.setTimeout(() => onLoadAdminMonthlyReport(), 0)
    return () => window.clearTimeout(timer)
  }, [reportMonth, identityAccessToken, branches, staffList, services, billingReload])

  useEffect(() => {
    if (activeMenu !== 'billing' || !identityAccessToken) return undefined
    let active = true
    const timer = window.setTimeout(async () => {
      setBillingLoading(true)
      setBillingError('')
      try {
        const response = await getAdminInvoices(identityAccessToken, {
          limit: TABLE_PAGE_SIZE, offset: billingPage * TABLE_PAGE_SIZE,
        })
        const result = await response.json()
        if (!response.ok || !Array.isArray(result?.items)) {
          throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể tải hóa đơn.')
        }
        if (active) {
          setBillingInvoices(result.items)
          setBillingTotal(result.total)
        }
      } catch (error) {
        if (active) setBillingError(error instanceof Error ? error.message : 'Không thể tải hóa đơn.')
      } finally {
        if (active) setBillingLoading(false)
      }
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [activeMenu, identityAccessToken, billingPage, billingReload])

  const handleRefund = async (invoice) => {
    if (!window.confirm(`Ghi nhận hoàn tiền cho hóa đơn ${invoice.id}? Thao tác này chỉ cập nhật trạng thái trong hệ thống, không chuyển tiền qua ngân hàng.`)) return
    setRefundBusyId(invoice.id)
    try {
      const response = await simulateAdminRefund(identityAccessToken, invoice.id)
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'Không thể ghi nhận hoàn tiền.')
      notify('Đã hoàn tiền. Bệnh nhân có thể làm mới trang rồi hủy lịch chưa check-in.')
      setBillingReload((value) => value + 1)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể ghi nhận hoàn tiền.', 'error')
    } finally {
      setRefundBusyId('')
    }
  }


  const displayReportData = adminReportData || {
    totalNetRevenue: 0, totalInsuranceAmount: 0,
    completedAppointmentCount: 0, cancellationRate: null,
    totalServiceUsage: 0, legacyEstimatedCount: 0,
    branchRows: [], doctorRows: [], serviceContributionRows: [],
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
    setSchedulePage(0)
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
    SoLichHenDangCo: Number(schedule.confirmed_appointments ?? schedule.SoLichHenDangCo ?? 0),
    SoChoDangGiu: Number(schedule.active_holds ?? schedule.SoChoDangGiu ?? 0),
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

  const onLoadAdminDoctorSchedules = useEffectEvent(() => { void loadAdminDoctorSchedules() })
  useEffect(() => {
    if (activeMenu !== 'schedules') return undefined
    const timer = window.setTimeout(() => onLoadAdminDoctorSchedules(), 0)
    return () => window.clearTimeout(timer)
  }, [activeMenu, scheduleFilters.TuNgay, scheduleFilters.DenNgay, scheduleFilters.MaBacSi])

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
    const affectedAppointmentIds = new Set(affectedAppointments.map((appointment) => appointment.MaLichHen))

    try {
      const impact = await getDoctorScheduleImpact(identityAccessToken, schedule.id)
      if (!impact.can_change) {
        notify(`Không thể hủy ca: ${impact.confirmed_appointments} lịch hẹn, ${impact.active_holds} chỗ đang giữ.`, 'error')
        await loadAdminDoctorSchedules()
        return
      }
      if (!window.confirm(`Hủy ca trực ${schedule.MaLichTruc} ngày ${schedule.NgayTruc}?`)) return
      const response = await cancelDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
        }),
      }, identityAccessToken)
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
      const impact = await getDoctorScheduleImpact(identityAccessToken, schedule.id)
      if (!impact.can_change) {
        notify(`Không thể chuyển ca: ${impact.confirmed_appointments} lịch hẹn, ${impact.active_holds} chỗ đang giữ.`, 'error')
        await loadAdminDoctorSchedules()
        return
      }
      const response = await transferDoctorSchedules({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id ?? null,
          MaLichTruc: schedule.MaLichTruc,
          newMaBacSi: nextDoctorId,
        }),
      }, identityAccessToken)
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
      notify('Đã chuyển ca trực chưa có lịch hẹn sang bác sĩ mới.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể điều chuyển bác sĩ trực.'
      notify(message, 'error')
    }
  }

  const renderStaffManagement = () => (
    <div className="admin-stack">
      <IdentityStaffAccounts accessToken={identityAccessToken} currentAccountId={identityAccountId} onOwnPasswordReset={onLogout} showNotification={showNotification} onChanged={() => setStaffReload((value) => value + 1)} />
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
                <th>BHYT</th>
                <th>Xác minh</th>
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
                  <td>{patient.insurance_card_number ? `${patient.insurance_category_code} · ${patient.insurance_card_number}` : 'Không sử dụng'}</td>
                  <td>
                    <span className={`status-pill ${patient.insurance_verified ? 'active' : 'muted'}`}>
                      {patient.insurance_verified ? 'Đã xác minh' : 'Chưa xác minh'}
                    </span>
                    {patient.insurance_card_number && (
                      <button type="button" className="admin-secondary-button"
                        disabled={patientInsuranceBusyId === patient.id}
                        onClick={() => handleVerifyPatientInsurance(patient)}>
                        {patient.insurance_verified ? 'Hủy xác minh' : 'Xác minh'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(patientLoading || patientError || patients.length === 0) && (
                <tr>
                  <td colSpan="7">{patientLoading ? 'Đang tải bệnh nhân...' : patientError ? 'Không thể tải danh sách. Hãy thử làm mới.' : 'Không tìm thấy bệnh nhân phù hợp.'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!patientError && <TablePagination page={patientPage} total={patientTotal} label="bệnh nhân" disabled={patientLoading} onPageChange={(page) => { setPatientLoading(true); setPatientPage(page) }} />}
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
            onChange={(event) => { setServiceSearch(event.target.value); setServicePage(0) }}
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
              {getPageRows(filteredServices, servicePage).map((service) => (
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
        <TablePagination page={servicePage} total={filteredServices.length} label="dịch vụ" onPageChange={setServicePage} />
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
          {getPageRows(branches, branchPage).map((branch) => (
            <div className="admin-branch-card" key={branch.MaChiNhanh}>
              <strong>{branch.MaChiNhanh}</strong>
              <span>{branch.TenChiNhanh}</span>
              <small>{branch.DiaChi}</small>
              <small>{branch.SDT || 'Chưa có số điện thoại'}</small>
            </div>
          ))}
        </div>
        <TablePagination page={branchPage} total={branches.length} label="chi nhánh" onPageChange={setBranchPage} />
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
              onChange={(event) => {
                setServiceFilters((current) => ({ ...current, MaChiNhanh: event.target.value }))
                setBranchServicePage(0)
              }}
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
              onChange={(event) => {
                setServiceFilters((current) => ({ ...current, LoaiDichVu: event.target.value }))
                setBranchServicePage(0)
              }}
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
              {getPageRows(filteredBranchServices, branchServicePage).map((config) => {
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
        <TablePagination page={branchServicePage} total={filteredBranchServices.length} label="cấu hình dịch vụ" onPageChange={setBranchServicePage} />
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
              {getPageRows(filteredDoctorSchedules, schedulePage).map((schedule) => {
                const isCancelled = schedule.TrangThai === 'Đã hủy'
                const hasReservations = schedule.SoLichHenDangCo > 0 || schedule.SoChoDangGiu > 0
                const canRequestChange = Boolean(schedule.id) && !adminScheduleLoading && !hasReservations
                return (
                  <tr key={schedule.id ? `schedule-${schedule.id}` : `${schedule.MaLichTruc}-${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`}>
                    <td>{getDoctorName(schedule.MaBacSi)}</td>
                    <td>{getBranchName(schedule.MaChiNhanh)}</td>
                    <td>{schedule.NgayTruc}</td>
                    <td>Ca {schedule.CaTruc}</td>
                    <td>
                      {schedule.SoLichHenDangCo}
                      {schedule.SoChoDangGiu > 0 && <small> ({schedule.SoChoDangGiu} chỗ đang giữ)</small>}
                    </td>
                    <td>
                      <span className={`status-pill ${isCancelled ? 'danger' : 'active'}`}>
                        {isCancelled ? 'Đã hủy' : 'Đang hoạt động'}
                      </span>
                    </td>
                    <td>
                      {!isCancelled && (
                        <div className="admin-actions-row" title={hasReservations ? 'Cần xử lý lịch hẹn/chỗ đang giữ trước' : undefined}>
                          <button type="button" className="admin-secondary-button"
                            disabled={!canRequestChange} onClick={() => handleOpenDoctorTransfer(schedule)}>
                            Chuyển ca
                          </button>
                          <button type="button" className="admin-danger-button"
                            disabled={!canRequestChange} onClick={() => handleCancelSchedule(schedule)}>
                            Hủy ca
                          </button>
                        </div>
                      )}
                    </td>
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
        <TablePagination page={schedulePage} total={filteredDoctorSchedules.length} label="lịch trực" onPageChange={setSchedulePage} />
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
            onChange={(event) => {
              setReportMonth(event.target.value || getTodayDateKey().slice(0, 7))
              setReportBranchPage(0)
              setReportDoctorPage(0)
              setReportServicePage(0)
            }}
          />
        </label>
      </section>

      <div className="finance-kpi-grid">
        <div className="finance-kpi-card revenue">
          <DollarSign size={24} />
          <span>Tổng Doanh thu Tháng</span>
          <strong>{formatMoney(displayReportData.totalNetRevenue)}</strong>
          <small>Theo trạng thái hóa đơn và khoản lịch sử ước tính; chưa đối soát ngân hàng</small>
        </div>
        <div className="finance-kpi-card insurance">
          <ClipboardList size={24} />
          <span>Tổng BHYT Chi Trả</span>
          <strong>{formatMoney(displayReportData.totalInsuranceAmount)}</strong>
          <small>Giảm trừ trên hóa đơn; khoản lịch sử không xác nhận được BHYT thực trả</small>
        </div>
        <div className="finance-kpi-card success">
          <Activity size={24} />
          <span>Hóa đơn đã thanh toán</span>
          <strong>{displayReportData.completedAppointmentCount}</strong>
          <small>{displayReportData.legacyEstimatedCount} khoản lịch sử chỉ có ngày hẹn, chưa rõ thời điểm thanh toán</small>
        </div>
        <div className="finance-kpi-card danger">
          <Users size={24} />
          <span>Tỷ lệ hủy hẹn trong tháng</span>
          <strong>{displayReportData.cancellationRate == null ? '—' : `${displayReportData.cancellationRate}%`}</strong>
          <small>Chưa có báo cáo tỷ lệ hủy liên dịch vụ</small>
        </div>
      </div>

      <section className="admin-card">
        <h2>Hiệu suất Chi nhánh theo tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Chi nhánh</th>
                <th>Số khoản ghi nhận doanh thu</th>
                <th>Doanh thu thực thu</th>
                <th>Tiền bảo hiểm chi trả</th>
              </tr>
            </thead>
            <tbody>
              {getPageRows(displayReportData.branchRows, reportBranchPage).map((row) => (
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
        <TablePagination page={reportBranchPage} total={displayReportData.branchRows.length} label="chi nhánh" onPageChange={setReportBranchPage} />
      </section>

      <section className="admin-card">
        <h2>Doanh thu theo bác sĩ trong tháng</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Thứ hạng</th>
                <th>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Số khoản ghi nhận doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {getPageRows(displayReportData.doctorRows, reportDoctorPage).map((item, index) => (
                <tr key={item.key}>
                  <td>#{getCurrentPage(reportDoctorPage, displayReportData.doctorRows.length) * TABLE_PAGE_SIZE + index + 1}</td>
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
        <TablePagination page={reportDoctorPage} total={displayReportData.doctorRows.length} label="bác sĩ" onPageChange={setReportDoctorPage} />
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
                {getPageRows(displayReportData.serviceContributionRows, reportServicePage).map((item) => (
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
          <TablePagination page={reportServicePage} total={displayReportData.serviceContributionRows.length} label="dịch vụ" onPageChange={setReportServicePage} />
        </div>
      </section>
    </div>
  )

  const renderBilling = () => (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="admin-section-header">
          <div>
            <h2>Hóa đơn và hoàn tiền</h2>
            <p>Hóa đơn lịch sử chỉ xem. Chỉ ghi nhận hoàn tiền cho hóa đơn phát sinh và đã thanh toán trong hệ thống; không chuyển tiền qua ngân hàng.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={() => setBillingReload((value) => value + 1)} disabled={billingLoading}>Làm mới</button>
        </div>
        {billingError && <p role="alert" className="admin-feedback">{billingError}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Mã hóa đơn</th><th>Mã lịch hẹn</th><th>Dịch vụ</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {billingInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td title={invoice.id}>{invoice.id.slice(0, 8)}…</td>
                  <td title={invoice.appointment_id}>{invoice.appointment_id.slice(0, 8)}…</td>
                  <td>{invoice.service_code}</td>
                  <td>{formatMoney(invoice.amount_due)}</td>
                  <td><span className={`status-pill ${invoice.status === 'paid' ? 'active' : 'muted'}`}>
                    {invoice.status === 'paid' ? 'Đã thanh toán' : invoice.status === 'refunded' ? 'Đã hoàn tiền' : 'Chờ thanh toán'}
                  </span></td>
                  <td>
                    {invoice.status === 'paid' && invoice.payment_method === 'simulated' && invoice.source === 'live' ? (
                      <button type="button" className="admin-secondary-button" onClick={() => handleRefund(invoice)} disabled={refundBusyId === invoice.id}>Ghi nhận hoàn tiền</button>
                    ) : (
                      <span
                        className="admin-action-note"
                        title={invoice.source !== 'live' ? 'Hóa đơn lịch sử không có giao dịch thanh toán được xác minh nên không thể hoàn tiền trong hệ thống.' : undefined}
                      >
                        {invoice.status === 'refunded' ? 'Đã hoàn tiền' : invoice.source !== 'live' ? 'Lịch sử · chỉ xem' : invoice.status === 'pending' ? 'Chờ thanh toán' : 'Không áp dụng'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!billingLoading && !billingError && billingInvoices.length === 0 && <tr><td colSpan="6">Chưa có hóa đơn.</td></tr>}
              {billingLoading && <tr><td colSpan="6">Đang tải hóa đơn...</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination page={billingPage} total={billingTotal} label="hóa đơn" onPageChange={setBillingPage} disabled={billingLoading} />
      </section>
    </div>
  )

  const renderContent = () => {
    if (activeMenu === 'staff') return renderStaffManagement()
    if (activeMenu === 'services') return renderServiceConfig()
    if (activeMenu === 'schedules') return renderSchedules()
    if (activeMenu === 'billing') return renderBilling()
    return renderReports()
  }

  const navItems = [
    { key: 'staff', label: 'Quản lý Nhân sự & Bệnh nhân', icon: Users },
    { key: 'services', label: 'Cấu hình Dịch vụ Chi nhánh', icon: Building2 },
    { key: 'schedules', label: 'Quản lý Lịch trực', icon: Calendar },
    { key: 'billing', label: 'Hóa đơn & Hoàn tiền', icon: DollarSign },
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
