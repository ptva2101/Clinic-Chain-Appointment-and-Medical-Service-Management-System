import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Building2,
  Calendar,
  ClipboardList,
  DollarSign,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react'
import medicalLogoImage from './assets/medical-logo-cutout.png'
import medicalTeamImage from './assets/medical-team-cutout.png'
import './App.css'

const BACKEND_URL = 'http://127.0.0.1:8000'
const MEDICARE_SESSION_KEY = 'medicare_session'

const getTodayDateKey = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getFutureDateKey = (daysFromToday) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getSessionUserId = (user, selectedRole) => {
  if (!user) return ''
  if (selectedRole === 'patient') return user.MaBenhAn || user.CCCD || user.id || ''
  if (selectedRole === 'doctor') return user.MaBacSi || user.id || ''
  if (selectedRole === 'letan') return user.MaLeTan || user.id || ''
  if (selectedRole === 'xnv') return user.MaXNV || user.id || ''
  if (selectedRole === 'admin') return user.username || user.id || 'admin'
  return user.id || ''
}

const EMPTY_CATALOG_DATA = {
  branches: [],
  services: [],
  doctors: [],
  branchServices: [],
  diseases: [],
  medicines: [],
  bhyt: [],
  doctorSchedules: [],
  meta: {},
}

const INITIAL_PATIENT_ACCOUNTS = [
  {
    MaBenhAn: 'BN001',
    HoTen: 'Trần Quang Hải',
    NgaySinh: '1995-04-12',
    GioiTinh: 'Nam',
    CCCD: '001095012345',
    SDT: '0901234567',
    DiaChi: 'Cầu Giấy, Hà Nội',
    MaSoBHYT: 'DN4010123456789',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN002',
    HoTen: 'Nguyễn Thị Mai',
    NgaySinh: '2000-09-20',
    GioiTinh: 'Nữ',
    CCCD: '001200054321',
    SDT: '0907654321',
    DiaChi: 'Hai Bà Trưng, Hà Nội',
    MaSoBHYT: '',
    KyTuDauBHYT: '',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN003',
    HoTen: 'Phạm Lê Minh',
    NgaySinh: '2021-01-15',
    GioiTinh: 'Nam',
    CCCD: '001221098765',
    SDT: '0911999888',
    DiaChi: 'Đống Đa, Hà Nội',
    MaSoBHYT: 'TE1010999888777',
    KyTuDauBHYT: 'TE',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN004',
    HoTen: 'Lê Hoàng Nam',
    NgaySinh: '1986-03-04',
    GioiTinh: 'Nam',
    CCCD: '001186000004',
    SDT: '0904000004',
    DiaChi: 'Nam Từ Liêm, Hà Nội',
    MaSoBHYT: 'DN401000000004',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN005',
    HoTen: 'Đỗ Minh Châu',
    NgaySinh: '1987-05-11',
    GioiTinh: 'Nữ',
    CCCD: '001187000005',
    SDT: '0905000005',
    DiaChi: 'Thanh Xuân, Hà Nội',
    MaSoBHYT: '',
    KyTuDauBHYT: '',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN006',
    HoTen: 'Vũ Gia Hân',
    NgaySinh: '1988-06-22',
    GioiTinh: 'Nữ',
    CCCD: '001188000006',
    SDT: '0906000006',
    DiaChi: 'Ba Đình, Hà Nội',
    MaSoBHYT: 'HT401000000006',
    KyTuDauBHYT: 'HT',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN007',
    HoTen: 'Hoàng Đức Anh',
    NgaySinh: '1989-02-17',
    GioiTinh: 'Nam',
    CCCD: '001189000007',
    SDT: '0907000007',
    DiaChi: 'Cầu Giấy, Hà Nội',
    MaSoBHYT: 'DN401000000007',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN008',
    HoTen: 'Phan Ngọc Linh',
    NgaySinh: '1990-07-29',
    GioiTinh: 'Nữ',
    CCCD: '001190000008',
    SDT: '0908000008',
    DiaChi: 'Đống Đa, Hà Nội',
    MaSoBHYT: '',
    KyTuDauBHYT: '',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN009',
    HoTen: 'Bùi Quang Huy',
    NgaySinh: '1991-08-13',
    GioiTinh: 'Nam',
    CCCD: '001191000009',
    SDT: '0909000009',
    DiaChi: 'Long Biên, Hà Nội',
    MaSoBHYT: 'DN401000000009',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN010',
    HoTen: 'Đặng Khánh Vy',
    NgaySinh: '1992-10-03',
    GioiTinh: 'Nữ',
    CCCD: '001192000010',
    SDT: '0910000010',
    DiaChi: 'Hai Bà Trưng, Hà Nội',
    MaSoBHYT: 'TE101000000010',
    KyTuDauBHYT: 'TE',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN011',
    HoTen: 'Ngô Tuấn Kiệt',
    NgaySinh: '1993-11-18',
    GioiTinh: 'Nam',
    CCCD: '001193000011',
    SDT: '0911000011',
    DiaChi: 'Hoàn Kiếm, Hà Nội',
    MaSoBHYT: '',
    KyTuDauBHYT: '',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN012',
    HoTen: 'Mai Phương Anh',
    NgaySinh: '1994-12-08',
    GioiTinh: 'Nữ',
    CCCD: '001194000012',
    SDT: '0912000012',
    DiaChi: 'Tây Hồ, Hà Nội',
    MaSoBHYT: 'DN401000000012',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN013',
    HoTen: 'Cao Nhật Minh',
    NgaySinh: '1995-01-25',
    GioiTinh: 'Nam',
    CCCD: '001195000013',
    SDT: '0913000013',
    DiaChi: 'Hoàng Mai, Hà Nội',
    MaSoBHYT: '',
    KyTuDauBHYT: '',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN014',
    HoTen: 'Tạ Thu Trang',
    NgaySinh: '1996-04-09',
    GioiTinh: 'Nữ',
    CCCD: '001196000014',
    SDT: '0914000014',
    DiaChi: 'Hà Đông, Hà Nội',
    MaSoBHYT: 'DN401000000014',
    KyTuDauBHYT: 'DN',
    MatKhau: '123456',
  },
  {
    MaBenhAn: 'BN015',
    HoTen: 'Lương Quốc Hưng',
    NgaySinh: '1997-09-14',
    GioiTinh: 'Nam',
    CCCD: '001197000015',
    SDT: '0915000015',
    DiaChi: 'Gia Lâm, Hà Nội',
    MaSoBHYT: 'HT401000000015',
    KyTuDauBHYT: 'HT',
    MatKhau: '123456',
  },
]

function InputField({ label, placeholder, icon, type = 'text', value, onChange }) {
  const Icon = icon

  return (
    <label className="field-group">
      <span className="field-label">{label}</span>
      <span className="input-shell">
        <Icon size={18} />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      </span>
    </label>
  )
}

function GlobalToast({ toast }) {
  if (!toast.show) return null

  const isError = toast.type === 'error'

  return (
    <div className={`global-toast ${isError ? 'error' : 'success'}`} role="status" aria-live="polite">
      <span className="global-toast-icon">{isError ? '×' : '✓'}</span>
      <span>{toast.message}</span>
    </div>
  )
}

function NotificationBell({ notifications, onMarkAllRead }) {
  const [open, setOpen] = useState(false)
  const unreadCount = notifications.filter((notification) => !notification.read).length
  const sortedNotifications = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="notification-bell-button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Thông báo bệnh nhân"
      >
        <span className="notification-bell-icon">🔔</span>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head">
            <strong>Thông báo</strong>
            {unreadCount > 0 && (
              <button type="button" onClick={onMarkAllRead}>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="notification-list">
            {sortedNotifications.length > 0 ? (
              sortedNotifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                >
                  <p>{notification.message}</p>
                  <span>{notification.createdAt.replace('T', ' ').slice(0, 16)}</span>
                </article>
              ))
            ) : (
              <p className="notification-empty">Chưa có thông báo mới.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('patient')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [cccdDangKy, setCccdDangKy] = useState('')
  const [sdtDangKy, setSdtDangKy] = useState('')
  const [ngaySinh, setNgaySinh] = useState('')
  const [gioiTinh, setGioiTinh] = useState('Nam')
  const [diaChi, setDiaChi] = useState('')
  const [maBHYT, setMaBHYT] = useState('')
  const [kyTuBHYT, setKyTuBHYT] = useState('')
  const [matKhauDangKy, setMatKhauDangKy] = useState('')
  const [xacNhanMatKhauDangKy, setXacNhanMatKhauDangKy] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [sessionRestoring, setSessionRestoring] = useState(true)
  const [patientAccounts, setPatientAccounts] = useState(INITIAL_PATIENT_ACCOUNTS)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [notifications, setNotifications] = useState([])
  const [scheduleAdjustments, setScheduleAdjustments] = useState([])
  const [catalogData, setCatalogData] = useState(EMPTY_CATALOG_DATA)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const toastTimerRef = useRef(null)

  const showNotification = (message, type = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToast({ show: true, message, type })
    toastTimerRef.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, show: false }))
    }, 1800)
  }

  const renderWithToast = (content) => (
    <>
      {content}
      <GlobalToast toast={toast} />
    </>
  )

  const addPatientNotifications = (items) => {
    if (!items.length) return

    const createdAt = new Date().toISOString()
    setNotifications((current) => {
      const existingIds = new Set(current.map((notification) => notification.id))
      const nextItems = items
        .map((item, index) => ({
          id: item.id || item.MaThongBao || `NOTI_${createdAt.replace(/\D/g, '')}_${index}`,
          MaBenhNhan: item.MaBenhNhan || item.MaBenhAn,
          MaBenhAn: item.MaBenhAn || item.MaBenhNhan,
          MaLichHen: item.MaLichHen || '',
          message: item.message || item.NoiDung || '',
          read: Boolean(item.read),
          createdAt: item.createdAt || item.ThoiGianGui || createdAt,
        }))
        .filter((item) => item.id && item.message && !existingIds.has(item.id))

      return [...nextItems, ...current]
    })
  }

  const markPatientNotificationsRead = async (maBenhAn) => {
    try {
      const formData = new FormData()
      formData.append('ma_benh_an', maBenhAn)
      const response = await fetch(`${BACKEND_URL}/patient/notifications/mark-read`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể đánh dấu thông báo đã đọc.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đánh dấu thông báo đã đọc.'
      console.warn('PATIENT_NOTIFICATIONS_MARK_READ_FAILED', message)
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.MaBenhAn === maBenhAn || notification.MaBenhNhan === maBenhAn
          ? { ...notification, read: true }
          : notification,
      ),
    )
  }

  const addScheduleAdjustment = (adjustment) => {
    setScheduleAdjustments((current) => [
      {
        ...adjustment,
        id: `SCH_ADJ_${Date.now()}_${current.length + 1}`,
      },
      ...current,
    ])
  }

  const loadCatalogData = async () => {
    setCatalogLoading(true)
    setCatalogError('')
    const scheduleStartDate = getTodayDateKey()
    const scheduleEndDate = getFutureDateKey(45)

    const endpoints = {
      branches: '/catalog/branches',
      services: '/catalog/services',
      doctors: '/catalog/doctors',
      branchServices: '/catalog/branch-services',
      diseases: '/catalog/diseases',
      medicines: '/catalog/medicines',
      bhyt: '/catalog/bhyt',
      doctorSchedules: `/catalog/doctor-schedules?from_date=${scheduleStartDate}&to_date=${scheduleEndDate}`,
    }

    try {
      const entries = await Promise.all(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          const response = await fetch(`${BACKEND_URL}${endpoint}`)
          const result = await response.json()

          if (!response.ok || !result?.success) {
            throw new Error(result?.message || `Không thể tải ${key}`)
          }

          return [key, result]
        }),
      )

      const nextCatalog = entries.reduce(
        (accumulator, [key, result]) => ({
          ...accumulator,
          [key]: Array.isArray(result.data) ? result.data : [],
          meta: {
            ...accumulator.meta,
            [key]: result.meta || null,
          },
        }),
        { ...EMPTY_CATALOG_DATA, meta: {} },
      )

      setCatalogData(nextCatalog)
      console.info('CATALOG_LOADED', {
        branches: nextCatalog.branches.length,
        services: nextCatalog.services.length,
        doctors: nextCatalog.doctors.length,
        branchServices: nextCatalog.branchServices.length,
        diseases: nextCatalog.diseases.length,
        medicines: nextCatalog.medicines.length,
        bhyt: nextCatalog.bhyt.length,
        doctorSchedules: nextCatalog.doctorSchedules.length,
        meta: nextCatalog.meta,
      })

      return nextCatalog
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể nạp dữ liệu danh mục hệ thống.'
      setCatalogError(message)
      throw error
    } finally {
      setCatalogLoading(false)
    }
  }

  const getLoginRequest = (selectedRole, loginName, loginPassword) => {
    const normalizedLoginName = loginName.trim()

    if (selectedRole === 'patient') {
      return {
        endpoint: '/auth/login-patient',
        payload: { cccd: normalizedLoginName, password: loginPassword },
      }
    }

    if (selectedRole === 'doctor') {
      return {
        endpoint: '/auth/login-doctor',
        payload: { MaBacSi: normalizedLoginName, username: normalizedLoginName, password: loginPassword },
      }
    }

    if (selectedRole === 'letan') {
      return {
        endpoint: '/auth/login-le-tan',
        payload: { MaLeTan: normalizedLoginName, username: normalizedLoginName, password: loginPassword },
      }
    }

    if (selectedRole === 'xnv') {
      return {
        endpoint: '/auth/login_xet_nghiem_vien',
        payload: { MaXNV: normalizedLoginName, username: normalizedLoginName, password: loginPassword },
      }
    }

    return {
      endpoint: '/auth/login_admin',
      payload: { username: normalizedLoginName, password: loginPassword },
    }
  }

  const normalizeLoggedInUser = (selectedRole, loginName, userData) => {
    const normalizedLoginName = loginName.trim()
    const displayName =
      selectedRole === 'admin'
        ? 'Quản trị viên hệ thống'
        : userData?.HoTen || userData?.name || userData?.username || normalizedLoginName
    const userId =
      userData?.MaBenhAn ||
      userData?.MaBacSi ||
      userData?.MaLeTan ||
      userData?.MaXNV ||
      userData?.CCCD ||
      userData?.username ||
      normalizedLoginName

    return {
      ...userData,
      name: displayName,
      id: userId,
      loginRole: selectedRole,
      MatKhau: userData?.MatKhau || password,
      MaBenhAn: userData?.MaBenhAn,
      MaBacSi: userData?.MaBacSi,
      MaLeTan: userData?.MaLeTan,
      MaXNV: userData?.MaXNV,
      CCCD: userData?.CCCD || (selectedRole === 'patient' ? normalizedLoginName : userData?.CCCD),
      HoTen: userData?.HoTen || displayName,
      MaChiNhanh: userData?.MaChiNhanh || '',
      TenChiNhanh: userData?.TenChiNhanh || '',
    }
  }

  const saveSession = (selectedRole, user) => {
    const userId = getSessionUserId(user, selectedRole)
    if (!userId) return

    window.localStorage.setItem(
      MEDICARE_SESSION_KEY,
      JSON.stringify({
        role: selectedRole,
        userId,
        savedAt: Date.now(),
      }),
    )
  }

  const clearSession = () => {
    window.localStorage.removeItem(MEDICARE_SESSION_KEY)
  }

  const restoreSession = async () => {
    const rawSession = window.localStorage.getItem(MEDICARE_SESSION_KEY)
    if (!rawSession) {
      setSessionRestoring(false)
      return
    }

    try {
      const parsedSession = JSON.parse(rawSession)
      if (!parsedSession?.role || !parsedSession?.userId) {
        clearSession()
        setSessionRestoring(false)
        return
      }

      const response = await fetch(`${BACKEND_URL}/auth/session-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: parsedSession.role,
          userId: parsedSession.userId,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ.')
      }

      const restoredUser = normalizeLoggedInUser(parsedSession.role, parsedSession.userId, result.data || {})
      await loadCatalogData()
      setRole(parsedSession.role)
      setCurrentUser(restoredUser)
      setMode(parsedSession.role)
      saveSession(parsedSession.role, restoredUser)
    } catch (error) {
      clearSession()
      const message = error instanceof Error ? error.message : 'Không thể khôi phục phiên đăng nhập.'
      console.warn('SESSION_RESTORE_FAILED', message)
    } finally {
      setSessionRestoring(false)
    }
  }

  useEffect(() => {
    restoreSession()
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      showNotification('Vui lòng nhập đầy đủ tài khoản và mật khẩu.', 'error')
      return
    }

    const { endpoint, payload } = getLoginRequest(role, normalizedUsername, password)

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        showNotification(result?.message || result?.detail || 'Sai tài khoản hoặc mật khẩu.', 'error')
        return
      }

      const loggedInUser = normalizeLoggedInUser(role, normalizedUsername, result.data || {})
      await loadCatalogData()
      setCurrentUser(loggedInUser)
      setMode(role)
      saveSession(role, loggedInUser)
      showNotification('Đăng nhập thành công.', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể kết nối đến Backend FastAPI! Bạn đã bật Uvicorn chưa?'
      showNotification(message, 'error')
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()

    if (matKhauDangKy !== xacNhanMatKhauDangKy) {
      showNotification('Mật khẩu xác nhận không trùng khớp, vui lòng kiểm tra lại!', 'error')
      return
    }

    if (patientAccounts.some((patient) => patient.CCCD === cccdDangKy.trim())) {
      showNotification('Số CCCD này đã tồn tại trong hệ thống, vui lòng đăng nhập hoặc kiểm tra lại!', 'error')
      return
    }

    const payload = {
      hoten: hoTen,
      cccd: cccdDangKy,
      ngaysinh: ngaySinh,
      gioitinh: gioiTinh,
      sdt: sdtDangKy,
      matkhau: matKhauDangKy,
      diachi: diaChi,
      ma_so_bhyt: maBHYT || null,
      ky_tu_bhyt: kyTuBHYT || null,
    }

    try {
      const response = await fetch(`${BACKEND_URL}/patient/register-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setPatientAccounts((current) => [
          ...current,
          {
            MaBenhAn: `BN${String(current.length + 1).padStart(3, '0')}`,
            HoTen: hoTen.trim(),
            NgaySinh: ngaySinh,
            GioiTinh: gioiTinh,
            CCCD: cccdDangKy.trim(),
            SDT: sdtDangKy.trim(),
            DiaChi: diaChi.trim(),
            MaSoBHYT: maBHYT.trim(),
            KyTuDauBHYT: kyTuBHYT.trim().toUpperCase(),
            MatKhau: matKhauDangKy,
          },
        ])
        showNotification('Đăng ký tài khoản Bệnh nhân thành công! Mời bạn đăng nhập.')
        setUsername(cccdDangKy.trim())
        setPassword('')
        setMode('login')
      } else {
        const errorData = await response.json()
        showNotification(`Đăng ký thất bại: ${errorData.detail || 'Dữ liệu không hợp lệ'}`, 'error')
      }
    } catch {
      showNotification('Lỗi kết nối máy chủ khi đăng ký!', 'error')
    }
  }

	  const handleLogout = () => {
    clearSession()
	    setCurrentUser(null)
	    setUsername('')
    setPassword('')
    setXacNhanMatKhauDangKy('')
    setMode('login')
	    setRole('patient')
	  }

	  const handleUpdateCurrentUser = (updatedFields) => {
	    setCurrentUser((current) => {
      if (!current) return current
      const nextUser = { ...current, ...updatedFields }
      saveSession(nextUser.loginRole || mode, nextUser)
      return nextUser
    })
	  }

  if (sessionRestoring) {
    return renderWithToast(
      <main className="page-shell">
        <section className="auth-wrapper">
          <div className="form-panel auth-session-panel">
            <div className="brand-header">
              <img className="brand-logo" src={medicalLogoImage} alt="Logo Medicare" />
              <span className="brand-name">Medicare</span>
            </div>
            <p className="auth-session-text">Đang khôi phục phiên đăng nhập và cập nhật dữ liệu mới nhất...</p>
          </div>
        </section>
      </main>,
    )
  }

	  if (mode === 'admin') {
	    return renderWithToast(
	      <AdminDashboard
	        user={currentUser}
	        onLogout={handleLogout}
	        showNotification={showNotification}
	        addPatientNotifications={addPatientNotifications}
	        addScheduleAdjustment={addScheduleAdjustment}
	        catalogData={catalogData}
	        reloadCatalogData={loadCatalogData}
	      />,
	    )
	  }
	  if (mode === 'doctor') {
	    return renderWithToast(
	      <DoctorDashboard
	        user={currentUser}
	        onLogout={handleLogout}
	        showNotification={showNotification}
	        scheduleAdjustments={scheduleAdjustments}
	        catalogData={catalogData}
	      />,
	    )
	  }
	  if (mode === 'letan') {
	    return renderWithToast(
	      <ReceptionistDashboard
	        user={currentUser}
	        onLogout={handleLogout}
	        showNotification={showNotification}
	        catalogData={catalogData}
	      />,
	    )
	  }
	  if (mode === 'xnv') {
	    return renderWithToast(
	      <TechnicianDashboard
	        user={currentUser}
	        onLogout={handleLogout}
	        showNotification={showNotification}
	        onUpdateUser={handleUpdateCurrentUser}
	        catalogData={catalogData}
	      />,
	    )
	  }
	  if (mode === 'patient') {
	    return renderWithToast(
	      <PatientDashboard
	        user={currentUser}
	        onLogout={handleLogout}
	        onUpdateUser={handleUpdateCurrentUser}
	        showNotification={showNotification}
	        notifications={notifications}
	        addPatientNotifications={addPatientNotifications}
	        onMarkNotificationsRead={markPatientNotificationsRead}
	        catalogData={catalogData}
	      />,
	    )
	  }

  return renderWithToast(
    <main className="page-shell">
      <section className="auth-wrapper">
        <div className="auth-layout">
          <div className="form-panel">
            <div className="brand-header">
              <img className="brand-logo" src={medicalLogoImage} alt="Logo Medicare" />
              <span className="brand-name">Medicare</span>
            </div>

            <div className="tab-row">
              <button
                type="button"
                className={`tab-button ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`tab-button ${mode === 'register' ? 'active' : ''}`}
                onClick={() => setMode('register')}
              >
                Đăng ký
              </button>
            </div>

            {mode === 'login' && (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="field-group">
                  <span className="field-label">Vai trò đăng nhập</span>
                  <select
                    className="admin-input"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="patient">Bệnh nhân</option>
                    <option value="doctor">Bác sĩ chuyên khoa</option>
                    <option value="letan">Lễ tân tiếp đón</option>
                    <option value="xnv">Xét nghiệm viên</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </label>

                <InputField
                  label={role === 'patient' ? 'Căn cước công dân (CCCD)' : 'Mã đăng nhập hệ thống'}
                  placeholder={role === 'patient' ? 'Nhập 12 số CCCD' : 'Nhập tài khoản của bạn'}
                  icon={UserRound}
                  value={username}
                  onChange={setUsername}
                />
                <InputField
                  label="Mật khẩu"
                  placeholder="Nhập mật khẩu"
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={setPassword}
                />

                {catalogError && <p className="auth-catalog-error">{catalogError}</p>}
                <button type="submit" className="submit-button" disabled={catalogLoading}>
                  {catalogLoading ? 'Đang nạp dữ liệu hệ thống...' : 'Đăng nhập'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form className="auth-form" onSubmit={handleRegister}>
                <InputField
                  label="Họ và tên bệnh nhân"
                  placeholder="Nhập họ và tên"
                  icon={UserRound}
                  value={hoTen}
                  onChange={setHoTen}
                />
                <InputField
                  label="Số Căn cước công dân"
                  placeholder="Nhập 12 số CCCD"
                  icon={UserRound}
                  value={cccdDangKy}
                  onChange={setCccdDangKy}
                />
                <InputField
                  label="Số điện thoại"
                  placeholder="Nhập số điện thoại"
                  icon={Phone}
                  value={sdtDangKy}
                  onChange={setSdtDangKy}
                />
                <InputField
                  label="Ngày sinh"
                  placeholder="YYYY-MM-DD"
                  icon={Calendar}
                  type="date"
                  value={ngaySinh}
                  onChange={setNgaySinh}
                />

                <label className="field-group">
                  <span className="field-label">Giới tính</span>
                  <select
                    className="admin-input"
                    value={gioiTinh}
                    onChange={(event) => setGioiTinh(event.target.value)}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </label>

                <InputField
                  label="Địa chỉ cư trú"
                  placeholder="Nhập địa chỉ"
                  icon={MapPin}
                  value={diaChi}
                  onChange={setDiaChi}
                />
                <InputField
                  label="Mã số BHYT (nếu có)"
                  placeholder="Nhập số thẻ BHYT"
                  icon={Mail}
                  value={maBHYT}
                  onChange={setMaBHYT}
                />
                <InputField
                  label="Ký tự đầu BHYT (TE/DN/HT)"
                  placeholder="Ví dụ: DN"
                  icon={Mail}
                  value={kyTuBHYT}
                  onChange={setKyTuBHYT}
                />
                <InputField
                  label="Tạo mật khẩu hệ thống"
                  placeholder="Nhập mật khẩu"
                  icon={Lock}
                  type="password"
                  value={matKhauDangKy}
                  onChange={setMatKhauDangKy}
                />
                <InputField
                  label="Xác nhận mật khẩu"
                  placeholder="Nhập lại mật khẩu"
                  icon={Lock}
                  type="password"
                  value={xacNhanMatKhauDangKy}
                  onChange={setXacNhanMatKhauDangKy}
                />

                <button type="submit" className="submit-button">
                  Đăng ký tài khoản
                </button>
              </form>
            )}
          </div>

          <div className="visual-panel" aria-hidden="true">
            <div className="visual-card">
              <div className="wave-shape" />
              <div className="visual-content">
                <img className="visual-image" src={medicalTeamImage} alt="Đội ngũ y tế" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>,
  )
}

function AdminDashboard({
  user,
  onLogout,
  showNotification,
  addPatientNotifications,
  addScheduleAdjustment,
  catalogData = EMPTY_CATALOG_DATA,
  reloadCatalogData,
}) {
  const [branches, setBranches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
      SDT: '0241234567',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
      SDT: '0247654321',
    },
  ])
  const [branchForm, setBranchForm] = useState({
    MaChiNhanh: '',
    TenChiNhanh: '',
    DiaChi: '',
    SDT: '',
  })

  const [services, setServices] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_LAO_KHOA', TenDichVu: 'Khám Tư Vấn Sức Khỏe Lão Khoa', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_HO_HAP', TenDichVu: 'Khám Bệnh Lý Đường Hô Hấp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 170000 },
    { MaDichVu: 'DV_KHAM_NOI_TIET', TenDichVu: 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 220000 },
    { MaDichVu: 'DV_KHAM_DINH_DUONG', TenDichVu: 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DT_TRUYEN_DICH', TenDichVu: 'Liệu trình truyền dịch giải độc, bù nước', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 250000 },
    { MaDichVu: 'DT_TIEM_KHANG_SINH', TenDichVu: 'Dịch vụ tiêm thuốc/kháng sinh theo chỉ định', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 80000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_LAY_CAO', TenDichVu: 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_NIENG_RANG', TenDichVu: 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_IMPLANT', TenDichVu: 'Khám Tư Vấn Trồng Răng Implant', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DT_HAN_RANG', TenDichVu: 'Hàn Răng Composite Thẩm Mỹ (1 Răng)', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 300000 },
    { MaDichVu: 'DT_RANG_TUY', TenDichVu: 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1200000 },
    { MaDichVu: 'DT_NHO_RANG_KHON', TenDichVu: 'Phẫu Thuật Nhổ Răng Khôn Mọc Lệch', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1000000 },
    { MaDichVu: 'DT_TAY_TRANG', TenDichVu: 'Tẩy Trắng Răng Công Nghệ Laser', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 2000000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_NOI_SOI_TMH', TenDichVu: 'Nội Soi Tai Mũi Họng Ống Mềm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_THINH_LUC', TenDichVu: 'Khám Đo Thính Lực Đơn Âm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DT_KHIDUNG', TenDichVu: 'Liệu Trình Khí Dung Mũi Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 450000 },
    { MaDichVu: 'DT_VIEM_AMIDAN', TenDichVu: 'Liệu Trình Điều Trị Viêm Amidan Hạt', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 600000 },
    { MaDichVu: 'DT_RUA_XOANG', TenDichVu: 'Hút Mủ Và Chọc Rửa Xoang Điều Trị', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 350000 },
    { MaDichVu: 'DT_LAY_DI_VAT', TenDichVu: 'Thủ Thuật Lấy Dị Vật Vùng Tai/Mũi/Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 400000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_NUOC_TIEU', TenDichVu: 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 120000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'XN_DUONG_HUYET', TenDichVu: 'Xét Nghiệm Đường Huyết Nhanh', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 80000 },
  ])
  const [priceDrafts, setPriceDrafts] = useState(() => ({
    DV_KHAM_NOI: '150000',
    DV_KHAM_GIA_DINH: '250000',
    DV_KHAM_LAO_KHOA: '180000',
    DV_KHAM_TIM_MACH: '200000',
    DV_KHAM_TIEU_HOA: '180000',
    DV_KHAM_HO_HAP: '170000',
    DV_KHAM_NOI_TIET: '220000',
    DV_KHAM_DINH_DUONG: '150000',
    DT_TRUYEN_DICH: '250000',
    DT_TIEM_KHANG_SINH: '80000',
    DV_KHAM_RANG: '200000',
    DV_LAY_CAO: '150000',
    DV_KHAM_NIENG_RANG: '300000',
    DV_KHAM_IMPLANT: '300000',
    DT_HAN_RANG: '300000',
    DT_RANG_TUY: '1200000',
    DT_NHO_RANG_KHON: '1000000',
    DT_TAY_TRANG: '2000000',
    DV_KHAM_TMH: '180000',
    DV_NOI_SOI_TMH: '250000',
    DV_KHAM_THINH_LUC: '200000',
    DT_KHIDUNG: '450000',
    DT_VIEM_AMIDAN: '600000',
    DT_RUA_XOANG: '350000',
    DT_LAY_DI_VAT: '400000',
    XN_MAU: '250000',
    SA_O_BUNG: '300000',
    XN_NUOC_TIEU: '120000',
    XN_SINH_HOA: '350000',
    XN_DUONG_HUYET: '80000',
  }))

  const [activeMenu, setActiveMenu] = useState('staff')
  const [staffList, setStaffList] = useState([
    {
      MaNhanSu: 'BS001',
      HoTen: 'Nguyễn Văn An',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0911222333',
      MatKhau: 'hashed_bs001',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS002',
      HoTen: 'Lê Thị Bình',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0922333444',
      MatKhau: 'hashed_bs002',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS003',
      HoTen: 'Phạm Hoàng Long',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0933444555',
      MatKhau: 'hashed_bs003',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS004',
      HoTen: 'Trần Thu Hà',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000004',
      MatKhau: 'hashed_bs004',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS005',
      HoTen: 'Đỗ Minh Quân',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000005',
      MatKhau: 'hashed_bs005',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS006',
      HoTen: 'Vũ Hải Yến',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000006',
      MatKhau: 'hashed_bs006',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS007',
      HoTen: 'Hoàng Đức Mạnh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000007',
      MatKhau: 'hashed_bs007',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS008',
      HoTen: 'Ngô Phương Linh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000008',
      MatKhau: 'hashed_bs008',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS009',
      HoTen: 'Bùi Anh Tuấn',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000009',
      MatKhau: 'hashed_bs009',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS010',
      HoTen: 'Đặng Thùy Dương',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000010',
      MatKhau: 'hashed_bs010',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS011',
      HoTen: 'Phan Quốc Bảo',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000011',
      MatKhau: 'hashed_bs011',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS012',
      HoTen: 'Mai Hương Giang',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000012',
      MatKhau: 'hashed_bs012',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS013',
      HoTen: 'Tạ Văn Dũng',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000013',
      MatKhau: 'hashed_bs013',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS014',
      HoTen: 'Lương Khánh Chi',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000014',
      MatKhau: 'hashed_bs014',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS015',
      HoTen: 'Cao Tiến Đạt',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000015',
      MatKhau: 'hashed_bs015',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS016',
      HoTen: 'Đinh Ngọc Mai',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Nội tổng quát',
      SDT: '0912000016',
      MatKhau: 'hashed_bs016',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS017',
      HoTen: 'Hồ Việt Anh',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Răng hàm mặt',
      SDT: '0912000017',
      MatKhau: 'hashed_bs017',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'BS018',
      HoTen: 'Nguyễn Hồng Sơn',
      VaiTro: 'Bác sĩ',
      ChuyenKhoa: 'Tai mũi họng',
      SDT: '0912000018',
      MatKhau: 'hashed_bs018',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'LT001',
      HoTen: 'Phạm Minh Thư',
      VaiTro: 'Lễ tân',
      ChuyenKhoa: 'Tiếp nhận',
      SDT: '0988777666',
      MatKhau: 'hashed_lt001',
      MaChiNhanh: 'CN_CG',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'LT002',
      HoTen: 'Nguyễn Hoàng Yến',
      VaiTro: 'Lễ tân',
      ChuyenKhoa: 'Tiếp nhận',
      SDT: '0988555444',
      MatKhau: 'hashed_lt002',
      MaChiNhanh: 'CN_HBT',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'XNV001',
      HoTen: 'Trần Văn Cường',
      VaiTro: 'Xét nghiệm viên',
      ChuyenKhoa: 'Xét nghiệm',
      SDT: '0966111222',
      MatKhau: 'hashed_xnv001',
      MaChiNhanh: 'CN_CG',
      TrangThai: 'active',
    },
    {
      MaNhanSu: 'XNV002',
      HoTen: 'Vũ Hồng Ngọc',
      VaiTro: 'Xét nghiệm viên',
      ChuyenKhoa: 'Xét nghiệm',
      SDT: '0966333444',
      MatKhau: 'hashed_xnv002',
      MaChiNhanh: 'CN_HBT',
      TrangThai: 'active',
    },
  ])
  const [patients, setPatients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      DiaChi: 'Cầu Giấy, Hà Nội',
      MaSoBHYT: 'DN4010123456789',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN002',
      HoTen: 'Nguyễn Thị Mai',
      CCCD: '001200054321',
      SDT: '0907654321',
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: 'TE1010999888777',
      KyTuDauBHYT: 'TE',
    },
  ])
  const [staffForm, setStaffForm] = useState({
    HoTen: '',
    VaiTro: 'Bác sĩ',
    ChuyenKhoa: 'Nội khoa',
    SDT: '',
    MatKhau: '',
    MaChiNhanh: '',
  })
  const [staffSearch, setStaffSearch] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [adminStaffLoaded, setAdminStaffLoaded] = useState(false)
  const [adminStaffLoading, setAdminStaffLoading] = useState(false)
  const [adminStaffError, setAdminStaffError] = useState('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [newServiceForm, setNewServiceForm] = useState({
    MaDichVu: '',
    TenDichVu: '',
    LoaiDichVu: 'Khám lâm sàng',
    ChuyenKhoa: 'Nội khoa',
    GiaGoc: '',
  })
  const [branchServices, setBranchServices] = useState([
    { MaCauHinh: 'CH_CG_KHAMNOI', MaChiNhanh: 'CN_CG', MaDichVu: 'DV_KHAM_NOI', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_KHAMRANG', MaChiNhanh: 'CN_CG', MaDichVu: 'DV_KHAM_RANG', SlotGioiHan: 10, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_XNMAU', MaChiNhanh: 'CN_CG', MaDichVu: 'XN_MAU', SlotGioiHan: 20, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_SAOBUNG', MaChiNhanh: 'CN_CG', MaDichVu: 'SA_O_BUNG', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_CG_RANGTUY', MaChiNhanh: 'CN_CG', MaDichVu: 'DT_RANG_TUY', SlotGioiHan: 5, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHAMNOI', MaChiNhanh: 'CN_HBT', MaDichVu: 'DV_KHAM_NOI', SlotGioiHan: 15, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHAMTMH', MaChiNhanh: 'CN_HBT', MaDichVu: 'DV_KHAM_TMH', SlotGioiHan: 12, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_XNMAU', MaChiNhanh: 'CN_HBT', MaDichVu: 'XN_MAU', SlotGioiHan: 20, TrangThai: 'active' },
    { MaCauHinh: 'CH_HBT_KHIDUNG', MaChiNhanh: 'CN_HBT', MaDichVu: 'DT_KHIDUNG', SlotGioiHan: 8, TrangThai: 'active' },
  ])
  const [distributionForm, setDistributionForm] = useState({
    MaChiNhanh: 'CN_CG',
    MaDichVu: 'DV_KHAM_NOI',
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
  const [doctorSchedules, setDoctorSchedules] = useState([
    { MaLichTruc: 'LT_001', MaBacSi: 'BS001', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 1, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_002', MaBacSi: 'BS001', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 2, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_003', MaBacSi: 'BS002', MaChiNhanh: 'CN_CG', NgayTruc: '2026-06-01', CaTruc: 3, TrangThai: 'Đang hoạt động' },
    { MaLichTruc: 'LT_004', MaBacSi: 'BS003', MaChiNhanh: 'CN_HBT', NgayTruc: '2026-06-01', CaTruc: 1, TrangThai: 'Đang hoạt động' },
  ])
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
    MaBacSi: 'BS001',
    MaChiNhanh: 'CN_CG',
    TuNgay: '2026-06-01',
    DenNgay: '2026-06-07',
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

  const clinicalDepartments = [
    'Nội khoa',
    'Nội tổng quát',
    'Răng - Hàm - Mặt',
    'Răng hàm mặt',
    'Tai - Mũi - Họng',
    'Tai mũi họng',
  ]
  const serviceDepartments = [
    'Nội khoa',
    'Nội tổng quát',
    'Răng - Hàm - Mặt',
    'Răng hàm mặt',
    'Tai - Mũi - Họng',
    'Tai mũi họng',
    'Xét nghiệm',
  ]
  const serviceTypes = ['Khám lâm sàng', 'Xét nghiệm', 'Điều trị']
  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]

  const normalizeStaffStatus = (status) => {
    if (status === 'active') return 'Đang hoạt động'
    if (status === 'inactive') return 'Đã khóa'
    return status || 'Đang hoạt động'
  }

  const isStaffActive = (staff) => normalizeStaffStatus(staff?.TrangThai) === 'Đang hoạt động'

  const clinicalDepartmentOptions = useMemo(() => {
    const dbDoctorDepartments = staffList
      .filter((staff) => staff.VaiTro === 'Bác sĩ')
      .map((staff) => staff.ChuyenKhoa)
      .filter(Boolean)
    const dbClinicalServiceDepartments = services
      .filter((service) => service.LoaiDichVu !== 'Xét nghiệm')
      .map((service) => service.ChuyenKhoa)
      .filter(Boolean)

    return Array.from(new Set([...clinicalDepartments, ...dbDoctorDepartments, ...dbClinicalServiceDepartments]))
  }, [services, staffList])

  const serviceDepartmentOptions = useMemo(() => {
    const dbServiceDepartments = services
      .map((service) => service.ChuyenKhoa)
      .filter(Boolean)
    const dbDoctorDepartments = staffList
      .filter((staff) => staff.VaiTro === 'Bác sĩ')
      .map((staff) => staff.ChuyenKhoa)
      .filter(Boolean)

    return Array.from(new Set([...serviceDepartments, ...dbServiceDepartments, ...dbDoctorDepartments]))
  }, [services, staffList])

  const normalizeStaffRecord = (staff) => ({
    ...staff,
    MaNhanSu: staff.MaNhanSu || staff.MaBacSi || staff.MaLeTan || staff.MaXNV,
    VaiTro: staff.VaiTro || (staff.MaBacSi ? 'Bác sĩ' : staff.MaLeTan ? 'Lễ tân' : 'Xét nghiệm viên'),
    ChuyenKhoa:
      staff.ChuyenKhoa ||
      (staff.VaiTro === 'Lễ tân' || staff.MaLeTan
        ? 'Tiếp nhận'
        : staff.VaiTro === 'Xét nghiệm viên' || staff.MaXNV
          ? 'Xét nghiệm'
          : ''),
    TrangThai: normalizeStaffStatus(staff.TrangThai),
  })

  const loadAdminStaffAndPatients = async () => {
    setAdminStaffLoading(true)
    setAdminStaffError('')

    try {
      const [staffResponse, patientResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/admin/staff`),
        fetch(`${BACKEND_URL}/admin/patients`),
      ])
      const [staffResult, patientResult] = await Promise.all([
        staffResponse.json(),
        patientResponse.json(),
      ])

      if (!staffResponse.ok || !staffResult?.success) {
        throw new Error(staffResult?.message || 'Không thể tải danh sách nhân sự.')
      }

      if (!patientResponse.ok || !patientResult?.success) {
        throw new Error(patientResult?.message || 'Không thể tải danh sách bệnh nhân.')
      }

      setStaffList((staffResult.data || []).map(normalizeStaffRecord))
      setPatients(patientResult.data || [])
      setAdminStaffLoaded(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu nhân sự từ hệ thống.'
      setAdminStaffError(message)
      console.warn('ADMIN_STAFF_PATIENT_LOAD_FAILED', message)
    } finally {
      setAdminStaffLoading(false)
    }
  }

  useEffect(() => {
    if (catalogData?.branches?.length) {
      setBranches(catalogData.branches)
    }

    if (catalogData?.services?.length) {
      setServices(catalogData.services)
      setPriceDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          catalogData.services.map((service) => [
            service.MaDichVu,
            String(service.GiaGoc ?? ''),
          ]),
        ),
      }))
    }

    if (catalogData?.branchServices?.length) {
      setBranchServices(
        catalogData.branchServices.map((config) => ({
          ...config,
          SlotGioiHan: Number(config.SlotGioiHan || 0),
          TrangThai: config.TrangThai || 'Đang cung cấp',
        })),
      )
      setSlotDrafts((current) => ({
        ...current,
        ...Object.fromEntries(
          catalogData.branchServices.map((config) => [
            config.MaCauHinh,
            String(config.SlotGioiHan ?? ''),
          ]),
        ),
      }))
    }

    if (catalogData?.doctorSchedules?.length) {
      setDoctorSchedules(
        catalogData.doctorSchedules.map((schedule) => ({
          ...schedule,
          TrangThai: schedule.TrangThai || 'Đang hoạt động',
        })),
      )

      const catalogDoctors = Array.from(
        catalogData.doctorSchedules.reduce((map, schedule) => {
          if (!schedule.MaBacSi || map.has(schedule.MaBacSi)) return map
          map.set(schedule.MaBacSi, {
            MaNhanSu: schedule.MaBacSi,
            HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
            VaiTro: 'Bác sĩ',
            ChuyenKhoa: schedule.ChuyenKhoa || '',
            SDT: schedule.SDT || '',
            MatKhau: '',
            TrangThai: 'active',
          })
          return map
        }, new Map()).values(),
      )

      if (catalogDoctors.length && !adminStaffLoaded) {
        setStaffList((current) => {
          const catalogDoctorIds = new Set(catalogDoctors.map((doctor) => doctor.MaNhanSu))
          const remainingStaff = current.filter((staff) => !catalogDoctorIds.has(staff.MaNhanSu))
          return [...catalogDoctors, ...remainingStaff]
        })
      }
    }
  }, [adminStaffLoaded, catalogData])

  useEffect(() => {
    if (activeMenu === 'staff') {
      loadAdminStaffAndPatients()
    }
  }, [activeMenu])

  const doctors = useMemo(
    () => staffList.filter((staff) => staff.VaiTro === 'Bác sĩ' && isStaffActive(staff)),
    [staffList],
  )

  const filteredStaffList = useMemo(() => {
    const keyword = staffSearch.trim().toLowerCase()
    if (!keyword) return staffList

    return staffList.filter((staff) => {
      const branchName = staff.MaChiNhanh
        ? branches.find((branch) => branch.MaChiNhanh === staff.MaChiNhanh)?.TenChiNhanh
        : ''

      return [staff.MaNhanSu, staff.HoTen, staff.SDT, staff.VaiTro, staff.ChuyenKhoa, staff.MaChiNhanh, branchName]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [branches, staffList, staffSearch])

  const filteredPatients = useMemo(() => {
    const keyword = patientSearch.trim().toLowerCase()
    if (!keyword) return patients

    return patients.filter((patient) =>
      [patient.MaBenhAn, patient.HoTen, patient.CCCD, patient.SDT, patient.DiaChi]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [patients, patientSearch])

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

  const getPatient = (maBenhAn) => patients.find((patient) => patient.MaBenhAn === maBenhAn)

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
      const response = await fetch(`${BACKEND_URL}/admin/reports/monthly?month=${encodeURIComponent(reportMonth)}`)
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

  const handleStaffFormChange = (field, value) => {
    if (field === 'VaiTro') {
      const requiresFixedBranch = value === 'Lễ tân' || value === 'Xét nghiệm viên'
      const departmentByRole = {
        'Bác sĩ': clinicalDepartmentOptions[0] || 'Nội khoa',
        'Lễ tân': 'Tiếp nhận',
        'Xét nghiệm viên': 'Xét nghiệm',
      }

      setStaffForm((current) => ({
        ...current,
        VaiTro: value,
        ChuyenKhoa: departmentByRole[value],
        MaChiNhanh: requiresFixedBranch ? current.MaChiNhanh || branches[0]?.MaChiNhanh || '' : '',
      }))
      return
    }

    setStaffForm((current) => ({ ...current, [field]: value }))
  }

  const buildStaffCode = (vaiTro) => {
    const prefixMap = {
      'Bác sĩ': 'BS',
      'Lễ tân': 'LT',
      'Xét nghiệm viên': 'XNV',
    }
    const prefix = prefixMap[vaiTro]
    const nextNumber =
      staffList.filter((staff) => staff.MaNhanSu.startsWith(prefix)).length + 1

    return `${prefix}${String(nextNumber).padStart(3, '0')}`
  }

  const handleAddStaff = (event) => {
    event.preventDefault()
    const requiresFixedBranch =
      staffForm.VaiTro === 'Lễ tân' || staffForm.VaiTro === 'Xét nghiệm viên'

    if (requiresFixedBranch && !staffForm.MaChiNhanh) {
      notify('Vui lòng chọn chi nhánh phụ trách.', 'error')
      return
    }

    if (requiresFixedBranch) {
      const hasFixedStaffInBranch = staffList.some(
        (staff) =>
          staff.VaiTro === staffForm.VaiTro &&
          staff.MaChiNhanh === staffForm.MaChiNhanh,
      )

      if (hasFixedStaffInBranch) {
        notify('Mỗi chi nhánh chỉ được phép có duy nhất 1 Lễ tân và 1 Xét nghiệm viên cố định!', 'error')
        return
      }
    }

    const createStaff = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/admin/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            HoTen: staffForm.HoTen.trim(),
            VaiTro: staffForm.VaiTro,
            ChuyenKhoa: staffForm.ChuyenKhoa,
            SDT: staffForm.SDT.trim(),
            MatKhau: staffForm.MatKhau.trim(),
            MaChiNhanh: requiresFixedBranch ? staffForm.MaChiNhanh : null,
          }),
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể tạo tài khoản nhân sự.')
        }

        setStaffForm({
          HoTen: '',
          VaiTro: 'Bác sĩ',
          ChuyenKhoa: clinicalDepartmentOptions[0] || 'Nội khoa',
          SDT: '',
          MatKhau: '',
          MaChiNhanh: '',
        })
        await loadAdminStaffAndPatients()
        notify(`Đã tạo tài khoản ${result.data?.MaNhanSu || ''} cho ${result.data?.HoTen || staffForm.HoTen}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể tạo tài khoản nhân sự.'
        notify(message, 'error')
      }
    }

    createStaff()
  }

  const handleToggleStaffStatus = (maNhanSu) => {
    const target = staffList.find((staff) => staff.MaNhanSu === maNhanSu)
    const nextStatus = isStaffActive(target) ? 'Đã khóa' : 'Đang hoạt động'
    const nextActiveDoctor = staffList.find(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        isStaffActive(staff) &&
        staff.MaNhanSu !== maNhanSu,
    )

    const updateStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/admin/staff/${encodeURIComponent(maNhanSu)}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ TrangThai: nextStatus }),
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể cập nhật trạng thái nhân sự.')
        }

        setStaffList((current) =>
          current.map((staff) =>
            staff.MaNhanSu === maNhanSu ? { ...staff, TrangThai: nextStatus } : staff,
          ),
        )

        if (
          target?.VaiTro === 'Bác sĩ' &&
          nextStatus === 'Đã khóa' &&
          bulkScheduleForm.MaBacSi === maNhanSu &&
          nextActiveDoctor
        ) {
          setBulkScheduleForm((current) => ({ ...current, MaBacSi: nextActiveDoctor.MaNhanSu }))
        }

        notify(
          nextStatus === 'Đang hoạt động'
            ? `Đã kích hoạt lại tài khoản ${maNhanSu}.`
            : `Đã vô hiệu hóa tài khoản ${maNhanSu}.`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái nhân sự.'
        notify(message, 'error')
      }
    }

    updateStatus()
  }

  const callAdminJsonApi = async (endpoint, options = {}) => {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    })
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Thao tác quản trị không thành công.')
    }

    return result
  }

  const reloadAdminCatalog = async () => {
    if (typeof reloadCatalogData === 'function') {
      await reloadCatalogData()
    }
  }

  const handleSaveSlot = async (maCauHinh) => {
    const nextSlot = Math.max(0, Number(slotDrafts[maCauHinh] || 0))

    try {
      await callAdminJsonApi(`/admin/branch-services/${encodeURIComponent(maCauHinh)}/slot`, {
        method: 'PUT',
        body: JSON.stringify({ SlotGioiHan: nextSlot }),
      })
      setBranchServices((current) =>
        current.map((config) =>
          config.MaCauHinh === maCauHinh ? { ...config, SlotGioiHan: nextSlot } : config,
        ),
      )
      setSlotDrafts((current) => ({ ...current, [maCauHinh]: String(nextSlot) }))
      await reloadAdminCatalog()
      notify(`Đã cập nhật SlotGioiHan cho cấu hình ${maCauHinh}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể cập nhật SlotGioiHan.', 'error')
    }
  }

  const handleUpdateServicePrice = async (maDichVu) => {
    const nextPrice = Math.max(0, Number(priceDrafts[maDichVu] || 0))

    try {
      await callAdminJsonApi(`/admin/services/${encodeURIComponent(maDichVu)}/price`, {
        method: 'PUT',
        body: JSON.stringify({ GiaGoc: nextPrice }),
      })
      setServices((current) =>
        current.map((service) =>
          service.MaDichVu === maDichVu ? { ...service, GiaGoc: nextPrice } : service,
        ),
      )
      setPriceDrafts((current) => ({ ...current, [maDichVu]: String(nextPrice) }))
      await reloadAdminCatalog()
      notify(`Đã cập nhật giá chung cho dịch vụ ${maDichVu}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể cập nhật giá dịch vụ.', 'error')
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

    try {
      const formData = new FormData()
      formData.append('ma_dich_vu', maDichVu)
      formData.append('ten_dich_vu', tenDichVu)
      formData.append('chuyen_khoa', newServiceForm.ChuyenKhoa)
      formData.append('loai_dich_vu', newServiceForm.LoaiDichVu)
      formData.append('gia_goc', String(giaGoc))

      const response = await fetch(`${BACKEND_URL}/admin/services/create`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể thêm dịch vụ.')
      }

      await reloadAdminCatalog()
      setDistributionForm((current) => ({ ...current, MaDichVu: maDichVu }))
      setNewServiceForm({
        MaDichVu: '',
        TenDichVu: '',
        LoaiDichVu: 'Khám lâm sàng',
        ChuyenKhoa: serviceDepartmentOptions[0] || 'Nội khoa',
        GiaGoc: '',
      })
      notify(`Đã thêm dịch vụ ${maDichVu} vào danh mục gốc.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể thêm dịch vụ.', 'error')
    }
  }

  const handleDeleteRootService = async (maDichVu) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa dịch vụ ${maDichVu}? Hệ thống sẽ chặn nếu dịch vụ đã phát sinh lịch hẹn, xét nghiệm hoặc điều trị.`,
    )
    if (!confirmed) return

    try {
      await callAdminJsonApi(`/admin/services/${encodeURIComponent(maDichVu)}`, {
        method: 'DELETE',
      })
      await reloadAdminCatalog()
      notify(`Đã xóa dịch vụ gốc ${maDichVu}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể xóa dịch vụ.', 'error')
    }
  }

  const handleDeleteRootServiceLocal = (maDichVu) => {
    const remainingServices = services.filter((service) => service.MaDichVu !== maDichVu)
    const relatedConfigs = branchServices.filter((config) => config.MaDichVu === maDichVu)
    const relatedConfigIds = relatedConfigs.map((config) => config.MaCauHinh)
    const nextSelectedService =
      distributionForm.MaDichVu === maDichVu
        ? remainingServices[0]?.MaDichVu || ''
        : distributionForm.MaDichVu

    setServices(remainingServices)
    setBranchServices((current) => current.filter((config) => config.MaDichVu !== maDichVu))
    setDistributionForm((current) => ({ ...current, MaDichVu: nextSelectedService }))
    setPriceDrafts((current) => {
      const nextDrafts = { ...current }
      delete nextDrafts[maDichVu]
      return nextDrafts
    })
    setSlotDrafts((current) => {
      const nextDrafts = { ...current }
      relatedConfigIds.forEach((maCauHinh) => {
        delete nextDrafts[maCauHinh]
      })
      return nextDrafts
    })
    notify(
      `Đã xóa dịch vụ gốc ${maDichVu} và ${relatedConfigs.length} cấu hình chi nhánh liên quan.`,
    )
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

    try {
      const formData = new FormData()
      formData.append('ma_chi_nhanh', maChiNhanh)
      formData.append('ten_chi_nhanh', tenChiNhanh)
      formData.append('dia_chi', diaChi)
      formData.append('sdt', branchForm.SDT.trim())

      const response = await fetch(`${BACKEND_URL}/admin/branches/create`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể thêm chi nhánh.')
      }

      await reloadAdminCatalog()
      setDistributionForm((current) => ({ ...current, MaChiNhanh: maChiNhanh }))
      setBranchForm({ MaChiNhanh: '', TenChiNhanh: '', DiaChi: '', SDT: '' })
      notify(`Đã thêm chi nhánh ${maChiNhanh}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể thêm chi nhánh.', 'error')
    }
  }

  const handleDeleteRootBranch = async (maChiNhanh) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa chi nhánh ${maChiNhanh}? Hệ thống sẽ chặn nếu chi nhánh đã có lịch hẹn, lịch trực hoặc nhân sự phụ trách.`,
    )
    if (!confirmed) return

    try {
      await callAdminJsonApi(`/admin/branches/${encodeURIComponent(maChiNhanh)}`, {
        method: 'DELETE',
      })
      await reloadAdminCatalog()
      notify(`Đã xóa chi nhánh ${maChiNhanh}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể xóa chi nhánh.', 'error')
    }
  }

  const handleDeleteRootBranchLocal = (maChiNhanh) => {
    const remainingBranches = branches.filter((branch) => branch.MaChiNhanh !== maChiNhanh)
    const relatedConfigs = branchServices.filter((config) => config.MaChiNhanh === maChiNhanh)
    const relatedConfigIds = relatedConfigs.map((config) => config.MaCauHinh)
    const relatedSchedules = doctorSchedules.filter((schedule) => schedule.MaChiNhanh === maChiNhanh)
    const nextSelectedBranch =
      distributionForm.MaChiNhanh === maChiNhanh
        ? remainingBranches[0]?.MaChiNhanh || ''
        : distributionForm.MaChiNhanh

    setBranches(remainingBranches)
    setBranchServices((current) => current.filter((config) => config.MaChiNhanh !== maChiNhanh))
    setDoctorSchedules((current) => current.filter((schedule) => schedule.MaChiNhanh !== maChiNhanh))
    setDistributionForm((current) => ({ ...current, MaChiNhanh: nextSelectedBranch }))
    setBulkScheduleForm((current) => ({
      ...current,
      MaChiNhanh: current.MaChiNhanh === maChiNhanh ? nextSelectedBranch : current.MaChiNhanh,
    }))
    setServiceFilters((current) => ({
      ...current,
      MaChiNhanh: current.MaChiNhanh === maChiNhanh ? 'all' : current.MaChiNhanh,
    }))
    setSlotDrafts((current) => {
      const nextDrafts = { ...current }
      relatedConfigIds.forEach((maCauHinh) => {
        delete nextDrafts[maCauHinh]
      })
      return nextDrafts
    })
    notify(
      `Đã xóa chi nhánh ${maChiNhanh}, ${relatedConfigs.length} cấu hình dịch vụ và ${relatedSchedules.length} lịch trực liên quan.`,
    )
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

    try {
      const result = await callAdminJsonApi('/admin/branch-services', {
        method: 'POST',
        body: JSON.stringify({
          MaChiNhanh: distributionForm.MaChiNhanh,
          MaDichVu: distributionForm.MaDichVu,
          SlotGioiHan: slot,
        }),
      })
      await reloadAdminCatalog()
      if (result.data?.MaCauHinh) {
        setSlotDrafts((current) => ({ ...current, [result.data.MaCauHinh]: String(slot) }))
      }
      notify(`Đã áp dụng dịch vụ ${distributionForm.MaDichVu} cho ${distributionForm.MaChiNhanh}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể áp dụng dịch vụ cho chi nhánh.', 'error')
    }
  }

  const handleToggleBranchService = async (maCauHinh) => {
    const target = branchServices.find((config) => config.MaCauHinh === maCauHinh)
    const isCurrentlyActive = target?.TrangThai === 'active' || target?.TrangThai === 'Đang cung cấp'
    const nextStatus = isCurrentlyActive ? 'Tạm ngừng' : 'Đang cung cấp'

    try {
      await callAdminJsonApi(`/admin/branch-services/${encodeURIComponent(maCauHinh)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ TrangThai: nextStatus }),
      })
      setBranchServices((current) =>
        current.map((config) =>
          config.MaCauHinh === maCauHinh ? { ...config, TrangThai: nextStatus } : config,
        ),
      )
      await reloadAdminCatalog()
      notify(
        nextStatus === 'Đang cung cấp'
          ? `Đã mở lại cấu hình ${maCauHinh} cho bệnh nhân đặt lịch.`
          : `Đã tạm ngừng cấu hình ${maCauHinh}; bệnh nhân sẽ không đặt lịch mới được.`,
      )
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái cấu hình.', 'error')
    }
  }

  const handleDeleteBranchService = async (maCauHinh) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa cấu hình ${maCauHinh}? Hệ thống sẽ chặn nếu cấu hình đã phát sinh lịch hẹn.`,
    )
    if (!confirmed) return

    try {
      await callAdminJsonApi(`/admin/branch-services/${encodeURIComponent(maCauHinh)}`, {
        method: 'DELETE',
      })
      setBranchServices((current) => current.filter((config) => config.MaCauHinh !== maCauHinh))
      setSlotDrafts((current) => {
        const nextDrafts = { ...current }
        delete nextDrafts[maCauHinh]
        return nextDrafts
      })
      await reloadAdminCatalog()
      notify(`Đã xóa cấu hình ${maCauHinh} khỏi chi nhánh.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể xóa cấu hình dịch vụ chi nhánh.', 'error')
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
      const response = await fetch(`${BACKEND_URL}/admin/doctor-schedules?${params.toString()}`)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch trực từ database.')
      }

      setDoctorSchedules((result.data || []).map(normalizeAdminSchedule))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch trực từ database.'
      setAdminScheduleError(message)
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
    let runningIndex = doctorSchedules.length + 1

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
            MaLichTruc: `LT_${String(runningIndex).padStart(3, '0')}`,
            MaBacSi: bulkScheduleForm.MaBacSi,
            MaChiNhanh: bulkScheduleForm.MaChiNhanh,
            NgayTruc: ngayTruc,
            CaTruc: ca,
            TrangThai: 'Đang hoạt động',
          })
          existingKeys.add(duplicateKey)
          runningIndex += 1
        }
      }
    }

    if (newSchedules.length === 0) {
      notify('Không có lịch trực mới được tạo vì toàn bộ lựa chọn đã trùng lịch hiện có.', 'error')
      return
    }

    try {
      const createdSchedules = []

      for (const schedule of newSchedules) {
        const formData = new FormData()
        formData.append('ma_bac_si', schedule.MaBacSi)
        formData.append('ma_chi_nhanh', schedule.MaChiNhanh)
        formData.append('ngay_truc', schedule.NgayTruc)
        formData.append('ca_truc', String(schedule.CaTruc))

        const response = await fetch(`${BACKEND_URL}/admin/doctor-schedules/create`, {
          method: 'POST',
          body: formData,
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || `Không thể tạo lịch trực ngày ${schedule.NgayTruc} ca ${schedule.CaTruc}.`)
        }

        createdSchedules.push({
          ...schedule,
          id: result.data?.id ?? null,
          MaLichTruc: result.data?.MaLichTruc || schedule.MaLichTruc,
        })
      }

      setDoctorSchedules((current) => [...current, ...createdSchedules])
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
      const response = await fetch(`${BACKEND_URL}/admin/doctor-schedules/cancel`, {
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
        isStaffActive(staff) &&
        staff.MaNhanSu !== schedule.MaBacSi &&
        staff.ChuyenKhoa === currentDoctor?.ChuyenKhoa,
    )

    if (sameSpecialtyDoctors.length > 0) return sameSpecialtyDoctors

    return staffList.filter(
      (staff) =>
        staff.VaiTro === 'Bác sĩ' &&
        isStaffActive(staff) &&
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
      const response = await fetch(`${BACKEND_URL}/admin/doctor-schedules/transfer`, {
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
      <section className="admin-card">
        <div className="admin-section-header">
          <div>
            <h2>Quản lý Nhân sự</h2>
            <p>Tạo tài khoản cho Bác sĩ, Lễ tân và Xét nghiệm viên theo đúng mã định danh hệ thống.</p>
          </div>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddStaff}>
          <label>
            Họ tên
            <input
              className="admin-input"
              value={staffForm.HoTen}
              onChange={(event) => handleStaffFormChange('HoTen', event.target.value)}
              required
            />
          </label>
          <label>
            Vai trò
            <select
              className="admin-input"
              value={staffForm.VaiTro}
              onChange={(event) => handleStaffFormChange('VaiTro', event.target.value)}
            >
              <option value="Bác sĩ">Bác sĩ</option>
              <option value="Lễ tân">Lễ tân</option>
              <option value="Xét nghiệm viên">Xét nghiệm viên</option>
            </select>
          </label>
          <label>
            Chuyên khoa/Bộ phận
            <select
              className="admin-input"
              value={staffForm.ChuyenKhoa}
              onChange={(event) => handleStaffFormChange('ChuyenKhoa', event.target.value)}
              disabled={staffForm.VaiTro !== 'Bác sĩ'}
            >
              {staffForm.VaiTro === 'Bác sĩ' ? (
                clinicalDepartmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))
              ) : (
                <option value={staffForm.ChuyenKhoa}>{staffForm.ChuyenKhoa}</option>
              )}
            </select>
          </label>
          {(staffForm.VaiTro === 'Lễ tân' || staffForm.VaiTro === 'Xét nghiệm viên') && (
            <label className="admin-fixed-branch-field">
              Chi nhánh phụ trách
              <select
                className="admin-input"
                value={staffForm.MaChiNhanh}
                onChange={(event) => handleStaffFormChange('MaChiNhanh', event.target.value)}
                required
              >
                {branches.map((branch) => (
                  <option key={branch.MaChiNhanh} value={branch.MaChiNhanh}>
                    {branch.TenChiNhanh}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Số điện thoại
            <input
              className="admin-input"
              value={staffForm.SDT}
              onChange={(event) => handleStaffFormChange('SDT', event.target.value)}
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              className="admin-input"
              type="password"
              value={staffForm.MatKhau}
              onChange={(event) => handleStaffFormChange('MatKhau', event.target.value)}
              required
            />
          </label>
          <button type="submit" className="admin-primary-button">
            Thêm nhân sự
          </button>
        </form>

        <label className="admin-search-field">
          <span>Tìm kiếm nhân sự</span>
          <input
            className="admin-input"
            value={staffSearch}
            onChange={(event) => setStaffSearch(event.target.value)}
            placeholder="Tìm theo mã, họ tên, SĐT, vai trò hoặc chuyên khoa"
          />
        </label>

        {adminStaffLoading && <p className="admin-muted-text">Đang tải dữ liệu nhân sự từ database...</p>}
        {adminStaffError && <p className="admin-error-text">{adminStaffError}</p>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã nhân sự</th>
                <th>Họ tên</th>
                <th>Vai trò</th>
                <th>Chuyên khoa/Bộ phận</th>
                <th>Chi nhánh phụ trách</th>
                <th>Số điện thoại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaffList.map((staff) => (
                <tr key={staff.MaNhanSu}>
                  <td>{staff.MaNhanSu}</td>
                  <td>{staff.HoTen}</td>
                  <td>{staff.VaiTro}</td>
                  <td>{staff.ChuyenKhoa}</td>
                  <td>{staff.MaChiNhanh ? getBranchName(staff.MaChiNhanh) : 'Linh hoạt theo lịch trực'}</td>
                  <td>{staff.SDT}</td>
                  <td>
                    <span className={`status-pill ${isStaffActive(staff) ? 'active' : 'muted'}`}>
                      {isStaffActive(staff) ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={
                        isStaffActive(staff)
                          ? 'admin-danger-button'
                          : 'admin-success-button'
                      }
                      onClick={() => handleToggleStaffStatus(staff.MaNhanSu)}
                    >
                      {isStaffActive(staff) ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStaffList.length === 0 && (
                <tr>
                  <td colSpan="8">Không tìm thấy nhân sự phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Danh sách Bệnh nhân</h2>
        <p>Bệnh nhân chỉ theo dõi tại Admin; tài khoản được tạo từ màn hình đăng ký bệnh nhân.</p>
        <label className="admin-search-field">
          <span>Tìm kiếm bệnh nhân</span>
          <input
            className="admin-input"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Tìm theo mã bệnh án, CCCD, họ tên, SĐT hoặc địa chỉ"
          />
        </label>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã bệnh án</th>
                <th>Họ tên</th>
                <th>Số CCCD</th>
                <th>Số điện thoại</th>
                <th>Địa chỉ</th>
                <th>Mã số BHYT</th>
                <th>Ký tự đầu BHYT</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((patient) => (
                <tr key={patient.MaBenhAn}>
                  <td>{patient.MaBenhAn}</td>
                  <td>{patient.HoTen}</td>
                  <td>{patient.CCCD}</td>
                  <td>{patient.SDT}</td>
                  <td>{patient.DiaChi}</td>
                  <td>{patient.MaSoBHYT || 'Không có'}</td>
                  <td>{patient.KyTuDauBHYT || 'Không có'}</td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="7">Không tìm thấy bệnh nhân phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              {serviceDepartmentOptions.map((department) => (
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
                      <button
                        type="button"
                        className="admin-delete-button"
                        onClick={() => handleDeleteRootService(service.MaDichVu)}
                      >
                        Xóa gốc
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
              <div className="admin-branch-card-actions">
                <button
                  type="button"
                  className="admin-delete-button"
                  onClick={() => handleDeleteRootBranch(branch.MaChiNhanh)}
                >
                  Xóa chi nhánh
                </button>
              </div>
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
                      <span className={`status-pill ${config.TrangThai === 'active' || config.TrangThai === 'Đang cung cấp' ? 'active' : 'muted'}`}>
                        {config.TrangThai === 'active' || config.TrangThai === 'Đang cung cấp' ? 'Đang cung cấp' : 'Tạm ngừng'}
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
                            config.TrangThai === 'active' || config.TrangThai === 'Đang cung cấp'
                              ? 'admin-danger-button'
                              : 'admin-success-button'
                          }
                          onClick={() => handleToggleBranchService(config.MaCauHinh)}
                        >
                          {config.TrangThai === 'active' || config.TrangThai === 'Đang cung cấp' ? 'Tạm ngừng' : 'Mở lại'}
                        </button>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={() => handleDeleteBranchService(config.MaCauHinh)}
                        >
                          Xóa
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
                const appointmentCount = getAppointmentCountForSchedule(schedule)
                const isCancelled = schedule.TrangThai === 'Đã hủy'
                return (
                  <tr key={schedule.id ? `schedule-${schedule.id}` : `${schedule.MaLichTruc}-${schedule.MaBacSi}-${schedule.MaChiNhanh}-${schedule.NgayTruc}-${schedule.CaTruc}`}>
                    <td>{getDoctorName(schedule.MaBacSi)}</td>
                    <td>{getBranchName(schedule.MaChiNhanh)}</td>
                    <td>{schedule.NgayTruc}</td>
                    <td>Ca {schedule.CaTruc}</td>
                    <td>{appointmentCount}</td>
                    <td>
                      <span className={`status-pill ${isCancelled ? 'danger' : 'active'}`}>
                        {isCancelled ? 'Đã hủy' : 'Đang hoạt động'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions-row">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => handleOpenDoctorTransfer(schedule)}
                          disabled={isCancelled}
                        >
                          🔄 Đổi bác sĩ
                        </button>
                        <button
                          type="button"
                          className="admin-danger-button"
                          onClick={() => handleCancelSchedule(schedule)}
                          disabled={isCancelled}
                        >
                          {isCancelled ? 'Đã hủy' : 'Hủy ca trực'}
                        </button>
                      </div>
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
          <span>Tổng Lượt Hoàn Thành</span>
          <strong>{displayReportData.completedAppointmentCount}</strong>
          <small>Lịch hẹn có trạng thái Hoàn thành hoặc dữ liệu cũ Đã khám</small>
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
                <th>Tổng lượt hoàn thành</th>
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

function DoctorDashboard({ user, onLogout, showNotification, scheduleAdjustments = [], catalogData = EMPTY_CATALOG_DATA }) {
  const [doctorProfile, setDoctorProfile] = useState({
    MaBacSi: user?.MaBacSi || user?.id || 'BS001',
    HoTen: user?.HoTen || user?.name || 'Nguyễn Văn An',
    ChuyenKhoa: user?.ChuyenKhoa || 'Nội tổng quát',
    SDT: user?.SDT || '0911222333',
    MatKhau: user?.MatKhau || '123456',
    MaChiNhanh: user?.MaChiNhanh || 'CN_CG',
    TenChiNhanh: user?.TenChiNhanh || 'Medicare - Cơ sở Cầu Giấy',
  })
  const [contactForm, setContactForm] = useState({ SDT: doctorProfile.SDT })
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [activeDoctorTab, setActiveDoctorTab] = useState('clinic')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [activeBookingId, setActiveBookingId] = useState('')
  const [doctorLiveRows, setDoctorLiveRows] = useState([])
  const [hasLoadedDoctorQueue, setHasLoadedDoctorQueue] = useState(false)
  const [doctorQueueLoading, setDoctorQueueLoading] = useState(false)
  const [doctorQueueError, setDoctorQueueError] = useState('')
  const [doctorActionLoading, setDoctorActionLoading] = useState('')
  const [savingExam, setSavingExam] = useState(false)
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [historyDetail, setHistoryDetail] = useState(null)
  const [clinicalForm, setClinicalForm] = useState({
    TrieuChung: '',
    MaBenh: '',
    LoiDan: '',
    MaThuoc: 'TH001',
    SoLuong: '10',
    LieuDung: '',
    MaXetNghiem: 'XN_MAU',
    MaDieuTri: 'DT_TRUYEN_DICH',
    TongSoBuoi: '3',
  })
  const [diagnosisSearch, setDiagnosisSearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('Omeprazole 20mg')
  const [currentPrescription, setCurrentPrescription] = useState([])
  const [feedback, setFeedback] = useState('')
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      NgaySinh: '1995-04-12',
      DiaChi: 'Cầu Giấy, Hà Nội',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      NgaySinh: '1986-09-20',
      DiaChi: 'Nam Từ Liêm, Hà Nội',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      NgaySinh: '1987-02-15',
      DiaChi: 'Thanh Xuân, Hà Nội',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      NgaySinh: '2021-01-08',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      KyTuDauBHYT: 'TE',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'DT_TRUYEN_DICH', TenDichVu: 'Liệu trình truyền dịch giải độc, bù nước', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 250000 },
    { MaDichVu: 'DT_RANG_TUY', TenDichVu: 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1200000 },
    { MaDichVu: 'DT_KHIDUNG', TenDichVu: 'Liệu Trình Khí Dung Mũi Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 450000 },
  ])
  const generateDoctorSchedules = () => {
    const doctorSeeds = [
      { MaBacSi: 'BS001', offset: 0 },
      { MaBacSi: 'BS002', offset: 2 },
      { MaBacSi: 'BS015', offset: 4 },
    ]
    const generatedSchedules = []
    let runningIndex = 1

    doctorSeeds.forEach((doctorSeed) => {
      for (
        let time = Date.UTC(2026, 4, 31), dayIndex = 0;
        time <= Date.UTC(2026, 6, 1);
        time += 86400000, dayIndex += 1
      ) {
        const schedulePattern = (dayIndex + doctorSeed.offset) % 7
        const shouldWorkThisDay = [0, 1, 3, 5].includes(schedulePattern)
        if (!shouldWorkThisDay) continue

        const ngayTruc = new Date(time).toISOString().slice(0, 10)
        const caTruc = ((dayIndex + doctorSeed.offset) % 4) + 1
        const maChiNhanh = (dayIndex + doctorSeed.offset) % 3 === 0 ? 'CN_HBT' : 'CN_CG'

        generatedSchedules.push({
          MaLichTruc: `LT_${doctorSeed.MaBacSi}_${String(runningIndex).padStart(3, '0')}`,
          MaBacSi: doctorSeed.MaBacSi,
          MaChiNhanh: maChiNhanh,
          NgayTruc: ngayTruc,
          CaTruc: caTruc,
          TrangThai: 'Đang hoạt động',
        })
        runningIndex += 1
      }
    })

    return generatedSchedules
  }
  const [baseDoctorSchedules] = useState(() => generateDoctorSchedules())
  const catalogDoctorSchedules = (catalogData?.doctorSchedules || []).map((schedule) => ({
    ...schedule,
    TrangThai: schedule.TrangThai || 'Đang hoạt động',
  }))
  const doctorSchedules = useMemo(() => {
    let effectiveSchedules = catalogDoctorSchedules.length ? [...catalogDoctorSchedules] : [...baseDoctorSchedules]
    const orderedAdjustments = [...scheduleAdjustments].reverse()

    orderedAdjustments.forEach((adjustment) => {
      const matchesOriginalSlot = (schedule) =>
        schedule.MaChiNhanh === adjustment.MaChiNhanh &&
        schedule.NgayTruc === adjustment.NgayTruc &&
        Number(schedule.CaTruc) === Number(adjustment.CaTruc) &&
        schedule.MaBacSi === (adjustment.oldMaBacSi || adjustment.MaBacSi)

      if (adjustment.type === 'cancel') {
        effectiveSchedules = effectiveSchedules.filter((schedule) => !matchesOriginalSlot(schedule))
      }

      if (adjustment.type === 'transfer') {
        effectiveSchedules = effectiveSchedules.filter((schedule) => !matchesOriginalSlot(schedule))
        effectiveSchedules.push({
          MaLichTruc: adjustment.MaLichTruc,
          MaBacSi: adjustment.newMaBacSi,
          MaChiNhanh: adjustment.MaChiNhanh,
          NgayTruc: adjustment.NgayTruc,
          CaTruc: adjustment.CaTruc,
          TrangThai: 'Đang hoạt động',
        })
      }
    })

    return effectiveSchedules
  }, [baseDoctorSchedules, catalogDoctorSchedules, scheduleAdjustments])
  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_DR_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 1,
      ThoiGianCheckIn: '08:05',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_002',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 2,
      ThoiGianCheckIn: '08:14',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_003',
      MaBenhAn: 'BN005',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-31',
      CaKham: 1,
      STT_HangDoi: 3,
      ThoiGianCheckIn: '08:21',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_004',
      MaBenhAn: 'BN003',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS002',
      NgayKham: '2026-05-31',
      CaKham: 2,
      STT_HangDoi: 1,
      ThoiGianCheckIn: '09:02',
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_DR_005',
      MaLuotKham: 'LK_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-05-10',
      CaKham: 1,
      ThoiGianCheckIn: '08:10',
      TrangThai: 'Đã khám',
    },
    {
      MaLichHen: 'LH_DR_006',
      MaLuotKham: 'LK_002',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-04-18',
      CaKham: 2,
      ThoiGianCheckIn: '14:05',
      TrangThai: 'Đã khám',
    },
    {
      MaLichHen: 'LH_DR_007',
      MaLuotKham: 'LK_003',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_TIM_MACH',
      MaChiNhanh: 'CN_CG',
      MaBacSi: 'BS001',
      NgayKham: '2026-03-22',
      CaKham: 1,
      ThoiGianCheckIn: '09:30',
      TrangThai: 'Đã khám',
    },
  ])
  const [diseases] = useState([
    { MaBenh: 'K29', TenBenh: 'Viêm dạ dày và tá tràng' },
    { MaBenh: 'K21', TenBenh: 'Trào ngược dạ dày thực quản' },
    { MaBenh: 'J01', TenBenh: 'Viêm xoang cấp' },
    { MaBenh: 'K05', TenBenh: 'Viêm nướu và bệnh nha chu' },
    { MaBenh: 'ICD_MMLL', TenBenh: 'Mệt mỏi lao lực' },
  ])
  const [visitRecords, setVisitRecords] = useState([
    {
      MaLuotKham: 'LK_001',
      MaBenhAn: 'BN001',
      NgayKham: '2026-05-10',
      MaBacSi: 'BS001',
      TrieuChung: 'Đau rát thượng vị, đầy hơi sau ăn, buồn nôn nhẹ.',
      MaBenh: 'K29',
      LoiDan: 'Ăn uống đúng giờ, kiêng đồ cay nóng, tái khám nếu đau tăng.',
    },
    {
      MaLuotKham: 'LK_002',
      MaBenhAn: 'BN001',
      NgayKham: '2026-04-18',
      MaBacSi: 'BS001',
      TrieuChung: 'Ợ nóng sau ăn, đau âm ỉ vùng thượng vị.',
      MaBenh: 'K21',
      LoiDan: 'Không nằm ngay sau ăn, chia nhỏ bữa, dùng thuốc đủ liệu trình.',
    },
    {
      MaLuotKham: 'LK_003',
      MaBenhAn: 'BN004',
      NgayKham: '2026-03-22',
      MaBacSi: 'BS001',
      TrieuChung: 'Mệt mỏi, đau đầu nhẹ, huyết áp dao động.',
      MaBenh: 'K29',
      LoiDan: 'Theo dõi huyết áp tại nhà, ngủ đủ giấc, hạn chế rượu bia.',
    },
    {
      MaLuotKham: 'LK_004',
      MaBenhAn: 'BN003',
      NgayKham: '2026-04-02',
      MaBacSi: 'BS002',
      TrieuChung: 'Chảy máu chân răng khi đánh răng, ê buốt răng hàm dưới.',
      MaBenh: 'K05',
      LoiDan: 'Vệ sinh răng miệng đúng cách, dùng chỉ nha khoa, tái khám nha chu.',
    },
  ])
  const [medicines] = useState([
    { MaThuoc: 'TH001', TenThuoc: 'Omeprazole 20mg', DonViTinh: 'Viên' },
    { MaThuoc: 'TH002', TenThuoc: 'Phosphalugel', DonViTinh: 'Gói' },
    { MaThuoc: 'TH003', TenThuoc: 'Domperidone 10mg', DonViTinh: 'Viên' },
    { MaThuoc: 'TH004', TenThuoc: 'Loratadine 10mg', DonViTinh: 'Viên' },
  ])
  const [prescriptionDetails, setPrescriptionDetails] = useState([
    { MaDonThuoc: 'DT001', MaLuotKham: 'LK_001', MaThuoc: 'TH001', SoLuong: 14, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 14 ngày.' },
    { MaDonThuoc: 'DT002', MaLuotKham: 'LK_001', MaThuoc: 'TH002', SoLuong: 10, LieuDung: 'Uống 1 gói khi đau hoặc nóng rát dạ dày.' },
    { MaDonThuoc: 'DT003', MaLuotKham: 'LK_002', MaThuoc: 'TH003', SoLuong: 10, LieuDung: 'Uống 1 viên trước bữa ăn khi buồn nôn hoặc đầy hơi.' },
    { MaDonThuoc: 'DT004', MaLuotKham: 'LK_003', MaThuoc: 'TH004', SoLuong: 7, LieuDung: 'Uống 1 viên mỗi tối trong 7 ngày.' },
  ])
  const [labDetails, setLabDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'XN_MAU',
      KetQuaXetNghiem: 'Bạch cầu trong giới hạn bình thường, Hemoglobin 145 g/L.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_002',
      MaLuotKham: 'LK_002',
      MaDichVu: 'SA_O_BUNG',
      KetQuaXetNghiem: 'Gan không to, nhu mô gan hơi tăng âm, túi mật không sỏi.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_SINH_HOA',
      KetQuaXetNghiem: 'Men gan AST/ALT trong giới hạn, chức năng thận bình thường.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
  ])
  const [treatmentSchedules, setTreatmentSchedules] = useState([
    {
      MaLichTrinh: 'LTDT_OLD_001',
      MaLuotKham: 'LK_001',
      TenDichVu: 'Liệu trình Điều trị tủy răng sinh học',
      TongSoBuoi: 5,
      SoBuoiDaLam: 2,
      TrangThai: 'Đang tiến hành',
      GhiChuDieuTri: 'Răng đỡ đau, tiếp tục theo dõi và hàn kín vào buổi tới.',
    },
    {
      MaLichTrinh: 'LTDT_OLD_002',
      MaLuotKham: 'LK_003',
      TenDichVu: 'Vật lý trị liệu phục hồi chức năng',
      TongSoBuoi: 3,
      SoBuoiDaLam: 3,
      TrangThai: 'Đã hoàn thành',
      GhiChuDieuTri: 'Răng đỡ đau, tiếp tục theo dõi và hàn kín vào buổi tới.',
    },
  ])

  const effectiveServices = catalogData?.services?.length ? catalogData.services : services
  const effectiveDiseases = catalogData?.diseases?.length ? catalogData.diseases : diseases
  const effectiveMedicines = catalogData?.medicines?.length ? catalogData.medicines : medicines
  const effectiveBranches = catalogData?.branches?.length
    ? catalogData.branches
    : [
        { MaChiNhanh: 'CN_CG', TenChiNhanh: 'Cơ sở Cầu Giấy' },
        { MaChiNhanh: 'CN_HBT', TenChiNhanh: 'Cơ sở Hai Bà Trưng' },
      ]

  const getPatient = (maBenhAn) =>
    doctorPatientMap.get(maBenhAn) ||
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      SDT: 'Chưa cập nhật',
    }

  const getService = (maDichVu) =>
    effectiveServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
    }

  const getDisease = (maBenh) =>
    effectiveDiseases.find((disease) => disease.MaBenh === maBenh) || {
      MaBenh: maBenh,
      TenBenh: 'Chưa xác định',
    }

  const getMedicine = (maThuoc) =>
    effectiveMedicines.find((medicine) => medicine.MaThuoc === maThuoc) || {
      MaThuoc: maThuoc,
      TenThuoc: maThuoc,
      DonViTinh: '',
    }

  const getShiftLabel = (caTruc) => {
    const labels = {
      1: 'Ca 1 (07:30 - 10:15)',
      2: 'Ca 2 (10:15 - 12:00)',
      3: 'Ca 3 (13:30 - 16:30)',
      4: 'Ca 4 (16:30 - 19:30)',
    }
    return labels[Number(caTruc)] || `Ca ${caTruc}`
  }

  const formatDateKey = (date) => date.toISOString().slice(0, 10)

  const addDays = (date, days) => {
    const nextDate = new Date(date)
    nextDate.setUTCDate(nextDate.getUTCDate() + days)
    return nextDate
  }

  const getWeekStart = (dateKey) => {
    const date = new Date(`${dateKey}T00:00:00Z`)
    const day = date.getUTCDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    return addDays(date, diffToMonday)
  }

  const getWeekdayLabel = (date) => {
    const labels = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return labels[date.getUTCDay()]
  }

  const getShortBranchName = (maChiNhanh) =>
    effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh)?.TenChiNhanh ||
    (maChiNhanh === 'CN_CG'
      ? 'Cơ sở Cầu Giấy'
      : maChiNhanh === 'CN_HBT'
        ? 'Cơ sở Hai Bà Trưng'
        : maChiNhanh)

  const buildCurrentVisitId = (booking) =>
    booking?.MaLuotKham || (booking ? `TEMP_VISIT_${booking.MaLichHen}` : '')

  const normalizeDoctorBooking = (booking) => ({
    MaLichHen: booking.MaLichHen,
    MaLuotKham: booking.MaLuotKham || '',
    MaBenhAn: booking.MaBenhAn || '',
    MaDichVu: booking.MaDichVu || '',
    TenDichVu: booking.TenDichVu || '',
    LoaiDichVu: booking.LoaiDichVu || '',
    MaChiNhanh: booking.MaChiNhanh || '',
    TenChiNhanh: booking.TenChiNhanh || '',
    MaBacSi: booking.MaBacSi || doctorProfile.MaBacSi,
    NgayKham: booking.NgayKham || '',
    CaKham: booking.CaKham || '',
    STT: booking.STT || booking.STT_HangDoi || '',
    STT_HangDoi: booking.STT_HangDoi || booking.STT || '',
    ThoiGianCheckIn: booking.ThoiGianCheckIn || '',
    TrangThai: booking.TrangThai || 'Chờ khám',
    GiaCuoi: booking.GiaCuoi || 0,
    PaymentToken: booking.PaymentToken || '',
    MaLeTan: booking.MaLeTan || '',
    patient: {
      MaBenhAn: booking.MaBenhAn || '',
      HoTen: booking.TenBenhNhan || booking.HoTen || 'Chưa rõ',
      CCCD: booking.CCCD || '',
      SDT: booking.SDTBenhNhan || booking.SDT || 'Chưa cập nhật',
      NgaySinh: booking.NgaySinh || '',
      DiaChi: booking.DiaChi || '',
      KyTuDauBHYT: booking.KyTuDauBHYT || '',
    },
  })

  const mergeDoctorHistoryRows = (rows) => {
    const historyRows = Array.isArray(rows) ? rows : []

    const nextVisits = historyRows.map((visit) => ({
      MaLuotKham: visit.MaLuotKham,
      MaBenhAn: visit.MaBenhAn,
      NgayKham: visit.NgayKham || '',
      MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
      TrieuChung: visit.TrieuChung || '',
      MaBenh: visit.MaBenh || '',
      LoiDan: visit.LoiDan || '',
    }))

    const nextPrescriptions = historyRows.flatMap((visit) =>
      (visit.DonThuoc || []).map((item) => ({
        MaDonThuoc: item.MaDonThuoc,
        MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
        MaThuoc: item.MaThuoc,
        SoLuong: item.SoLuong,
        LieuDung: item.LieuDung,
      })),
    )

    const nextLabs = historyRows.flatMap((visit) =>
      (visit.XetNghiem || []).map((item) => ({
        MaChiTietXN: item.MaChiTietXN,
        MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
        MaDichVu: item.MaDichVu,
        KetQuaXetNghiem: item.KetQuaXetNghiem || '',
        MaXNV: item.MaXNV || '',
        PaymentToken: item.PaymentToken || '',
        GiaCuoi: item.GiaCuoi || 0,
        TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
      })),
    )

    const nextTreatments = historyRows.flatMap((visit) =>
      groupTreatmentResponse(visit.DieuTri || [], visit.MaLuotKham),
    )

    const nextBookings = historyRows.map((visit) =>
      normalizeDoctorBooking({
        MaLichHen: visit.MaLichHen,
        MaLuotKham: visit.MaLuotKham,
        MaBenhAn: visit.MaBenhAn,
        MaDichVu: visit.MaDichVuKham,
        TenDichVu: visit.TenDichVuKham,
        MaChiNhanh: visit.MaChiNhanh,
        TenChiNhanh: visit.TenChiNhanh,
        MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
        NgayKham: visit.NgayKham,
        CaKham: visit.CaKham,
        STT: visit.STT,
        STT_HangDoi: visit.STT,
        TrangThai: visit.TrangThai,
        GiaCuoi: visit.GiaCuoi,
        PaymentToken: visit.PaymentToken,
        TenBenhNhan: visit.TenBenhNhan,
        CCCD: visit.CCCD,
        SDTBenhNhan: visit.SDTBenhNhan,
        NgaySinh: visit.NgaySinh,
        DiaChi: visit.DiaChi,
      }),
    )

    setVisitRecords((current) => [
      ...nextVisits,
      ...current.filter((item) => !nextVisits.some((visit) => visit.MaLuotKham === item.MaLuotKham)),
    ])
    setPrescriptionDetails((current) => [
      ...nextPrescriptions,
      ...current.filter((item) => !nextPrescriptions.some((prescription) => prescription.MaDonThuoc === item.MaDonThuoc)),
    ])
    setLabDetails((current) => [
      ...nextLabs,
      ...current.filter((item) => !nextLabs.some((lab) => lab.MaChiTietXN === item.MaChiTietXN)),
    ])
    setTreatmentSchedules((current) => [
      ...nextTreatments,
      ...current.filter((item) => !nextTreatments.some((treatment) => treatment.MaLichTrinh === item.MaLichTrinh)),
    ])
    setBookings((current) => [
      ...nextBookings,
      ...current.filter((item) => !nextBookings.some((booking) => booking.MaLichHen === item.MaLichHen)),
    ])

    return { nextVisits, nextBookings }
  }

  const loadDoctorQueue = async () => {
    if (!doctorProfile.MaBacSi) return

    setDoctorQueueLoading(true)
    setDoctorQueueError('')

    try {
      const response = await fetch(
        `${BACKEND_URL}/doctor/queue?ma_bac_si=${encodeURIComponent(doctorProfile.MaBacSi)}`,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải hàng đợi bác sĩ.')
      }

      setDoctorLiveRows(Array.isArray(result.data) ? result.data.map(normalizeDoctorBooking) : [])
      setHasLoadedDoctorQueue(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải hàng đợi bác sĩ.'
      setDoctorQueueError(message)
      console.warn('DOCTOR_QUEUE_LOAD_FAILED', message)
    } finally {
      setDoctorQueueLoading(false)
    }
  }

  const loadDoctorCompletedEncounters = async () => {
    if (!doctorProfile.MaBacSi) return

    try {
      const response = await fetch(
        `${BACKEND_URL}/doctor/completed-encounters?ma_bac_si=${encodeURIComponent(doctorProfile.MaBacSi)}`,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch sử đợt khám của bác sĩ.')
      }

      mergeDoctorHistoryRows(result.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử đợt khám của bác sĩ.'
      console.warn('DOCTOR_COMPLETED_HISTORY_LOAD_FAILED', message)
    }
  }

  const loadPatientHistoryForDoctor = async (maBenhAn) => {
    if (!maBenhAn) return { nextVisits: [], nextBookings: [] }

    try {
      const response = await fetch(
        `${BACKEND_URL}/doctor/patient-history?ma_benh_an=${encodeURIComponent(maBenhAn)}`,
      )
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch sử khám của bệnh nhân.')
      }

      return mergeDoctorHistoryRows(result.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch sử khám của bệnh nhân.'
      console.warn('DOCTOR_PATIENT_HISTORY_LOAD_FAILED', message)
      return { nextVisits: [], nextBookings: [] }
    }
  }

  const updateDoctorBookingStatus = async (maLichHen, trangThai) => {
    const formData = new FormData()
    formData.append('ma_lich_hen', maLichHen)
    formData.append('trang_thai', trangThai)

    const response = await fetch(`${BACKEND_URL}/doctor/update-appointment-status`, {
      method: 'POST',
      body: formData,
    })
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể cập nhật trạng thái lịch hẹn.')
    }

    return result.data
  }

  useEffect(() => {
    loadDoctorQueue()
    loadDoctorCompletedEncounters()
  }, [doctorProfile.MaBacSi])

  const labServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Xét nghiệm')
  const treatmentServices = effectiveServices.filter((service) => service.LoaiDichVu === 'Điều trị')
  const selectedLabServiceId = labServices.some((service) => service.MaDichVu === clinicalForm.MaXetNghiem)
    ? clinicalForm.MaXetNghiem
    : labServices[0]?.MaDichVu || ''
  const selectedTreatmentServiceId = treatmentServices.some((service) => service.MaDichVu === clinicalForm.MaDieuTri)
    ? clinicalForm.MaDieuTri
    : treatmentServices[0]?.MaDichVu || ''
  const filteredDiseaseSuggestions = effectiveDiseases
    .filter((disease) => {
      const keyword = diagnosisSearch.trim().toLowerCase()
      if (!keyword) return true
      return [disease.MaBenh, disease.TenBenh].join(' ').toLowerCase().includes(keyword)
    })
    .slice(0, 6)
  const filteredMedicineSuggestions = effectiveMedicines
    .filter((medicine) => {
      const keyword = medicineSearch.trim().toLowerCase()
      if (!keyword) return true
      return [medicine.MaThuoc, medicine.TenThuoc, medicine.DonViTinh].join(' ').toLowerCase().includes(keyword)
    })
    .slice(0, 6)
  const mySchedules = doctorSchedules
    .filter(
      (schedule) =>
        schedule.MaBacSi === doctorProfile.MaBacSi &&
        schedule.NgayTruc >= '2026-05-31',
    )
    .sort((a, b) => `${a.NgayTruc}-${a.CaTruc}`.localeCompare(`${b.NgayTruc}-${b.CaTruc}`))
  const weeklyScheduleGroups = (() => {
    const groupMap = new Map()

    mySchedules.forEach((schedule) => {
      const weekStartKey = formatDateKey(getWeekStart(schedule.NgayTruc))
      const current = groupMap.get(weekStartKey) || []
      groupMap.set(weekStartKey, [...current, schedule])
    })

    return Array.from(groupMap.entries())
      .map(([weekStartKey, schedules]) => {
        const weekStart = new Date(`${weekStartKey}T00:00:00Z`)
        const days = Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index)
          return {
            date,
            dateKey: formatDateKey(date),
            label: getWeekdayLabel(date),
          }
        })

        return {
          weekStartKey,
          weekEndKey: formatDateKey(addDays(weekStart, 6)),
          days,
          schedules,
        }
      })
      .sort((a, b) => a.weekStartKey.localeCompare(b.weekStartKey))
  })()
  const doctorSourceBookings = hasLoadedDoctorQueue ? doctorLiveRows : bookings
  const isDoctorOwnedBooking = (booking) =>
    booking.MaBacSi === doctorProfile.MaBacSi &&
    (hasLoadedDoctorQueue || booking.MaChiNhanh === doctorProfile.MaChiNhanh)
  const doctorPatientMap = doctorSourceBookings.reduce((patientMap, booking) => {
    if (booking.patient?.MaBenhAn) {
      patientMap.set(booking.patient.MaBenhAn, booking.patient)
    }
    return patientMap
  }, new Map())
  const doctorQueue = doctorSourceBookings
    .filter((booking) => booking.TrangThai === 'Chờ khám' && isDoctorOwnedBooking(booking))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))

  const activeBooking =
    doctorSourceBookings.find((booking) => booking.MaLichHen === activeBookingId) ||
    bookings.find((booking) => booking.MaLichHen === activeBookingId)
  const activePatient = activeBooking ? getPatient(activeBooking.MaBenhAn) : null
  const activeBookingService = activeBooking ? getService(activeBooking.MaDichVu) : null
  const activeBookingServiceType = activeBooking?.LoaiDichVu || activeBookingService?.LoaiDichVu || ''
  const isActiveTreatmentBooking = activeBookingServiceType === 'Điều trị'
  const patientVisits = activePatient
    ? visitRecords
        .filter((visit) => visit.MaBenhAn === activePatient.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
    : []
  const selectedVisit =
    patientVisits.find((visit) => visit.MaLuotKham === selectedVisitId) || patientVisits[0] || null
  const selectedPrescriptions = selectedVisit
    ? prescriptionDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const selectedLabs = selectedVisit
    ? labDetails.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const selectedTreatments = selectedVisit
    ? treatmentSchedules.filter((item) => item.MaLuotKham === selectedVisit.MaLuotKham)
    : []
  const currentVisitId = buildCurrentVisitId(activeBooking)
  const currentLabOrders = activeBooking
    ? labDetails.filter((lab) => lab.MaLuotKham === currentVisitId)
    : []
  const currentTreatments = activeBooking
    ? treatmentSchedules.filter((item) => item.MaLuotKham === currentVisitId)
    : []
  const activeTreatmentSession = activeBooking
    ? treatmentSchedules.find((item) => item.MaLichHen === activeBooking.MaLichHen)
    : null
  const activeTreatmentSiblings = activeTreatmentSession
    ? treatmentSchedules
        .filter(
          (item) =>
            item.MaLuotKham === activeTreatmentSession.MaLuotKham &&
            item.MaDichVu === activeTreatmentSession.MaDichVu,
        )
        .sort((first, second) => Number(first.BuoiSo || 0) - Number(second.BuoiSo || 0))
    : []
  const activeTreatmentCompletedCount = activeTreatmentSiblings.filter((item) => item.TrangThai === 'Hoàn thành').length
  const waitingConclusionBookings = doctorSourceBookings
    .filter((booking) => booking.TrangThai === 'Chờ kết luận' && isDoctorOwnedBooking(booking))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))
  const allCurrentLabResultsReady =
    currentLabOrders.length === 0 ||
    currentLabOrders.every((lab) => lab.TrangThaiXetNghiem === 'Đã có kết quả')
  const completedEncounterRows = bookings
    .filter(
      (booking) =>
        booking.MaBacSi === doctorProfile.MaBacSi &&
        ['Hoàn thành', 'Đã khám'].includes(booking.TrangThai) &&
        booking.MaLuotKham,
    )
	    .map((booking) => {
	      const visit = visitRecords.find((item) => item.MaLuotKham === booking.MaLuotKham)
	      const patient = booking.patient?.MaBenhAn ? booking.patient : getPatient(booking.MaBenhAn)
	      const disease = visit ? getDisease(visit.MaBenh) : getDisease('')
	      return { booking, visit, patient, disease }
	    })
    .filter((row) => row.visit)
    .sort((a, b) => b.booking.NgayKham.localeCompare(a.booking.NgayKham))

  const handleUpdatePhone = (event) => {
    event.preventDefault()
    setDoctorProfile((current) => ({ ...current, SDT: contactForm.SDT.trim() }))
    notify('Đã cập nhật số điện thoại liên hệ.')
  }

  const handleChangePassword = (event) => {
    event.preventDefault()
    if (passwordForm.oldPassword !== doctorProfile.MatKhau) {
      notify('Mật khẩu cũ không chính xác.', 'error')
      return
    }

    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error')
      return
    }

    setDoctorProfile((current) => ({ ...current, MatKhau: passwordForm.newPassword }))
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    setShowPasswordForm(false)
    notify('Đổi mật khẩu thành công!')
  }

  const updateLocalDoctorBooking = (maLichHen, patch) => {
    setDoctorLiveRows((current) =>
      current.map((booking) => (booking.MaLichHen === maLichHen ? { ...booking, ...patch } : booking)),
    )
    setBookings((current) =>
      current.map((booking) => (booking.MaLichHen === maLichHen ? { ...booking, ...patch } : booking)),
    )
  }

  const buildExamPayload = (isDraft) => ({
    ma_lich_hen: activeBooking.MaLichHen,
    ma_bac_si: doctorProfile.MaBacSi,
    ma_benh: clinicalForm.MaBenh || null,
    trieu_chung: clinicalForm.TrieuChung.trim() || 'Bác sĩ chưa ghi nhận triệu chứng chi tiết.',
    loi_dan: clinicalForm.LoiDan.trim() || 'Theo dõi tại nhà và tái khám khi có dấu hiệu bất thường.',
    xet_nghiem: currentLabOrders.map((lab) => ({ ma_dich_vu: lab.MaDichVu })),
    don_thuoc: currentPrescription.map((item) => ({
      ma_thuoc: item.MaThuoc,
      so_luong: Number(item.SoLuong) || 1,
      lieu_dung: item.LieuDung,
    })),
    dieu_tri: currentTreatments.map((item) => ({
      ma_dich_vu: item.MaDichVu,
      so_buoi: Number(item.TongSoBuoi || item.SoBuoi || 1) || 1,
    })),
    is_draft: isDraft,
  })

  const groupTreatmentResponse = (items, maLuotKham) => {
    const treatmentMap = (items || []).reduce((currentMap, item) => {
      const key = item.MaDichVu || item.MaLichTrinh
      const current = currentMap[key] || {
        MaLichTrinh: item.MaLichTrinh,
        MaLichHen: item.MaLichHen || '',
        MaLuotKham: item.MaLuotKham || maLuotKham,
        MaDichVu: item.MaDichVu,
        TenDichVu: item.TenDichVu,
        TongSoBuoi: 0,
        SoBuoiDaLam: 0,
        TrangThai: item.TrangThai || 'Chưa đặt lịch',
      }

      current.TongSoBuoi += 1
      if (item.TrangThai === 'Hoàn thành') {
        current.SoBuoiDaLam += 1
      }
      currentMap[key] = current
      return currentMap
    }, {})

    return Object.values(treatmentMap)
  }

  const applyExamResponse = (data, status) => {
    if (!data?.MaLuotKham || !activeBooking || !activePatient) return ''

    const maLuotKham = data.MaLuotKham
    const previousVisitId = currentVisitId
    const visit = {
      MaLuotKham: maLuotKham,
      MaBenhAn: activePatient.MaBenhAn,
      NgayKham: activeBooking.NgayKham,
      MaBacSi: doctorProfile.MaBacSi,
      TrieuChung: data.TrieuChung || clinicalForm.TrieuChung.trim() || 'Bác sĩ chưa ghi nhận triệu chứng chi tiết.',
      MaBenh: data.MaBenh || clinicalForm.MaBenh,
      LoiDan: data.LoiDan || clinicalForm.LoiDan.trim() || 'Theo dõi tại nhà và tái khám khi có dấu hiệu bất thường.',
    }

    setVisitRecords((current) => [visit, ...current.filter((item) => item.MaLuotKham !== maLuotKham)])

    if (Array.isArray(data.XetNghiem)) {
      setLabDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...data.XetNghiem.map((item) => ({
          MaChiTietXN: item.MaChiTietXN,
          MaLuotKham: maLuotKham,
          MaDichVu: item.MaDichVu,
          KetQuaXetNghiem: item.KetQuaXetNghiem || '',
          MaXNV: item.MaXNV || '',
          TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
        })),
      ])
    }

    if (Array.isArray(data.DonThuoc)) {
      setPrescriptionDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...data.DonThuoc.map((item) => ({
          MaDonThuoc: item.MaDonThuoc,
          MaLuotKham: maLuotKham,
          MaThuoc: item.MaThuoc,
          SoLuong: item.SoLuong,
          LieuDung: item.LieuDung,
        })),
      ])
    }

    if (Array.isArray(data.DieuTri)) {
      const groupedTreatments = groupTreatmentResponse(data.DieuTri, maLuotKham)
      setTreatmentSchedules((current) => [
        ...current.filter((item) => item.MaLuotKham !== previousVisitId && item.MaLuotKham !== maLuotKham),
        ...groupedTreatments,
      ])
    }

    updateLocalDoctorBooking(activeBooking.MaLichHen, { MaLuotKham: maLuotKham, TrangThai: status })
    return maLuotKham
  }

  const mergeEncounterDetail = (data) => {
    const visit = data?.LuotKham
    if (!visit?.MaLuotKham) return

    setVisitRecords((current) => [
      {
        MaLuotKham: visit.MaLuotKham,
        MaBenhAn: visit.MaBenhAn,
        NgayKham: visit.NgayKham || '',
        MaBacSi: visit.MaBacSi || doctorProfile.MaBacSi,
        TrieuChung: visit.TrieuChung || '',
        MaBenh: visit.MaBenh || '',
        LoiDan: visit.LoiDan || '',
      },
      ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
    ])

    if (Array.isArray(data.DonThuoc)) {
      setPrescriptionDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...data.DonThuoc.map((item) => ({
          MaDonThuoc: item.MaDonThuoc,
          MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
          MaThuoc: item.MaThuoc,
          SoLuong: item.SoLuong,
          LieuDung: item.LieuDung,
        })),
      ])
    }

    if (Array.isArray(data.XetNghiem)) {
      setLabDetails((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...data.XetNghiem.map((item) => ({
          MaChiTietXN: item.MaChiTietXN,
          MaLuotKham: item.MaLuotKham || visit.MaLuotKham,
          MaDichVu: item.MaDichVu,
          KetQuaXetNghiem: item.KetQuaXetNghiem || '',
          MaXNV: item.MaXNV || '',
          PaymentToken: item.PaymentToken || '',
          GiaCuoi: item.GiaCuoi || 0,
          TrangThaiXetNghiem: item.TrangThaiXetNghiem || 'Chưa thực hiện',
        })),
      ])
    }

    if (Array.isArray(data.DieuTri)) {
      setTreatmentSchedules((current) => [
        ...current.filter((item) => item.MaLuotKham !== visit.MaLuotKham),
        ...groupTreatmentResponse(data.DieuTri, visit.MaLuotKham),
      ])
    }
  }

  const loadEncounterDetail = async (maLuotKham) => {
    if (!maLuotKham) return null

    const params = new URLSearchParams({
      ma_luot_kham: maLuotKham,
      ma_bac_si: doctorProfile.MaBacSi,
    })
    const response = await fetch(`${BACKEND_URL}/doctor/encounter-detail?${params.toString()}`)
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể tải chi tiết lượt khám.')
    }

    mergeEncounterDetail(result.data)
    return result.data
  }

  const saveExamToBackend = async (isDraft) => {
    const response = await fetch(`${BACKEND_URL}/doctor/complete-appointment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildExamPayload(isDraft)),
    })
    const result = await response.json()

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || 'Không thể lưu lượt khám.')
    }

    return result.data
  }

  const handleInvitePatient = async (booking) => {
    setDoctorActionLoading(booking.MaLichHen)

    try {
      if (hasLoadedDoctorQueue && !String(booking.MaLichHen).startsWith('LH_DR_')) {
        await updateDoctorBookingStatus(booking.MaLichHen, 'Đang khám')
      }

      updateLocalDoctorBooking(booking.MaLichHen, { TrangThai: 'Đang khám' })
      setActiveBookingId(booking.MaLichHen)
      const loadedHistory = await loadPatientHistoryForDoctor(booking.MaBenhAn)
      if (booking.MaLuotKham) {
        await loadEncounterDetail(booking.MaLuotKham)
        setSelectedVisitId(booking.MaLuotKham)
      }
      const historySource = loadedHistory.nextVisits.length > 0 ? loadedHistory.nextVisits : visitRecords
      const patientHistoricalVisits = historySource
        .filter((visit) => visit.MaBenhAn === booking.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
      if (!booking.MaLuotKham) {
        setSelectedVisitId(patientHistoricalVisits[0]?.MaLuotKham || '')
      }
      notify(`Đã mời ${getPatient(booking.MaBenhAn).HoTen} vào khám.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể mời bệnh nhân vào khám.'
      notify(message, 'error')
    } finally {
      setDoctorActionLoading('')
    }
  }

  const handleClinicalFormChange = (field, value) => {
    setClinicalForm((current) => ({ ...current, [field]: value }))
  }

  const handleSelectDisease = (disease) => {
    setClinicalForm((current) => ({ ...current, MaBenh: disease.MaBenh }))
    setDiagnosisSearch(`${disease.MaBenh} - ${disease.TenBenh}`)
  }

  const handleDiagnosisSearchChange = (value) => {
    setDiagnosisSearch(value)
    setClinicalForm((current) => ({ ...current, MaBenh: '' }))
  }

  const handleSelectMedicine = (medicine) => {
    setClinicalForm((current) => ({ ...current, MaThuoc: medicine.MaThuoc }))
    setMedicineSearch(medicine.TenThuoc)
  }

  const handleAddPrescriptionItem = () => {
    const medicine = getMedicine(clinicalForm.MaThuoc)
    const quantity = Number(clinicalForm.SoLuong)
    const dosage = clinicalForm.LieuDung.trim()

    if (!medicine.MaThuoc) {
      notify('Vui lòng chọn thuốc từ danh mục gợi ý.', 'error')
      return
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      notify('Số lượng thuốc phải là số nguyên dương.', 'error')
      return
    }

    if (!dosage) {
      notify('Vui lòng nhập liều dùng/lời dặn thuốc.', 'error')
      return
    }

    setCurrentPrescription((current) => [
      ...current,
      {
        TempId: `TEMP_RX_${Date.now()}_${current.length + 1}`,
        MaThuoc: medicine.MaThuoc,
        SoLuong: quantity,
        LieuDung: dosage,
      },
    ])
    setClinicalForm((current) => ({
      ...current,
      SoLuong: '10',
      LieuDung: '',
    }))
    setMedicineSearch('')
    notify(`Đã thêm ${medicine.TenThuoc} vào đơn thuốc.`)
  }

  const handleRemovePrescriptionItem = (tempId) => {
    setCurrentPrescription((current) => current.filter((item) => item.TempId !== tempId))
  }

  const handleAddLabOrder = () => {
    if (!activeBooking) {
      notify('Vui lòng mời bệnh nhân vào khám trước khi chỉ định xét nghiệm.', 'error')
      return
    }

    if (!selectedLabServiceId) {
      notify('Không có dịch vụ xét nghiệm khả dụng trong danh mục.', 'error')
      return
    }

    const newLabOrder = {
      MaChiTietXN: `CTXN_DR_${String(labDetails.length + 1).padStart(3, '0')}`,
      MaLuotKham: currentVisitId,
      MaDichVu: selectedLabServiceId,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
      PaymentToken: null,
    }
    setLabDetails((current) => [...current, newLabOrder])
    notify(`Đã thêm chỉ định ${getService(selectedLabServiceId).TenDichVu}.`)
  }

  const handleMockLabResult = (maChiTietXN) => {
    setLabDetails((current) =>
      current.map((lab) =>
        lab.MaChiTietXN === maChiTietXN
          ? {
              ...lab,
              KetQuaXetNghiem: 'Kết quả đã được phòng Lab trả: các chỉ số trong giới hạn tham chiếu.',
              MaXNV: 'XNV001',
              TrangThaiXetNghiem: 'Đã có kết quả',
              PaymentToken: lab.PaymentToken || 'PAY_LAB_SIMULATED',
            }
          : lab,
      ),
    )
    notify('Đã mô phỏng phòng Lab trả kết quả realtime.')
  }

  const handleAddTreatmentPlan = () => {
    if (!activeBooking) {
      notify('Vui lòng mời bệnh nhân vào khám trước khi chỉ định điều trị.', 'error')
      return
    }

    if (!selectedTreatmentServiceId) {
      notify('Không có dịch vụ điều trị khả dụng trong danh mục.', 'error')
      return
    }

    const totalSessions = Number(clinicalForm.TongSoBuoi)
    if (!Number.isInteger(totalSessions) || totalSessions <= 0) {
      notify('Tổng số buổi điều trị phải là số nguyên dương.', 'error')
      return
    }

    const newTreatment = {
      MaLichTrinh: `LTDT_DR_${String(treatmentSchedules.length + 1).padStart(3, '0')}`,
      MaLuotKham: currentVisitId,
      MaDichVu: selectedTreatmentServiceId,
      TongSoBuoi: totalSessions,
      SoBuoiDaLam: 0,
      TrangThai: 'Chưa thực hiện',
    }
    setTreatmentSchedules((current) => [...current, newTreatment])
    notify(`Đã chỉ định liệu trình ${getService(selectedTreatmentServiceId).TenDichVu}.`)
  }

  const handlePauseForLab = async () => {
    if (!activeBooking) return
    if (currentLabOrders.length === 0) {
      notify('Chưa có chỉ định xét nghiệm nào để chuyển ca sang trạng thái chờ kết quả.', 'error')
      return
    }

    setSavingExam(true)

    try {
      const examData = await saveExamToBackend(true)
      applyExamResponse(examData, examData?.TrangThai || 'Chờ kết luận')

      updateLocalDoctorBooking(activeBooking.MaLichHen, {
        MaLuotKham: examData?.MaLuotKham || activeBooking.MaLuotKham,
        TrangThai: 'Chờ kết luận',
      })
      setActiveBookingId('')
      notify('Đã lưu chỉ định và chuyển bệnh nhân sang danh sách chờ kết luận.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tạm hoãn ca khám.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  const handleRecallPatient = async (booking) => {
    setDoctorActionLoading(booking.MaLichHen)

    try {
      if (hasLoadedDoctorQueue && !String(booking.MaLichHen).startsWith('LH_DR_')) {
        await updateDoctorBookingStatus(booking.MaLichHen, 'Đang khám')
      }

      updateLocalDoctorBooking(booking.MaLichHen, { TrangThai: 'Đang khám' })
      setActiveBookingId(booking.MaLichHen)
      const loadedHistory = await loadPatientHistoryForDoctor(booking.MaBenhAn)
      if (booking.MaLuotKham) {
        await loadEncounterDetail(booking.MaLuotKham)
        setSelectedVisitId(booking.MaLuotKham)
      }
      const historySource = loadedHistory.nextVisits.length > 0 ? loadedHistory.nextVisits : visitRecords
      const patientHistoricalVisits = historySource
        .filter((visit) => visit.MaBenhAn === booking.MaBenhAn)
        .sort((a, b) => b.NgayKham.localeCompare(a.NgayKham))
      if (!booking.MaLuotKham) {
        setSelectedVisitId(patientHistoricalVisits[0]?.MaLuotKham || '')
      }
      notify(`Đã gọi lại ${getPatient(booking.MaBenhAn).HoTen} vào phòng để kết luận.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gọi lại bệnh nhân.'
      notify(message, 'error')
    } finally {
      setDoctorActionLoading('')
    }
  }

  const handleCompleteExam = async () => {
    if (!activeBooking || !activePatient) return
    if (!allCurrentLabResultsReady) {
      notify('Chưa có đủ kết quả xét nghiệm để hoàn thành lượt khám.', 'error')
      return
    }

    setSavingExam(true)

    try {
      const examData = await saveExamToBackend(false)
      const maLuotKham = applyExamResponse(examData, 'Hoàn thành') || currentVisitId
      await loadDoctorCompletedEncounters()

      setDoctorLiveRows((current) => current.filter((booking) => booking.MaLichHen !== activeBooking.MaLichHen))
      setActiveBookingId('')
      setClinicalForm((current) => ({
        ...current,
        TrieuChung: '',
        LoiDan: '',
        LieuDung: '',
        SoLuong: '10',
        TongSoBuoi: '3',
      }))
      setCurrentPrescription([])
      setDiagnosisSearch('')
      setMedicineSearch('')
      notify(`Đã hoàn thành lượt khám ${maLuotKham} và lưu vào hệ thống.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hoàn thành lượt khám.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  const handleCompleteTreatmentSession = async () => {
    if (!activeBooking || !activePatient) return

    setSavingExam(true)

    try {
      const response = await fetch(`${BACKEND_URL}/doctor/complete-treatment-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ma_lich_hen: activeBooking.MaLichHen,
          ma_bac_si: doctorProfile.MaBacSi,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể hoàn thành buổi điều trị.')
      }

      const completedTreatment = result.data
      updateLocalDoctorBooking(activeBooking.MaLichHen, { TrangThai: 'Hoàn thành' })
      setTreatmentSchedules((current) =>
        current.map((item) =>
          item.MaLichHen === activeBooking.MaLichHen ||
          item.MaLichTrinh === completedTreatment?.MaLichTrinh
            ? {
                ...item,
                TrangThai: 'Hoàn thành',
                MaLichHen: item.MaLichHen || activeBooking.MaLichHen,
              }
            : item,
        ),
      )
      setDoctorLiveRows((current) => current.filter((booking) => booking.MaLichHen !== activeBooking.MaLichHen))
      setActiveBookingId('')
      notify(`Đã hoàn thành buổi điều trị ${completedTreatment?.MaLichTrinh || activeBooking.MaLichHen}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể hoàn thành buổi điều trị.'
      notify(message, 'error')
    } finally {
      setSavingExam(false)
    }
  }

  return (
    <main className="doctor-shell">
      <header className="doctor-topbar">
        <div>
          <span className="doctor-kicker">Medicare Doctor Workspace</span>
          <h1>Xin chào, Bác sĩ {doctorProfile.HoTen}</h1>
          <p>
            Chuyên khoa: <strong>{doctorProfile.ChuyenKhoa}</strong> · Chi nhánh:{' '}
            <strong>{doctorProfile.TenChiNhanh}</strong>
          </p>
        </div>
        <button type="button" className="doctor-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="doctor-feedback">{feedback}</p>}
      {doctorQueueLoading && <p className="doctor-feedback">Đang tải hàng đợi bác sĩ từ hệ thống...</p>}
      {doctorQueueError && <p className="doctor-feedback">{doctorQueueError}</p>}

      <nav className="doctor-tab-row">
        <button
          type="button"
          className={activeDoctorTab === 'clinic' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('clinic')}
        >
          🩺 Phòng khám
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('schedule')}
        >
          📅 Lịch trực của tôi
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'history' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('history')}
        >
          📚 Lịch sử đợt khám
        </button>
        <button
          type="button"
          className={activeDoctorTab === 'account' ? 'active' : ''}
          onClick={() => setActiveDoctorTab('account')}
        >
          ⚙️ Cài đặt tài khoản
        </button>
      </nav>

      {activeDoctorTab === 'clinic' ? (
        <>
          <section className="doctor-grid doctor-grid-single">
        <article className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Danh sách bệnh nhân đang chờ</h2>
              <p>Hàng đợi lọc theo bác sĩ và chi nhánh đang đăng nhập.</p>
            </div>
            <strong>{doctorQueue.length} ca chờ</strong>
          </div>
          <div className="doctor-table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>STT hàng đợi</th>
                  <th>Họ tên</th>
                  <th>Ca khám</th>
                  <th>Dịch vụ đăng ký</th>
                  <th>Thời gian check-in</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {doctorQueue.map((booking) => {
                  const patient = getPatient(booking.MaBenhAn)
                  const service = getService(booking.MaDichVu)
                  return (
                    <tr key={booking.MaLichHen}>
                      <td>{booking.STT_HangDoi}</td>
                      <td>
                        <strong>{patient.HoTen}</strong>
                        <span>{patient.MaBenhAn}</span>
                      </td>
                      <td>Ca {booking.CaKham}</td>
                      <td>{booking.TenDichVu || service.TenDichVu}</td>
                      <td>{booking.ThoiGianCheckIn}</td>
                      <td>
                        <button
                          type="button"
                          className="doctor-primary-button compact"
                          disabled={doctorActionLoading === booking.MaLichHen}
                          onClick={() => handleInvitePatient(booking)}
                        >
                          {doctorActionLoading === booking.MaLichHen ? 'Đang mời...' : 'Mời vào khám'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {doctorQueue.length === 0 && (
                  <tr>
                    <td colSpan="6" className="doctor-empty-cell">
                      Không còn bệnh nhân nào đang chờ bác sĩ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="doctor-card">
        <div className="doctor-section-header">
          <div>
            <h2>Danh sách chờ kết luận</h2>
            <p>Bệnh nhân đã khám vòng 1 và đang chờ đủ kết quả cận lâm sàng.</p>
          </div>
          <strong>{waitingConclusionBookings.length} ca chờ kết luận</strong>
        </div>
        <div className="doctor-table-wrap">
          <table className="doctor-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Họ tên</th>
                <th>Ca khám</th>
                <th>Dịch vụ</th>
                <th>Trạng thái xét nghiệm</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {waitingConclusionBookings.map((booking) => {
                const patient = getPatient(booking.MaBenhAn)
                const currentLabs = labDetails.filter((lab) => lab.MaLuotKham === buildCurrentVisitId(booking))
                const readyCount = currentLabs.filter((lab) => lab.TrangThaiXetNghiem === 'Đã có kết quả').length
                return (
                  <tr key={booking.MaLichHen}>
                    <td>{booking.STT_HangDoi}</td>
                    <td>
                      <strong>{patient.HoTen}</strong>
                      <span>{patient.MaBenhAn}</span>
                    </td>
                    <td>Ca {booking.CaKham}</td>
                    <td>{booking.TenDichVu || getService(booking.MaDichVu).TenDichVu}</td>
                    <td>
                      {readyCount}/{currentLabs.length} kết quả
                    </td>
                    <td>
                      <button
                        type="button"
                        className="doctor-secondary-button compact"
                        disabled={doctorActionLoading === booking.MaLichHen}
                        onClick={() => handleRecallPatient(booking)}
                      >
                        {doctorActionLoading === booking.MaLichHen ? 'Đang gọi...' : 'Gọi lại vào phòng'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {waitingConclusionBookings.length === 0 && (
                <tr>
                  <td colSpan="6" className="doctor-empty-cell">
                    Không có bệnh nhân đang chờ kết luận.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="doctor-card">
        <div className="doctor-section-header">
          <div>
            <h2>Hồ sơ thăm khám</h2>
            <p>Truy cập lịch sử khám bệnh, đơn thuốc và xét nghiệm cũ của bệnh nhân đang khám.</p>
          </div>
        </div>

        {!activePatient ? (
          <div className="doctor-empty-state">Chọn một bệnh nhân từ hàng đợi để mở hồ sơ thăm khám.</div>
        ) : (
          <div className="doctor-record-layout">
            <aside className="doctor-patient-summary">
              <span>Đang khám</span>
              <h3>{activePatient.HoTen}</h3>
              <p>
                {activePatient.MaBenhAn} · CCCD {activePatient.CCCD}
              </p>
              <p>
                SĐT {activePatient.SDT} · {activePatient.DiaChi}
              </p>
              <strong>Trạng thái: Đang khám</strong>
            </aside>

            <div className="doctor-record-main">
              <div className="doctor-command-panel">
                <h3>{isActiveTreatmentBooking ? 'Thực hiện buổi điều trị' : 'Lệnh lâm sàng lượt khám hiện tại'}</h3>
                {isActiveTreatmentBooking ? (
                  <div className="doctor-treatment-session-panel">
                    <div className="doctor-treatment-session-header">
                      <div>
                        <span>Dịch vụ điều trị</span>
                        <h3>{activeBooking.TenDichVu || activeBookingService?.TenDichVu || 'Dịch vụ điều trị'}</h3>
                        <p>
                          {activeBooking.TenChiNhanh || getShortBranchName(activeBooking.MaChiNhanh)} · Ngày{' '}
                          {activeBooking.NgayKham} · Ca {activeBooking.CaKham}
                        </p>
                      </div>
                      <strong>
                        Buổi {activeTreatmentSession?.BuoiSo || 'đang cập nhật'} /{' '}
                        {activeTreatmentSiblings.length || '...'}
                      </strong>
                    </div>

                    <div className="doctor-treatment-session-grid">
                      <div>
                        <span>Bệnh nhân</span>
                        <strong>{activePatient.HoTen}</strong>
                        <p>{activePatient.MaBenhAn}</p>
                      </div>
                      <div>
                        <span>Mã buổi điều trị</span>
                        <strong>{activeTreatmentSession?.MaLichTrinh || 'Đang liên kết'}</strong>
                        <p>Liên kết lịch hẹn {activeBooking.MaLichHen}</p>
                      </div>
                      <div>
                        <span>Tiến độ liệu trình</span>
                        <strong>
                          {activeTreatmentCompletedCount}/{activeTreatmentSiblings.length || 1} buổi hoàn thành
                        </strong>
                        <p>Buổi hiện tại sẽ được tính hoàn thành sau khi xác nhận.</p>
                      </div>
                      <div>
                        <span>Trạng thái hiện tại</span>
                        <strong>{activeTreatmentSession?.TrangThai || activeBooking.TrangThai}</strong>
                        <p>Không yêu cầu chẩn đoán, kê thuốc hoặc chỉ định xét nghiệm cho buổi điều trị.</p>
                      </div>
                    </div>

                    <div className="doctor-treatment-session-actions">
                      <button
                        type="button"
                        className="doctor-finish-button"
                        onClick={handleCompleteTreatmentSession}
                        disabled={savingExam}
                      >
                        {savingExam ? 'Đang lưu...' : 'Hoàn thành buổi điều trị'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="doctor-workflow-stack">
                  <section className="doctor-workflow-section">
                    <h3>1. Chỉ định Xét nghiệm & Giám sát kết quả Realtime</h3>
                    <div className="doctor-inline-order">
                      <select
                        value={selectedLabServiceId}
                        onChange={(event) => handleClinicalFormChange('MaXetNghiem', event.target.value)}
                        disabled={labServices.length === 0}
                      >
                        {labServices.length === 0 && <option value="">Không có dịch vụ xét nghiệm</option>}
                        {labServices.map((service) => (
                          <option key={service.MaDichVu} value={service.MaDichVu}>
                            {service.TenDichVu}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="doctor-secondary-button" onClick={handleAddLabOrder}>
                        Thêm chỉ định CLS
                      </button>
                    </div>
                    <div className="doctor-lab-grid">
                      {currentLabOrders.map((lab) => (
                        <article key={lab.MaChiTietXN} className="doctor-lab-card">
                          <span>{getService(lab.MaDichVu).TenDichVu}</span>
                          <strong className={lab.TrangThaiXetNghiem === 'Đã có kết quả' ? 'done' : 'pending'}>
                            {lab.TrangThaiXetNghiem === 'Đã có kết quả'
                              ? 'Đã có kết quả'
                              : 'Chờ phòng Lab/Thanh toán'}
                          </strong>
                          <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả từ phòng Lab.'}</p>
                          {lab.TrangThaiXetNghiem === 'Chưa thực hiện' && (
                            <button
                              type="button"
                              className="doctor-secondary-button compact"
                              onClick={() => handleMockLabResult(lab.MaChiTietXN)}
                            >
                              Mô phỏng Lab trả kết quả
                            </button>
                          )}
                        </article>
                      ))}
                      {currentLabOrders.length === 0 && (
                        <p className="doctor-empty-state compact">Chưa có chỉ định xét nghiệm mới.</p>
                      )}
                    </div>
                  </section>

                  <section className="doctor-workflow-section">
                    <h3>2. Chẩn đoán & Kê đơn thuốc</h3>
                    <div className="doctor-command-grid">
                      <label>
                        Triệu chứng
                        <textarea
                          value={clinicalForm.TrieuChung}
                          onChange={(event) => handleClinicalFormChange('TrieuChung', event.target.value)}
                          placeholder="Nhập triệu chứng lâm sàng hiện tại..."
                        />
                      </label>
                      <label className="doctor-autocomplete-field">
                        Chẩn đoán
                        <input
                          value={diagnosisSearch}
                          onChange={(event) => handleDiagnosisSearchChange(event.target.value)}
                          placeholder="Gõ mã ICD-10 hoặc tên bệnh, ví dụ: K, Viêm, Tăng..."
                        />
                        <div className="doctor-suggestion-list">
                          {filteredDiseaseSuggestions.map((disease) => (
                            <button
                              key={disease.MaBenh}
                              type="button"
                              className={clinicalForm.MaBenh === disease.MaBenh ? 'active' : ''}
                              onClick={() => handleSelectDisease(disease)}
                            >
                              <strong>{disease.MaBenh}</strong>
                              <span>{disease.TenBenh}</span>
                            </button>
                          ))}
                        </div>
                      </label>
                      <label>
                        Lời dặn
                        <textarea
                          value={clinicalForm.LoiDan}
                          onChange={(event) => handleClinicalFormChange('LoiDan', event.target.value)}
                          placeholder="Nhập lời dặn, hướng theo dõi hoặc lịch tái khám..."
                        />
                      </label>
                      <label className="doctor-autocomplete-field">
                        Kê đơn thuốc
                        <input
                          value={medicineSearch}
                          onChange={(event) => setMedicineSearch(event.target.value)}
                          placeholder="Gõ tên thuốc, ví dụ: Paracetamol, Amoxicillin..."
                        />
                        <div className="doctor-suggestion-list">
                          {filteredMedicineSuggestions.map((medicine) => (
                            <button
                              key={medicine.MaThuoc}
                              type="button"
                              className={clinicalForm.MaThuoc === medicine.MaThuoc ? 'active' : ''}
                              onClick={() => handleSelectMedicine(medicine)}
                            >
                              <strong>{medicine.TenThuoc}</strong>
                              <span>
                                {medicine.MaThuoc} · {medicine.DonViTinh}
                              </span>
                            </button>
                          ))}
                        </div>
                      </label>
                      <label>
                        Số lượng
                        <input
                          type="number"
                          min="1"
                          value={clinicalForm.SoLuong}
                          onChange={(event) => handleClinicalFormChange('SoLuong', event.target.value)}
                        />
                      </label>
                      <label className="doctor-command-wide">
                        Liều dùng
                        <input
                          value={clinicalForm.LieuDung}
                          onChange={(event) => handleClinicalFormChange('LieuDung', event.target.value)}
                          placeholder="Ví dụ: Uống 1 viên sau ăn sáng trong 7 ngày"
                        />
                      </label>
                      <div className="doctor-prescription-add">
                        <button type="button" className="doctor-secondary-button" onClick={handleAddPrescriptionItem}>
                          ➕ Thêm vào đơn
                        </button>
                      </div>
                    </div>
                    <div className="doctor-prescription-table-wrap">
                      <table className="doctor-table compact doctor-prescription-table">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Tên thuốc</th>
                            <th>Số lượng</th>
                            <th>Đơn vị</th>
                            <th>Liều dùng / Lời dặn thuốc</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPrescription.map((item, index) => {
                            const medicine = getMedicine(item.MaThuoc)
                            return (
                              <tr key={item.TempId}>
                                <td>{index + 1}</td>
                                <td>{medicine.TenThuoc}</td>
                                <td>{item.SoLuong}</td>
                                <td>{medicine.DonViTinh}</td>
                                <td>{item.LieuDung}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="doctor-danger-button compact"
                                    onClick={() => handleRemovePrescriptionItem(item.TempId)}
                                  >
                                    ❌ Xóa
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          {currentPrescription.length === 0 && (
                            <tr>
                              <td colSpan="6" className="doctor-empty-cell">
                                Chưa có thuốc nào trong đơn tạm thời.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="doctor-workflow-section">
                    <h3>3. Chỉ định Liệu trình Điều trị Chuyên sâu</h3>
                    <div className="doctor-inline-order">
                      <select
                        value={selectedTreatmentServiceId}
                        onChange={(event) => handleClinicalFormChange('MaDieuTri', event.target.value)}
                        disabled={treatmentServices.length === 0}
                      >
                        {treatmentServices.length === 0 && <option value="">Không có dịch vụ điều trị</option>}
                        {treatmentServices.map((service) => (
                          <option key={service.MaDichVu} value={service.MaDichVu}>
                            {service.TenDichVu}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={clinicalForm.TongSoBuoi}
                        onChange={(event) => handleClinicalFormChange('TongSoBuoi', event.target.value)}
                        aria-label="Tổng số buổi chỉ định"
                      />
                      <button type="button" className="doctor-secondary-button" onClick={handleAddTreatmentPlan}>
                        ➕ Xác nhận chỉ định điều trị
                      </button>
                    </div>
                    <div className="doctor-treatment-list">
                      {currentTreatments.map((item) => (
                        <article key={item.MaLichTrinh}>
                          <strong>{getService(item.MaDichVu).TenDichVu}</strong>
                          <span>
                            {item.SoBuoiDaLam}/{item.TongSoBuoi} buổi - {item.TrangThai}
                          </span>
                        </article>
                      ))}
                      {currentTreatments.length === 0 && (
                        <p className="doctor-empty-state compact">Chưa chỉ định liệu trình điều trị.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="doctor-exam-actions">
                  <button type="button" className="doctor-warning-button" onClick={handlePauseForLab} disabled={savingExam}>
                    {savingExam ? 'Đang lưu...' : 'Tạm hoãn - Chờ kết quả Xét nghiệm'}
                  </button>
                  <button type="button" className="doctor-finish-button" onClick={handleCompleteExam} disabled={savingExam}>
                    {savingExam ? 'Đang lưu...' : 'Hoàn thành lượt khám'}
                  </button>
                </div>
                  </>
                )}
              </div>

              <div className="doctor-history-grid">
              <div className="doctor-visit-list">
                <h3>Lịch sử đợt khám</h3>
                {patientVisits.map((visit) => {
                  const disease = getDisease(visit.MaBenh)
                  return (
                    <button
                      key={visit.MaLuotKham}
                      type="button"
                      className={selectedVisit?.MaLuotKham === visit.MaLuotKham ? 'active' : ''}
                      onClick={() => setSelectedVisitId(visit.MaLuotKham)}
                    >
                      <span>{visit.NgayKham}</span>
                      <strong>{visit.MaLuotKham}</strong>
                      <small>{disease.TenBenh}</small>
                    </button>
                  )
                })}
                {patientVisits.length === 0 && (
                  <p className="doctor-empty-state compact">Chưa có lịch sử khám cũ.</p>
                )}
              </div>

              <div className="doctor-visit-detail">
                {selectedVisit ? (
                  <>
                    <div className="doctor-clinical-box">
                      <h3>Chẩn đoán lâm sàng</h3>
                      <p>
                        <strong>Triệu chứng:</strong> {selectedVisit.TrieuChung}
                      </p>
                      <p>
                        <strong>ICD-10:</strong> {selectedVisit.MaBenh} -{' '}
                        {getDisease(selectedVisit.MaBenh).TenBenh}
                      </p>
                      <p>
                        <strong>Lời dặn:</strong> {selectedVisit.LoiDan}
                      </p>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Đơn thuốc cũ</h3>
                      <table className="doctor-table compact">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Tên thuốc</th>
                            <th>Số lượng</th>
                            <th>Đơn vị</th>
                            <th>Liều dùng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPrescriptions.map((item, index) => {
                            const medicine = getMedicine(item.MaThuoc)
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
                          {selectedPrescriptions.length === 0 && (
                            <tr>
                              <td colSpan="5" className="doctor-empty-cell">
                                Không có đơn thuốc trong lượt khám này.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Kết quả xét nghiệm cũ</h3>
                      <div className="doctor-lab-grid">
                        {selectedLabs.map((lab) => (
                          <article key={lab.MaChiTietXN} className="doctor-lab-card">
                            <span>{getService(lab.MaDichVu).TenDichVu}</span>
                            <strong>{lab.TrangThaiXetNghiem}</strong>
                            <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả.'}</p>
                          </article>
                        ))}
                        {selectedLabs.length === 0 && (
                          <p className="doctor-empty-state compact">Không có xét nghiệm trong lượt khám này.</p>
                        )}
                      </div>
                    </div>

                    <div className="doctor-subsection">
                      <h3>Liệu trình điều trị cũ</h3>
                      <div className="doctor-treatment-history-list">
                        {selectedTreatments.map((treatment) => (
                          <article key={treatment.MaLichTrinh}>
                            <strong>{treatment.TenDichVu || getService(treatment.MaDichVu).TenDichVu}</strong>
                            <div>
                              <span>Tổng số buổi: {treatment.TongSoBuoi}</span>
                              <span>Đã làm: {treatment.SoBuoiDaLam}</span>
                              <span>{treatment.TrangThai}</span>
                            </div>
                            <p>{treatment.GhiChuDieuTri}</p>
                          </article>
                        ))}
                        {selectedTreatments.length === 0 && (
                          <p className="doctor-empty-state compact">Không có liệu trình điều trị trong lượt khám này.</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="doctor-empty-state">Chưa chọn đợt khám lịch sử.</div>
                )}
	              </div>
              </div>
            </div>
          </div>
        )}
      </section>
        </>
      ) : activeDoctorTab === 'schedule' ? (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Lịch trực cá nhân theo tuần</h2>
              <p>Chỉ hiển thị lịch từ ngày 2026-05-31 trở đi, gồm đủ 4 ca vận hành. Nghỉ trưa: 12:00 - 13:30.</p>
            </div>
            <strong>{mySchedules.length} ca trực</strong>
          </div>
          {weeklyScheduleGroups.length > 0 ? (
            <div className="doctor-weekly-stack">
              {weeklyScheduleGroups.map((week, index) => (
                <section key={week.weekStartKey} className="doctor-weekly-card">
                  <header>
                    <h3>{index === 0 ? 'Tuần hiện tại' : `Tuần ${index + 1}`}</h3>
                    <span>
                      {week.weekStartKey} đến {week.weekEndKey}
                    </span>
                  </header>
                  <div className="doctor-week-grid">
                    <div className="doctor-week-cell header shift">Ca trực</div>
                    {week.days.map((day) => (
                      <div key={day.dateKey} className="doctor-week-cell header">
                        <strong>{day.label}</strong>
                        <span>{day.dateKey.slice(5)}</span>
                      </div>
                    ))}
                    {[1, 2, 3, 4].map((shift) => (
                      <div key={shift} className="doctor-week-row">
                        <div className="doctor-week-cell shift-label">{getShiftLabel(shift)}</div>
                        {week.days.map((day) => {
                          const schedule = week.schedules.find(
                            (item) =>
                              item.NgayTruc === day.dateKey &&
                              Number(item.CaTruc) === Number(shift),
                          )
                          return (
                            <div key={`${day.dateKey}-${shift}`} className="doctor-week-cell">
                              {schedule ? (
                                <span className="doctor-schedule-badge">
                                  {getShortBranchName(schedule.MaChiNhanh)} ({schedule.MaChiNhanh})
                                </span>
                              ) : (
                                <span className="doctor-week-empty">-</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="doctor-empty-state">Chưa có lịch trực tương lai nào được phân cho bác sĩ.</div>
          )}
        </section>
      ) : activeDoctorTab === 'history' ? (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Lịch sử đợt khám</h2>
              <p>Các lượt khám đã hoàn thành của bác sĩ, có thể mở chi tiết đơn thuốc và xét nghiệm.</p>
            </div>
            <strong>{completedEncounterRows.length} lượt khám</strong>
          </div>
          <div className="doctor-table-wrap">
            <table className="doctor-table doctor-history-table">
              <thead>
                <tr>
                  <th>Ngày khám</th>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Chẩn đoán</th>
                  <th>Triệu chứng</th>
                  <th>Lời dặn</th>
                </tr>
              </thead>
              <tbody>
                {completedEncounterRows.map((row) => (
                  <tr
                    key={row.visit.MaLuotKham}
                    className="doctor-clickable-row"
                    onClick={() => setHistoryDetail(row)}
                  >
                    <td>{row.booking.NgayKham}</td>
                    <td>{row.visit.MaLuotKham}</td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>
                      {row.visit.MaBenh} - {row.disease.TenBenh}
                    </td>
                    <td>{row.visit.TrieuChung}</td>
                    <td>{row.visit.LoiDan}</td>
                  </tr>
                ))}
                {completedEncounterRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="doctor-empty-cell">
                      Chưa có lượt khám đã hoàn thành.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="doctor-card">
          <div className="doctor-section-header">
            <div>
              <h2>Cài đặt tài khoản</h2>
              <p>Cập nhật thông tin liên hệ và bảo mật cá nhân ngoài không gian khám bệnh.</p>
            </div>
          </div>
          <div className="doctor-account-layout">
            <section className="doctor-account-summary">
              <div>
                <span>Mã bác sĩ</span>
                <strong>{doctorProfile.MaBacSi}</strong>
              </div>
              <div>
                <span>Họ tên</span>
                <strong>Bác sĩ {doctorProfile.HoTen}</strong>
              </div>
              <div>
                <span>Chuyên khoa</span>
                <strong>{doctorProfile.ChuyenKhoa}</strong>
              </div>
              <div>
                <span>Chi nhánh mặc định</span>
                <strong>{doctorProfile.TenChiNhanh}</strong>
              </div>
            </section>

            <form className="doctor-settings-form" onSubmit={handleUpdatePhone}>
              <label>
                Số điện thoại liên hệ
                <input
                  value={contactForm.SDT}
                  onChange={(event) => setContactForm({ SDT: event.target.value })}
                  placeholder="Nhập số điện thoại mới"
                />
              </label>
              <button type="submit" className="doctor-primary-button">
                Lưu số điện thoại
              </button>
            </form>

            <div className="doctor-security-block">
              <button
                type="button"
                className="doctor-secondary-button"
                onClick={() => setShowPasswordForm((current) => !current)}
              >
                🔑 Đổi mật khẩu
              </button>
              {showPasswordForm && (
                <form className="doctor-password-form" onSubmit={handleChangePassword}>
                  <label>
                    Mật khẩu cũ
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, oldPassword: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Xác nhận mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button type="submit" className="doctor-primary-button">
                    Xác nhận đổi mật khẩu
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      )}

      {historyDetail && (
        <div className="doctor-history-modal-overlay">
          <section className="doctor-history-modal">
            <button
              type="button"
              className="doctor-history-modal-close"
              onClick={() => setHistoryDetail(null)}
              aria-label="Đóng chi tiết lịch sử khám"
            >
              ×
            </button>
            <span className="doctor-kicker">Chi tiết lượt khám</span>
            <h2>
              {historyDetail.visit.MaLuotKham} - {historyDetail.patient.HoTen}
            </h2>
            <div className="doctor-history-modal-grid">
              <section>
                <h3>Đơn thuốc cũ</h3>
                <table className="doctor-table compact">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên thuốc</th>
                      <th>Số lượng</th>
                      <th>Đơn vị</th>
                      <th>Liều dùng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptionDetails
                      .filter((item) => item.MaLuotKham === historyDetail.visit.MaLuotKham)
                      .map((item, index) => {
                        const medicine = getMedicine(item.MaThuoc)
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
              </section>
              <section>
                <h3>Kết quả xét nghiệm cũ</h3>
                <div className="doctor-lab-grid">
                  {labDetails
                    .filter((lab) => lab.MaLuotKham === historyDetail.visit.MaLuotKham)
                    .map((lab) => (
                      <article key={lab.MaChiTietXN} className="doctor-lab-card">
                        <span>{getService(lab.MaDichVu).TenDichVu}</span>
                        <strong className="done">{lab.TrangThaiXetNghiem}</strong>
                        <p>{lab.KetQuaXetNghiem || 'Chưa có kết quả.'}</p>
                      </article>
                    ))}
                  {labDetails.filter((lab) => lab.MaLuotKham === historyDetail.visit.MaLuotKham).length === 0 && (
                    <p className="doctor-empty-state compact">Không có xét nghiệm trong lượt khám này.</p>
                  )}
                </div>
              </section>
              <section>
                <h3>Liệu trình điều trị cũ</h3>
                <div className="doctor-treatment-history-list">
                  {treatmentSchedules
                    .filter((treatment) => treatment.MaLuotKham === historyDetail.visit.MaLuotKham)
                    .map((treatment) => (
                      <article key={treatment.MaLichTrinh}>
                        <strong>{treatment.TenDichVu || getService(treatment.MaDichVu).TenDichVu}</strong>
                        <div>
                          <span>Tổng số buổi: {treatment.TongSoBuoi}</span>
                          <span>Đã làm: {treatment.SoBuoiDaLam}</span>
                          <span>{treatment.TrangThai}</span>
                        </div>
                        <p>{treatment.GhiChuDieuTri}</p>
                      </article>
                    ))}
                  {treatmentSchedules.filter((treatment) => treatment.MaLuotKham === historyDetail.visit.MaLuotKham).length === 0 && (
                    <p className="doctor-empty-state compact">Không có liệu trình điều trị trong lượt khám này.</p>
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function ReceptionistDashboard({ user, onLogout, showNotification, catalogData = EMPTY_CATALOG_DATA }) {
  const TODAY = getTodayDateKey()
  const [activeQueueTab, setActiveQueueTab] = useState('prebooked')
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState('')
  const [checkinRows, setCheckinRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [searchRows, setSearchRows] = useState([])
  const [hasLoadedCheckinRows, setHasLoadedCheckinRows] = useState(false)
  const [hasLoadedQueueRows, setHasLoadedQueueRows] = useState(false)
  const [checkinRowsLoading, setCheckinRowsLoading] = useState(false)
  const [queueRowsLoading, setQueueRowsLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [receptionError, setReceptionError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [checkingInId, setCheckingInId] = useState('')
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [branches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_LAO_KHOA', TenDichVu: 'Khám Tư Vấn Sức Khỏe Lão Khoa', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_HO_HAP', TenDichVu: 'Khám Bệnh Lý Đường Hô Hấp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 170000 },
    { MaDichVu: 'DV_KHAM_NOI_TIET', TenDichVu: 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 220000 },
    { MaDichVu: 'DV_KHAM_DINH_DUONG', TenDichVu: 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_LAY_CAO', TenDichVu: 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_NIENG_RANG', TenDichVu: 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_IMPLANT', TenDichVu: 'Khám Tư Vấn Trồng Răng Implant', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_NOI_SOI_TMH', TenDichVu: 'Nội Soi Tai Mũi Họng Ống Mềm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_THINH_LUC', TenDichVu: 'Khám Đo Thính Lực Đơn Âm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
  ])
  const [staffList] = useState([
    { MaBacSi: 'BS001', HoTen: 'Nguyễn Văn An', ChuyenKhoa: 'Nội tổng quát', SDT: '0911222333' },
    { MaBacSi: 'BS002', HoTen: 'Lê Thị Bình', ChuyenKhoa: 'Răng hàm mặt', SDT: '0922333444' },
    { MaBacSi: 'BS003', HoTen: 'Phạm Hoàng Long', ChuyenKhoa: 'Tai mũi họng', SDT: '0933444555' },
    { MaBacSi: 'BS004', HoTen: 'Trần Trần Đức', ChuyenKhoa: 'Nội tổng quát', SDT: '0944555666' },
    { MaBacSi: 'BS005', HoTen: 'Nguyễn Thị Minh', ChuyenKhoa: 'Nội tổng quát', SDT: '0912345678' },
    { MaBacSi: 'BS006', HoTen: 'Phan Văn Khải', ChuyenKhoa: 'Răng hàm mặt', SDT: '0923456789' },
    { MaBacSi: 'BS007', HoTen: 'Hoàng Lê Giang', ChuyenKhoa: 'Tai mũi họng', SDT: '0934567890' },
    { MaBacSi: 'BS008', HoTen: 'Vũ Ngô Hùng', ChuyenKhoa: 'Răng hàm mặt', SDT: '0945678901' },
    { MaBacSi: 'BS009', HoTen: 'Đỗ Thúy Hạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0913456789' },
    { MaBacSi: 'BS010', HoTen: 'Bùi Chí Kiên', ChuyenKhoa: 'Răng hàm mặt', SDT: '0924567890' },
    { MaBacSi: 'BS011', HoTen: 'Lý Thu Thảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0935678901' },
    { MaBacSi: 'BS012', HoTen: 'Đặng Quốc Bảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0946789012' },
    { MaBacSi: 'BS013', HoTen: 'Ngô Bảo Ngọc', ChuyenKhoa: 'Nội tổng quát', SDT: '0914567890' },
    { MaBacSi: 'BS014', HoTen: 'Dương Văn Lâm', ChuyenKhoa: 'Răng hàm mặt', SDT: '0925678901' },
    { MaBacSi: 'BS015', HoTen: 'Võ Thị Sáu', ChuyenKhoa: 'Tai mũi họng', SDT: '0936789012' },
    { MaBacSi: 'BS016', HoTen: 'Tống Phước Hải', ChuyenKhoa: 'Nội tổng quát', SDT: '0947890123' },
    { MaBacSi: 'BS017', HoTen: 'Đinh Công Mạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0915678901' },
    { MaBacSi: 'BS018', HoTen: 'Mai Phương Thảo', ChuyenKhoa: 'Răng hàm mặt', SDT: '0926789012' },
    { MaBacSi: 'BS019', HoTen: 'Hồ Tiến Dũng', ChuyenKhoa: 'Tai mũi họng', SDT: '0937890123' },
    { MaBacSi: 'BS020', HoTen: 'Trịnh Đình Quang', ChuyenKhoa: 'Răng hàm mặt', SDT: '0948901234' },
    { MaBacSi: 'BS021', HoTen: 'Vương Kim Chi', ChuyenKhoa: 'Nội tổng quát', SDT: '0916789012' },
    { MaBacSi: 'BS022', HoTen: 'Đoàn Nguyên Đức', ChuyenKhoa: 'Răng hàm mặt', SDT: '0927890123' },
    { MaBacSi: 'BS023', HoTen: 'Lưu Hồng Quang', ChuyenKhoa: 'Tai mũi họng', SDT: '0938901234' },
  ])
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      DiaChi: 'Cầu Giấy, Hà Nội',
      MaSoBHYT: 'DN4010123456789',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN002',
      HoTen: 'Nguyễn Thị Mai',
      CCCD: '001200054321',
      SDT: '0907654321',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: 'TE1010999888777',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      DiaChi: 'Nam Từ Liêm, Hà Nội',
      MaSoBHYT: 'DN401000000004',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      DiaChi: 'Thanh Xuân, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN006',
      HoTen: 'Vũ Gia Hân',
      CCCD: '001188000006',
      SDT: '0906000006',
      DiaChi: 'Ba Đình, Hà Nội',
      MaSoBHYT: 'HT401000000006',
      KyTuDauBHYT: 'HT',
    },
    {
      MaBenhAn: 'BN007',
      HoTen: 'Hoàng Đức Anh',
      CCCD: '001189000007',
      SDT: '0907000007',
      DiaChi: 'Cầu Giấy, Hà Nội',
      MaSoBHYT: 'DN401000000007',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN008',
      HoTen: 'Phan Ngọc Linh',
      CCCD: '001190000008',
      SDT: '0908000008',
      DiaChi: 'Đống Đa, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN009',
      HoTen: 'Bùi Quang Huy',
      CCCD: '001191000009',
      SDT: '0909000009',
      DiaChi: 'Long Biên, Hà Nội',
      MaSoBHYT: 'DN401000000009',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN010',
      HoTen: 'Đặng Khánh Vy',
      CCCD: '001192000010',
      SDT: '0910000010',
      DiaChi: 'Hai Bà Trưng, Hà Nội',
      MaSoBHYT: 'TE101000000010',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN011',
      HoTen: 'Ngô Tuấn Kiệt',
      CCCD: '001193000011',
      SDT: '0911000011',
      DiaChi: 'Hoàn Kiếm, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN012',
      HoTen: 'Mai Phương Anh',
      CCCD: '001194000012',
      SDT: '0912000012',
      DiaChi: 'Tây Hồ, Hà Nội',
      MaSoBHYT: 'DN401000000012',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN013',
      HoTen: 'Cao Nhật Minh',
      CCCD: '001195000013',
      SDT: '0913000013',
      DiaChi: 'Hoàng Mai, Hà Nội',
      MaSoBHYT: '',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN014',
      HoTen: 'Tạ Thu Trang',
      CCCD: '001196000014',
      SDT: '0914000014',
      DiaChi: 'Hà Đông, Hà Nội',
      MaSoBHYT: 'DN401000000014',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN015',
      HoTen: 'Lương Quốc Hưng',
      CCCD: '001197000015',
      SDT: '0915000015',
      DiaChi: 'Gia Lâm, Hà Nội',
      MaSoBHYT: 'HT401000000015',
      KyTuDauBHYT: 'HT',
    },
  ])
  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_RT_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310501',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_002',
      MaBenhAn: 'BN004',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310502',
      STT_HangDoi: 2,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_003',
      MaBenhAn: 'BN005',
      MaCauHinh: 'CH_CG_DV_KHAM_GIA_DINH',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310503',
      STT_HangDoi: 3,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_004',
      MaBenhAn: 'BN006',
      MaCauHinh: 'CH_CG_DV_KHAM_TIM_MACH',
      MaDichVu: 'DV_KHAM_TIM_MACH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310504',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_005',
      MaBenhAn: 'BN007',
      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_310505',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_006',
      MaBenhAn: 'BN003',
      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310506',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_007',
      MaBenhAn: 'BN008',
      MaCauHinh: 'CH_CG_DV_LAY_CAO',
      MaDichVu: 'DV_LAY_CAO',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310507',
      STT_HangDoi: 2,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_008',
      MaBenhAn: 'BN009',
      MaCauHinh: 'CH_CG_DV_KHAM_NIENG_RANG',
      MaDichVu: 'DV_KHAM_NIENG_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310508',
      STT_HangDoi: 3,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_009',
      MaBenhAn: 'BN010',
      MaCauHinh: 'CH_CG_DV_KHAM_IMPLANT',
      MaDichVu: 'DV_KHAM_IMPLANT',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310509',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_010',
      MaBenhAn: 'BN011',
      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS002',
      PaymentToken: 'PAY_MOCK_310510',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_011',
      MaBenhAn: 'BN012',
      MaCauHinh: 'CH_CG_DV_KHAM_TMH',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS003',
      PaymentToken: 'PAY_MOCK_310511',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_012',
      MaBenhAn: 'BN013',
      MaCauHinh: 'CH_CG_DV_NOI_SOI_TMH',
      MaDichVu: 'DV_NOI_SOI_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS003',
      PaymentToken: 'PAY_MOCK_310512',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_013',
      MaBenhAn: 'BN014',
      MaCauHinh: 'CH_CG_DV_KHAM_HO_HAP',
      MaDichVu: 'DV_KHAM_HO_HAP',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_310513',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_014',
      MaBenhAn: 'BN015',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI_TIET',
      MaDichVu: 'DV_KHAM_NOI_TIET',
      MaChiNhanh: 'CN_CG',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_310514',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_015',
      MaBenhAn: 'BN002',
      MaCauHinh: 'CH_HBT_DV_KHAM_TMH',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS015',
      PaymentToken: 'PAY_MOCK_310515',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_016',
      MaBenhAn: 'BN004',
      MaCauHinh: 'CH_HBT_DV_KHAM_GIA_DINH',
      MaDichVu: 'DV_KHAM_GIA_DINH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 1,
      MaBacSi: 'BS013',
      PaymentToken: 'PAY_MOCK_310516',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_017',
      MaBenhAn: 'BN005',
      MaCauHinh: 'CH_HBT_DV_KHAM_RANG',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 2,
      MaBacSi: 'BS014',
      PaymentToken: 'PAY_MOCK_310517',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_018',
      MaBenhAn: 'BN006',
      MaCauHinh: 'CH_HBT_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 3,
      MaBacSi: 'BS016',
      PaymentToken: 'PAY_MOCK_310518',
      TrangThai: 'Đã xác nhận',
    },
    {
      MaLichHen: 'LH_RT_019',
      MaBenhAn: 'BN007',
      MaCauHinh: 'CH_HBT_DV_KHAM_IMPLANT',
      MaDichVu: 'DV_KHAM_IMPLANT',
      MaChiNhanh: 'CN_HBT',
      NgayKham: TODAY,
      CaKham: 4,
      MaBacSi: 'BS018',
      PaymentToken: 'PAY_MOCK_310519',
      STT_HangDoi: 1,
      TrangThai: 'Chờ khám',
    },
    {
      MaLichHen: 'LH_RT_020',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
      MaDichVu: 'DV_KHAM_TIEU_HOA',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-30',
      CaKham: 2,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_300501',
      TrangThai: 'Hoàn thành',
    },
  ])

  const effectiveBranches = catalogData?.branches?.length ? catalogData.branches : branches
  const effectiveServices = catalogData?.services?.length ? catalogData.services : services
  const catalogDoctors = (catalogData?.doctors || [])
    .filter((doctor) => (doctor.TrangThai || 'Đang hoạt động') === 'Đang hoạt động')
    .map((doctor) => ({
      MaBacSi: doctor.MaBacSi,
      HoTen: doctor.HoTen || doctor.MaBacSi,
      ChuyenKhoa: doctor.ChuyenKhoa || '',
      SDT: doctor.SDT || '',
      TrangThai: doctor.TrangThai || 'Đang hoạt động',
    }))
  const effectiveStaffList = catalogDoctors.length
    ? catalogDoctors.concat(
        staffList.filter((mockDoctor) => !catalogDoctors.some((doctor) => doctor.MaBacSi === mockDoctor.MaBacSi)),
      )
    : staffList

  const maChiNhanh = user?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || 'CN_CG'
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh) || effectiveBranches[0]
  const branchDoctorsToday = useMemo(() => {
    const doctorMap = (catalogData?.doctorSchedules || [])
      .filter((schedule) => schedule.MaChiNhanh === maChiNhanh && schedule.NgayTruc === TODAY)
      .reduce((currentMap, schedule) => {
        if (!schedule.MaBacSi || currentMap[schedule.MaBacSi]) return currentMap
        const catalogDoctor = catalogDoctors.find((doctor) => doctor.MaBacSi === schedule.MaBacSi)

        currentMap[schedule.MaBacSi] = {
          MaBacSi: schedule.MaBacSi,
          HoTen: catalogDoctor?.HoTen || schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
          ChuyenKhoa: catalogDoctor?.ChuyenKhoa || schedule.ChuyenKhoa || '',
          SDT: catalogDoctor?.SDT || schedule.SDT || '',
        }
        return currentMap
      }, {})

    return Object.values(doctorMap)
  }, [catalogData?.doctorSchedules, catalogDoctors, maChiNhanh, TODAY])

  const normalizeReceptionBooking = (appointment) => ({
    MaLichHen: appointment.MaLichHen,
    MaBenhAn: appointment.MaBenhAn || '',
    MaCauHinh: appointment.MaCauHinh || '',
    MaDichVu: appointment.MaDichVu || '',
    TenDichVu: appointment.TenDichVu || '',
    MaChiNhanh: appointment.MaChiNhanh || maChiNhanh,
    NgayKham: appointment.NgayKham || TODAY,
    CaKham: appointment.CaKham || '',
    MaBacSi: appointment.MaBacSi || '',
    TenBacSi: appointment.TenBacSi || appointment.HoTenBacSi || '',
    ChuyenKhoa: appointment.ChuyenKhoa || '',
    PaymentToken: appointment.PaymentToken || '',
    GiaCuoi: appointment.GiaCuoi || 0,
    STT: appointment.STT || appointment.STT_HangDoi || '',
    STT_HangDoi: appointment.STT_HangDoi || appointment.STT || '',
    TrangThai: appointment.TrangThai || 'Chờ khám',
    MaLeTan: appointment.MaLeTan || '',
    patient: {
      MaBenhAn: appointment.MaBenhAn || '',
      HoTen: appointment.HoTen || appointment.TenBenhNhan || 'Chưa rõ',
      CCCD: appointment.CCCD || '',
      SDT: appointment.SDT || appointment.SDTBenhNhan || 'Chưa cập nhật',
    },
  })

  const loadCheckinAppointments = async () => {
    if (!maChiNhanh) return

    setCheckinRowsLoading(true)
    setReceptionError('')

    try {
      const params = new URLSearchParams({ ma_chi_nhanh: maChiNhanh, ngay: TODAY })
      const response = await fetch(`${BACKEND_URL}/letan/checkin-appointments?${params.toString()}`)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải danh sách chờ tiếp đón.')
      }

      setCheckinRows(Array.isArray(result.data) ? result.data.map(normalizeReceptionBooking) : [])
      setHasLoadedCheckinRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách chờ tiếp đón.'
      setReceptionError(message)
      console.warn('RECEPTION_CHECKIN_APPOINTMENTS_LOAD_FAILED', message)
    } finally {
      setCheckinRowsLoading(false)
    }
  }

  const loadDoctorQueues = async () => {
    if (!maChiNhanh) return

    if (branchDoctorsToday.length === 0) {
      setQueueRows([])
      setHasLoadedQueueRows(true)
      return
    }

    setQueueRowsLoading(true)
    setReceptionError('')

    try {
      const queueResults = await Promise.all(
        branchDoctorsToday.map(async (doctor) => {
          const params = new URLSearchParams({ ma_chi_nhanh: maChiNhanh })
          const response = await fetch(
            `${BACKEND_URL}/letan/waiting-list/${encodeURIComponent(doctor.MaBacSi)}/${TODAY}?${params.toString()}`,
          )
          const result = await response.json()

          if (!response.ok || !result?.success) {
            throw new Error(result?.message || `Không thể tải hàng đợi của ${doctor.MaBacSi}.`)
          }

          return Array.isArray(result.data) ? result.data : []
        }),
      )

      setQueueRows(queueResults.flat().map(normalizeReceptionBooking))
      setHasLoadedQueueRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải hàng đợi bác sĩ.'
      setReceptionError(message)
      console.warn('RECEPTION_DOCTOR_QUEUES_LOAD_FAILED', message)
    } finally {
      setQueueRowsLoading(false)
    }
  }

  useEffect(() => {
    loadCheckinAppointments()
  }, [maChiNhanh, TODAY])

  useEffect(() => {
    loadDoctorQueues()
  }, [maChiNhanh, branchDoctorsToday, TODAY])

  useEffect(() => {
    const keyword = searchTerm.trim()

    if (keyword.length < 2) {
      setSearchRows([])
      setSearchError('')
      setSearchLoading(false)
      return undefined
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchError('')

      try {
        const params = new URLSearchParams({ keyword, ma_chi_nhanh: maChiNhanh, ngay: TODAY })
        const response = await fetch(`${BACKEND_URL}/letan/search-checkin-appointment?${params.toString()}`)
        const result = await response.json()

        if (!response.ok || !result?.success) {
          setSearchRows([])
          setSearchError(result?.message || 'Không tìm thấy lịch khám phù hợp.')
          return
        }

        setSearchRows(Array.isArray(result.data) ? result.data.map(normalizeReceptionBooking) : [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể tìm lịch khám.'
        setSearchRows([])
        setSearchError(message)
        console.warn('RECEPTION_SEARCH_FAILED', message)
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchTerm, maChiNhanh, TODAY])

  const matchedPatient = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return null

    if (searchRows.length > 0) {
      return searchRows[0].patient
    }

    return patients.find((patient) =>
      [patient.CCCD, patient.SDT, patient.MaBenhAn, patient.HoTen]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    )
  }, [patients, searchRows, searchTerm])
  const matchedPatientBookings = searchRows.length
    ? searchRows
    : matchedPatient
    ? bookings.filter(
        (booking) =>
          booking.MaBenhAn === matchedPatient.MaBenhAn &&
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY,
      )
    : []
  const confirmedMatchedBookings = matchedPatientBookings.filter(
    (booking) =>
      (booking.TrangThai === 'Chờ khám' && !booking.MaLeTan) ||
      booking.TrangThai === 'Đã xác nhận',
  )
  const waitingReceptionBookings = hasLoadedCheckinRows
    ? checkinRows
    : bookings.filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.TrangThai === 'Đã xác nhận',
      )
  const queueBookings = (hasLoadedQueueRows
    ? queueRows
    : bookings.filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.TrangThai === 'Chờ khám',
      ))
    .sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0))

  const receptionPatientMap = [...checkinRows, ...queueRows, ...searchRows].reduce((patientMap, booking) => {
    if (booking.patient?.MaBenhAn) {
      patientMap.set(booking.patient.MaBenhAn, booking.patient)
    }
    return patientMap
  }, new Map())

  const getPatient = (maBenhAn) =>
    receptionPatientMap.get(maBenhAn) ||
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      SDT: 'Chưa cập nhật',
    }

  const getService = (maDichVu) =>
    effectiveServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      ChuyenKhoa: '',
      GiaGoc: 0,
    }

  const getDoctor = (maBacSi) =>
    effectiveStaffList.find((doctor) => doctor.MaBacSi === maBacSi) || {
      MaBacSi: maBacSi,
      HoTen: 'Đang điều phối',
      ChuyenKhoa: 'Chưa rõ',
    }

  const queueGroups = (() => {
    const groupMap = new Map()

    queueBookings.forEach((booking) => {
      const current = groupMap.get(booking.MaBacSi) || []
      groupMap.set(booking.MaBacSi, [...current, booking])
    })

    return Array.from(groupMap.entries())
      .map(([maBacSi, items]) => ({
        doctor: getDoctor(maBacSi),
        items: items.sort((a, b) => Number(a.STT_HangDoi || 0) - Number(b.STT_HangDoi || 0)),
      }))
      .sort((a, b) => a.doctor.HoTen.localeCompare(b.doctor.HoTen, 'vi'))
  })()

  const getNextQueueNumber = (maBacSi) => {
    const todayQueueNumbers = bookings
      .filter(
        (booking) =>
          booking.MaChiNhanh === maChiNhanh &&
          booking.NgayKham === TODAY &&
          booking.MaBacSi === maBacSi &&
          booking.TrangThai === 'Chờ khám',
      )
      .map((booking) => Number(booking.STT_HangDoi || 0))

    return Math.max(0, ...todayQueueNumbers) + 1
  }

  const handleCheckIn = async (maLichHen) => {
    const targetBooking =
      [...waitingReceptionBookings, ...matchedPatientBookings, ...bookings].find(
        (booking) => booking.MaLichHen === maLichHen,
      )
    if (!targetBooking) return

    if (!hasLoadedCheckinRows && String(maLichHen).startsWith('LH_RT_')) {
      const queueNumber = getNextQueueNumber(targetBooking.MaBacSi)
      setBookings((current) =>
        current.map((booking) =>
          booking.MaLichHen === maLichHen
            ? {
                ...booking,
                STT_HangDoi: queueNumber,
                TrangThai: 'Chờ khám',
              }
            : booking,
        ),
      )
      notify(`Đã check-in lịch hẹn ${maLichHen}, cấp STT hàng đợi ${queueNumber}.`)
      setActiveQueueTab('queue')
      return
    }

    const maLeTan = user?.MaLeTan || user?.id || user?.username
    if (!maLeTan) {
      notify('Không xác định được mã lễ tân để check-in.', 'error')
      return
    }

    setCheckingInId(maLichHen)

    try {
      const formData = new FormData()
      formData.append('ma_lich_hen', maLichHen)
      formData.append('ma_chi_nhanh', maChiNhanh)
      formData.append('ma_le_tan', maLeTan)

      const response = await fetch(`${BACKEND_URL}/letan/checkin`, {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể check-in lịch hẹn.')
      }

      const queueNumber = result.data?.STT_HangDoi || result.data?.STT || ''
      notify(
        queueNumber
          ? `Đã check-in lịch hẹn ${maLichHen}, cấp STT hàng đợi ${queueNumber}.`
          : `Đã check-in lịch hẹn ${maLichHen}.`,
      )
      setSearchRows((current) =>
        current.map((booking) =>
          booking.MaLichHen === maLichHen
            ? {
                ...booking,
                MaLeTan: maLeTan,
                STT_HangDoi: queueNumber || booking.STT_HangDoi,
                STT: queueNumber || booking.STT,
              }
            : booking,
        ),
      )
      await Promise.all([loadCheckinAppointments(), loadDoctorQueues()])
      setActiveQueueTab('queue')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể check-in lịch hẹn.'
      notify(message, 'error')
    } finally {
      setCheckingInId('')
    }
  }

  return (
    <main className="reception-shell">
      <header className="reception-topbar">
        <div>
          <span className="reception-kicker">Medicare Reception</span>
          <h1>HỆ THỐNG TIẾP ĐÓN & ĐIỀU PHỐI HÀNG ĐỢI - {currentBranch.TenChiNhanh}</h1>
          <p>
            Lễ tân phụ trách: <strong>{user?.name || user?.id || 'Lễ tân'}</strong> · Ngày vận hành:{' '}
            <strong>{TODAY}</strong>
          </p>
        </div>
        <button type="button" className="reception-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="reception-feedback">{feedback}</p>}
      {receptionError && <p className="reception-feedback">{receptionError}</p>}

      <section className="reception-card">
        <div className="reception-section-header">
          <div>
            <h2>Tra cứu bệnh nhân & tiếp đón nhanh</h2>
            <p>Nhập CCCD, SĐT, mã bệnh án hoặc họ tên để kiểm tra lịch đặt trước trong ngày.</p>
          </div>
        </div>

        <input
          className="reception-search-input"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tìm theo CCCD, số điện thoại, mã bệnh án hoặc họ tên..."
        />

        {searchTerm.trim() && !matchedPatient && (
          <div className="reception-empty-state">
            {searchLoading ? 'Đang tra cứu lịch khám...' : searchError || 'Không tìm thấy bệnh nhân hoặc lịch khám phù hợp tại chi nhánh này.'}
          </div>
        )}

        {matchedPatient && (
          <div className="reception-patient-result">
            <div>
              <span>Bệnh nhân</span>
              <strong>{matchedPatient.HoTen}</strong>
              <small>
                {matchedPatient.MaBenhAn} · CCCD {matchedPatient.CCCD} · SĐT {matchedPatient.SDT}
              </small>
            </div>
            {confirmedMatchedBookings.length > 0 ? (
              <div className="reception-booking-cards">
                {confirmedMatchedBookings.map((booking) => {
                  const service = getService(booking.MaDichVu)
                  const doctor = getDoctor(booking.MaBacSi)
                  return (
                    <article key={booking.MaLichHen} className="reception-booking-card">
                      <div>
                        <strong>{booking.TenDichVu || service.TenDichVu}</strong>
                        <span>
                          Ca {booking.CaKham} · Bác sĩ {booking.TenBacSi || doctor.HoTen} · {booking.MaLichHen}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="reception-primary-button"
                        disabled={checkingInId === booking.MaLichHen}
                        onClick={() => handleCheckIn(booking.MaLichHen)}
                      >
                        {checkingInId === booking.MaLichHen
                          ? 'Đang check-in...'
                          : 'Xác nhận tiếp đón (Vào hàng đợi)'}
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : matchedPatientBookings.length > 0 ? (
              <div className="reception-direct-box">
                <p>
                  Bệnh nhân đã có lịch hôm nay tại chi nhánh này với trạng thái:{' '}
                  {matchedPatientBookings.map((booking) => booking.TrangThai).join(', ')}.
                </p>
              </div>
            ) : (
              <div className="reception-direct-box">
                <p>
                  Bệnh nhân chưa đặt lịch trực tuyến tại chi nhánh này trong ngày hôm nay. Quy trình hiện tại yêu cầu bệnh nhân đặt lịch online và thanh toán trước từ nhà.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="reception-card">
        <div className="reception-section-header">
          <div>
            <h2>Quản lý luồng hàng đợi phòng khám trong ngày</h2>
            <p>Dữ liệu được lọc cứng theo chi nhánh {currentBranch.MaChiNhanh}.</p>
          </div>
          <div className="reception-tab-row">
            <button
              type="button"
              className={activeQueueTab === 'prebooked' ? 'active' : ''}
              onClick={() => setActiveQueueTab('prebooked')}
            >
              Chờ tiếp đón ({waitingReceptionBookings.length})
            </button>
            <button
              type="button"
              className={activeQueueTab === 'queue' ? 'active' : ''}
              onClick={() => setActiveQueueTab('queue')}
            >
              Hàng đợi khám ({queueBookings.length})
            </button>
          </div>
        </div>

        {(checkinRowsLoading || queueRowsLoading) && (
          <div className="reception-empty-state">Đang tải dữ liệu lễ tân từ hệ thống...</div>
        )}

        {activeQueueTab === 'prebooked' ? (
          <div className="reception-table-wrap">
            <table className="reception-table">
              <thead>
                <tr>
                  <th>STT đặt trước</th>
                  <th>Mã bệnh án</th>
                  <th>Họ tên</th>
                  <th>Số điện thoại</th>
                  <th>Ca khám</th>
                  <th>Dịch vụ khám</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {waitingReceptionBookings.map((booking, index) => {
                  const patient = getPatient(booking.MaBenhAn)
                  const service = getService(booking.MaDichVu)
                  return (
                    <tr key={booking.MaLichHen}>
                      <td>{index + 1}</td>
                      <td>{patient.MaBenhAn}</td>
                      <td>{patient.HoTen}</td>
                      <td>{patient.SDT}</td>
                      <td>Ca {booking.CaKham}</td>
                      <td>{booking.TenDichVu || service.TenDichVu}</td>
                      <td>
                        <button
                          type="button"
                          className="reception-primary-button compact"
                          disabled={checkingInId === booking.MaLichHen}
                          onClick={() => handleCheckIn(booking.MaLichHen)}
                        >
                          {checkingInId === booking.MaLichHen ? 'Đang check-in...' : 'Check-in Tiếp Đón'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {waitingReceptionBookings.length === 0 && (
                  <tr>
                    <td colSpan="7" className="reception-empty-cell">
                      Không còn lịch đặt trước đang chờ tiếp đón.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : queueGroups.length > 0 ? (
          <div className="reception-doctor-queue-grid">
            {queueGroups.map((group) => (
              <article key={group.doctor.MaBacSi} className="reception-doctor-queue-card">
                <header>
                  <div>
                    <span>{group.doctor.MaBacSi}</span>
                    <h3>
                      Phòng khám: Bác sĩ {group.doctor.HoTen} - Khoa {group.doctor.ChuyenKhoa}
                    </h3>
                  </div>
                  <strong>{group.items.length} bệnh nhân</strong>
                </header>
                <div className="reception-table-wrap">
                  <table className="reception-table compact">
                    <thead>
                      <tr>
                        <th>STT hàng đợi</th>
                        <th>Họ tên bệnh nhân</th>
                        <th>Ca khám</th>
                        <th>Dịch vụ lâm sàng</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((booking, index) => {
                        const patient = getPatient(booking.MaBenhAn)
                        const service = getService(booking.MaDichVu)
                        return (
                          <tr key={booking.MaLichHen}>
                            <td>{index + 1}</td>
                            <td>{patient.HoTen}</td>
                            <td>Ca {booking.CaKham}</td>
                            <td>{booking.TenDichVu || service.TenDichVu}</td>
                            <td>
                              <span className="reception-status-pill">Chờ khám</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="reception-empty-state">Chưa có bệnh nhân nào trong hàng đợi khám.</div>
        )}
      </section>
    </main>
  )
}

function TechnicianDashboard({ user, onLogout, showNotification, onUpdateUser, catalogData = EMPTY_CATALOG_DATA }) {
  const [activeTab, setActiveTab] = useState('pending')
  const [paymentModal, setPaymentModal] = useState(null)
  const [resultModal, setResultModal] = useState(null)
  const [resultText, setResultText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [labApiRows, setLabApiRows] = useState([])
  const [hasLoadedLabRows, setHasLoadedLabRows] = useState(false)
  const [labRowsLoading, setLabRowsLoading] = useState(false)
  const [labRowsError, setLabRowsError] = useState('')
  const [labActionLoading, setLabActionLoading] = useState('')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const notify = (message, type = 'success') => {
    setFeedback(message)
    showNotification?.(message, type)
  }
  const [branches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    },
  ])
  const [patients] = useState([
    {
      MaBenhAn: 'BN001',
      HoTen: 'Trần Quang Hải',
      CCCD: '001095012345',
      SDT: '0901234567',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN002',
      HoTen: 'Nguyễn Thị Mai',
      CCCD: '001200054321',
      SDT: '0907654321',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN003',
      HoTen: 'Phạm Lê Minh',
      CCCD: '001221098765',
      SDT: '0911999888',
      KyTuDauBHYT: 'TE',
    },
    {
      MaBenhAn: 'BN004',
      HoTen: 'Lê Hoàng Nam',
      CCCD: '001186000004',
      SDT: '0904000004',
      KyTuDauBHYT: 'DN',
    },
    {
      MaBenhAn: 'BN005',
      HoTen: 'Đỗ Minh Châu',
      CCCD: '001187000005',
      SDT: '0905000005',
      KyTuDauBHYT: '',
    },
    {
      MaBenhAn: 'BN006',
      HoTen: 'Vũ Gia Hân',
      CCCD: '001188000006',
      SDT: '0906000006',
      KyTuDauBHYT: 'HT',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_NUOC_TIEU', TenDichVu: 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 120000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'XN_DUONG_HUYET', TenDichVu: 'Xét Nghiệm Đường Huyết Nhanh', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 80000 },
  ])
  const [bookings] = useState([
    {
      MaLichHen: 'LH_LAB_001',
      MaBenhAn: 'BN001',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 1,
      MaBacSi: 'BS001',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_002',
      MaBenhAn: 'BN003',
      MaDichVu: 'DV_KHAM_RANG',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 2,
      MaBacSi: 'BS002',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_003',
      MaBenhAn: 'BN004',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 3,
      MaBacSi: 'BS003',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_004',
      MaBenhAn: 'BN002',
      MaDichVu: 'DV_KHAM_TMH',
      MaChiNhanh: 'CN_HBT',
      NgayKham: '2026-05-31',
      CaKham: 1,
      MaBacSi: 'BS015',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_005',
      MaBenhAn: 'BN005',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_HBT',
      NgayKham: '2026-05-31',
      CaKham: 2,
      MaBacSi: 'BS016',
      TrangThai: 'Đang khám',
    },
    {
      MaLichHen: 'LH_LAB_006',
      MaBenhAn: 'BN006',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-05-31',
      CaKham: 4,
      MaBacSi: 'BS004',
      TrangThai: 'Đang khám',
    },
  ])
  const [visitRecords] = useState([
    { MaLuotKham: 'LK_001', MaLichHen: 'LH_LAB_001', ChanDoanSoBo: 'Theo dõi thiếu máu, đau thượng vị' },
    { MaLuotKham: 'LK_002', MaLichHen: 'LH_LAB_002', ChanDoanSoBo: 'Đau răng, cần kiểm tra chỉ số viêm' },
    { MaLuotKham: 'LK_003', MaLichHen: 'LH_LAB_003', ChanDoanSoBo: 'Viêm mũi xoang, cần xét nghiệm máu' },
    { MaLuotKham: 'LK_004', MaLichHen: 'LH_LAB_004', ChanDoanSoBo: 'Theo dõi viêm đường hô hấp' },
    { MaLuotKham: 'LK_005', MaLichHen: 'LH_LAB_005', ChanDoanSoBo: 'Tầm soát chuyển hóa' },
    { MaLuotKham: 'LK_006', MaLichHen: 'LH_LAB_006', ChanDoanSoBo: 'Đánh giá chức năng gan thận' },
  ])
  const [labDetails, setLabDetails] = useState([
    {
      MaChiTietXN: 'CTXN_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'XN_MAU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_002',
      MaLuotKham: 'LK_001',
      MaDichVu: 'SA_O_BUNG',
      PaymentToken: 'PAY_LAB_100002',
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_003',
      MaLuotKham: 'LK_002',
      MaDichVu: 'XN_MAU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_004',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_SINH_HOA',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_005',
      MaLuotKham: 'LK_004',
      MaDichVu: 'XN_NUOC_TIEU',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_006',
      MaLuotKham: 'LK_005',
      MaDichVu: 'XN_DUONG_HUYET',
      PaymentToken: 'PAY_LAB_100006',
      KetQuaXetNghiem: 'Glucose máu mao mạch 5.8 mmol/L.',
      MaXNV: 'XNV002',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
    {
      MaChiTietXN: 'CTXN_007',
      MaLuotKham: 'LK_006',
      MaDichVu: 'XN_SINH_HOA',
      PaymentToken: null,
      KetQuaXetNghiem: '',
      MaXNV: '',
      TrangThaiXetNghiem: 'Chưa thực hiện',
    },
    {
      MaChiTietXN: 'CTXN_008',
      MaLuotKham: 'LK_003',
      MaDichVu: 'XN_DUONG_HUYET',
      PaymentToken: 'PAY_LAB_100008',
      KetQuaXetNghiem: 'Glucose máu nhanh 5.4 mmol/L, trong giới hạn bình thường.',
      MaXNV: 'XNV001',
      TrangThaiXetNghiem: 'Đã có kết quả',
    },
  ])
  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]
  const [technicianProfile, setTechnicianProfile] = useState({
    MaXNV: user?.MaXNV || user?.id || 'XNV001',
    HoTen: user?.HoTen || user?.name || user?.id || 'Xét nghiệm viên',
    MaChiNhanh: user?.MaChiNhanh || 'CN_CG',
    MatKhau: user?.MatKhau || '123456',
  })

	  const effectiveBranches = catalogData?.branches?.length ? catalogData.branches : branches
	  const effectiveServices = catalogData?.services?.length ? catalogData.services : services
	  const effectiveBhytCategories = catalogData?.bhyt?.length ? catalogData.bhyt : bhytCategories
  const allKnownServices = effectiveServices.concat(
    services.filter((mockService) => !effectiveServices.some((service) => service.MaDichVu === mockService.MaDichVu)),
  )

  const maChiNhanh = effectiveBranches.some((branch) => branch.MaChiNhanh === technicianProfile.MaChiNhanh)
    ? technicianProfile.MaChiNhanh
    : effectiveBranches[0]?.MaChiNhanh || 'CN_CG'
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh) || effectiveBranches[0]
  const normalizeLabApiRow = (row) => {
    const giaGoc = Number(row.GiaGoc || 0)
    const bhytRate = Number(row.TyLeHuong || 0)
    const bhytAmount = Number(row.BHYTGiamTru || Math.round(giaGoc * bhytRate))
    const finalAmount = Number(row.GiaCuoi || row.GiaCuoiThucTra || Math.max(0, giaGoc - bhytAmount))

    return {
      lab: {
        MaChiTietXN: row.MaChiTietXN,
        MaLuotKham: row.MaLuotKham,
        MaDichVu: row.MaDichVu,
        PaymentToken: row.PaymentToken || '',
        GiaCuoi: finalAmount,
        KetQuaXetNghiem: row.KetQuaXetNghiem || '',
        MaXNV: row.MaXNV || '',
        TrangThaiXetNghiem: row.TrangThaiXetNghiem || 'Chưa thực hiện',
      },
      visit: {
        MaLuotKham: row.MaLuotKham,
        MaLichHen: row.MaLichHen,
        ChanDoanSoBo: row.TenBacSi ? `Chỉ định bởi ${row.TenBacSi}` : '',
      },
      booking: {
        MaLichHen: row.MaLichHen,
        MaBenhAn: row.MaBenhAn,
        MaChiNhanh: row.MaChiNhanh,
        NgayKham: row.NgayKham || '',
        CaKham: row.CaKham || '',
        MaBacSi: row.MaBacSi || '',
      },
      patient: {
        MaBenhAn: row.MaBenhAn,
        HoTen: row.HoTen || row.TenBenhNhan || 'Chưa rõ',
        CCCD: row.CCCD || '',
        SDT: row.SDT || '',
        KyTuDauBHYT: row.KyTuDauBHYT || '',
      },
      service: {
        MaDichVu: row.MaDichVu,
        TenDichVu: row.TenDichVu || row.MaDichVu,
        GiaGoc: giaGoc,
      },
      bhytRate,
      bhytAmount,
      finalAmount,
    }
  }

  const loadLabRows = async () => {
    if (!maChiNhanh) return

    setLabRowsLoading(true)
    setLabRowsError('')

    try {
      const response = await fetch(`${BACKEND_URL}/xnv/tests?ma_chi_nhanh=${encodeURIComponent(maChiNhanh)}`)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải danh sách xét nghiệm.')
      }

      setLabApiRows(Array.isArray(result.data) ? result.data.map(normalizeLabApiRow) : [])
      setHasLoadedLabRows(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách xét nghiệm.'
      setLabRowsError(message)
      console.warn('LAB_ROWS_LOAD_FAILED', message)
    } finally {
      setLabRowsLoading(false)
    }
  }

  useEffect(() => {
    loadLabRows()
  }, [maChiNhanh])

  const getPatient = (maBenhAn) =>
    patients.find((patient) => patient.MaBenhAn === maBenhAn) || {
      MaBenhAn: maBenhAn,
      HoTen: 'Chưa rõ',
      KyTuDauBHYT: '',
    }

  const getService = (maDichVu) =>
    allKnownServices.find((service) => service.MaDichVu === maDichVu) || {
      MaDichVu: maDichVu,
      TenDichVu: maDichVu,
      GiaGoc: 0,
    }

  const getVisit = (maLuotKham) => visitRecords.find((visit) => visit.MaLuotKham === maLuotKham)

  const getBooking = (maLichHen) => bookings.find((booking) => booking.MaLichHen === maLichHen)

  const getBhytRate = (patient) =>
    effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const buildLabRows = () => {
    if (hasLoadedLabRows) {
      return labApiRows
    }

    return labDetails
      .map((lab) => {
        const visit = getVisit(lab.MaLuotKham)
        const booking = getBooking(visit?.MaLichHen)
        const patient = getPatient(booking?.MaBenhAn)
        const service = getService(lab.MaDichVu)
        const bhytRate = getBhytRate(patient)
        const bhytAmount = Math.round(service.GiaGoc * bhytRate)
        const finalAmount = Math.max(0, service.GiaGoc - bhytAmount)

        return {
          lab,
          visit,
          booking,
          patient,
          service,
          bhytRate,
          bhytAmount,
          finalAmount,
        }
      })
      .filter((row) => row.booking?.MaChiNhanh === maChiNhanh)
  }

  const labRows = buildLabRows()
  const currentTechnicianId = technicianProfile.MaXNV || 'XNV001'
  const pendingRows = labRows.filter((row) => row.lab.TrangThaiXetNghiem === 'Chưa thực hiện')
  const completedRows = labRows.filter(
    (row) =>
      row.lab.TrangThaiXetNghiem === 'Đã có kết quả' &&
      (!row.lab.MaXNV || row.lab.MaXNV === currentTechnicianId),
  )

  const handleOpenPayment = (row) => {
    setPaymentModal(row)
  }

  const handleConfirmPayment = async () => {
    if (!paymentModal) return

    setLabActionLoading(paymentModal.lab.MaChiTietXN)

    try {
      if (hasLoadedLabRows) {
        const formData = new FormData()
        formData.append('MaChiTietXN', paymentModal.lab.MaChiTietXN)
        formData.append('MaChiNhanh', maChiNhanh)

        const response = await fetch(`${BACKEND_URL}/xnv/accept-test`, {
          method: 'POST',
          body: formData,
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể ghi nhận thanh toán xét nghiệm.')
        }

        const paymentToken = result.data?.PaymentToken || paymentModal.lab.PaymentToken
        const finalAmount = Number(result.data?.GiaCuoi || paymentModal.finalAmount)
        setLabApiRows((current) =>
          current.map((row) =>
            row.lab.MaChiTietXN === paymentModal.lab.MaChiTietXN
              ? {
                  ...row,
                  finalAmount,
                  lab: {
                    ...row.lab,
                    PaymentToken: paymentToken,
                    GiaCuoi: finalAmount,
                  },
                }
              : row,
          ),
        )
        notify(`Đã ghi nhận thanh toán ${paymentToken} cho ${paymentModal.service.TenDichVu}.`)
      } else {
        const paymentToken = `PAY_LAB_${Math.floor(100000 + Math.random() * 900000)}`
        setLabDetails((current) =>
          current.map((lab) =>
            lab.MaChiTietXN === paymentModal.lab.MaChiTietXN
              ? { ...lab, PaymentToken: paymentToken }
              : lab,
          ),
        )
        notify(`Đã ghi nhận thanh toán ${paymentToken} cho ${paymentModal.service.TenDichVu}.`)
      }

      setPaymentModal(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể ghi nhận thanh toán xét nghiệm.'
      notify(message, 'error')
    } finally {
      setLabActionLoading('')
    }
  }

  const handleOpenResultModal = (row) => {
    setResultModal(row)
    setResultText(row.lab.KetQuaXetNghiem || '')
  }

  const handleCloseResultModal = () => {
    setResultModal(null)
    setResultText('')
  }

  const handleSaveResult = async () => {
    if (!resultModal) return

    const trimmedResult = resultText.trim()
    if (!trimmedResult) {
      notify('Vui lòng nhập nội dung kết quả xét nghiệm.', 'error')
      return
    }

    setLabActionLoading(resultModal.lab.MaChiTietXN)

    try {
      if (hasLoadedLabRows) {
        const formData = new FormData()
        formData.append('MaChiTietXN', resultModal.lab.MaChiTietXN)
        formData.append('KetQuaXetNghiem', trimmedResult)
        formData.append('MaXNV', currentTechnicianId)
        formData.append('MaChiNhanh', maChiNhanh)

        const response = await fetch(`${BACKEND_URL}/xnv/update-result`, {
          method: 'POST',
          body: formData,
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể cập nhật kết quả xét nghiệm.')
        }

        setLabApiRows((current) =>
          current.map((row) =>
            row.lab.MaChiTietXN === resultModal.lab.MaChiTietXN
              ? {
                  ...row,
                  lab: {
                    ...row.lab,
                    KetQuaXetNghiem: trimmedResult,
                    MaXNV: currentTechnicianId,
                    TrangThaiXetNghiem: 'Đã có kết quả',
                  },
                }
              : row,
          ),
        )
      } else {
        setLabDetails((current) =>
          current.map((lab) =>
            lab.MaChiTietXN === resultModal.lab.MaChiTietXN
              ? {
                  ...lab,
                  KetQuaXetNghiem: trimmedResult,
                  MaXNV: currentTechnicianId,
                  TrangThaiXetNghiem: 'Đã có kết quả',
                }
              : lab,
          ),
        )
      }

      notify(`Đã trả kết quả xét nghiệm cho lượt khám ${resultModal.lab.MaLuotKham}.`)
      setActiveTab('completed')
      handleCloseResultModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật kết quả xét nghiệm.'
      notify(message, 'error')
    } finally {
      setLabActionLoading('')
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

  const handleChangePassword = (event) => {
    event.preventDefault()

    if (passwordForm.currentPassword !== technicianProfile.MatKhau) {
      notify('Mật khẩu hiện tại không chính xác.', 'error')
      return
    }

    if (!passwordForm.newPassword.trim()) {
      notify('Vui lòng nhập mật khẩu mới.', 'error')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error')
      return
    }

    const nextProfile = {
      ...technicianProfile,
      MatKhau: passwordForm.newPassword,
    }

    setTechnicianProfile(nextProfile)
    onUpdateUser?.({ MatKhau: passwordForm.newPassword })
    handleCancelPasswordChange()
    notify('Đổi mật khẩu thành công!')
  }

  return (
    <main className="technician-shell">
      <header className="technician-topbar">
        <div>
          <span className="technician-kicker">Medicare Laboratory</span>
          <h1>TRUNG TÂM XÉT NGHIỆM & CHẨN ĐOÁN HÌNH ẢNH - Medicare {currentBranch.TenChiNhanh}</h1>
          <p>
            Xét nghiệm viên: <strong>{technicianProfile.HoTen}</strong> · Mã tài khoản:{' '}
            <strong>{technicianProfile.MaXNV}</strong> · Chi nhánh:{' '}
            <strong>{currentBranch.MaChiNhanh}</strong>
          </p>
        </div>
        <button type="button" className="technician-logout-button" onClick={onLogout}>
          <LogOut size={18} />
          Đăng xuất
        </button>
      </header>

      {feedback && <p className="technician-feedback">{feedback}</p>}
      {labRowsLoading && <p className="technician-feedback">Đang tải chỉ định xét nghiệm từ hệ thống...</p>}
      {labRowsError && <p className="technician-feedback">{labRowsError}</p>}

      <section className="technician-card">
        <div className="technician-section-header">
          <div>
            <h2>Quản lý chỉ định cận lâm sàng</h2>
            <p>Dữ liệu được lọc theo chi nhánh của lượt khám gốc và tính giá cuối sau giảm trừ BHYT tại chỗ.</p>
          </div>
          <div className="technician-tab-row">
            <button
              type="button"
              className={activeTab === 'pending' ? 'active' : ''}
              onClick={() => setActiveTab('pending')}
            >
              Chỉ định chờ thực hiện ({pendingRows.length})
            </button>
            <button
              type="button"
              className={activeTab === 'completed' ? 'active' : ''}
              onClick={() => setActiveTab('completed')}
            >
              Nhật ký đã trả kết quả ({completedRows.length})
            </button>
            <button
              type="button"
              className={activeTab === 'account' ? 'active' : ''}
              onClick={() => setActiveTab('account')}
            >
              Cài đặt tài khoản
            </button>
          </div>
        </div>

        {activeTab === 'pending' ? (
          <div className="technician-table-wrap">
            <table className="technician-table">
              <thead>
                <tr>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Tên dịch vụ</th>
                  <th>Giá gốc</th>
                  <th>BHYT giảm trừ</th>
                  <th>Giá cuối thực trả</th>
                  <th>Trạng thái thanh toán</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((row) => (
                  <tr key={row.lab.MaChiTietXN}>
                    <td>
                      <strong>{row.lab.MaLuotKham}</strong>
                      <span>{row.visit?.ChanDoanSoBo}</span>
                    </td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>{row.service.TenDichVu}</td>
                    <td>{formatMoney(row.service.GiaGoc)}</td>
                    <td>
                      {formatMoney(row.bhytAmount)}
                      <span>{Math.round(row.bhytRate * 100)}%</span>
                    </td>
                    <td>
                      <strong>{formatMoney(row.finalAmount)}</strong>
                    </td>
                    <td>
                      <span className={`technician-payment-pill ${row.lab.PaymentToken ? 'paid' : 'unpaid'}`}>
                        {row.lab.PaymentToken ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </span>
                      {row.lab.PaymentToken && <small>{row.lab.PaymentToken}</small>}
                    </td>
                    <td>
                      {row.lab.PaymentToken ? (
                        <button
                          type="button"
                          className="technician-primary-button compact"
                          disabled={labActionLoading === row.lab.MaChiTietXN}
                          onClick={() => handleOpenResultModal(row)}
                        >
                          {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Nhập kết quả'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="technician-pay-button compact"
                          disabled={labActionLoading === row.lab.MaChiTietXN}
                          onClick={() => handleOpenPayment(row)}
                        >
                          {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Quét QR Thanh toán'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {pendingRows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="technician-empty-cell">
                      Không còn chỉ định chờ thực hiện tại chi nhánh này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'completed' ? (
          <div className="technician-table-wrap">
            <table className="technician-table technician-result-table">
              <thead>
                <tr>
                  <th>Mã lượt khám</th>
                  <th>Họ tên bệnh nhân</th>
                  <th>Tên dịch vụ</th>
                  <th>Nội dung kết quả đã trả</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {completedRows.map((row) => (
                  <tr key={row.lab.MaChiTietXN}>
                    <td>
                      <strong>{row.lab.MaLuotKham}</strong>
                      <span>{row.booking?.NgayKham}</span>
                    </td>
                    <td>
                      <strong>{row.patient.HoTen}</strong>
                      <span>{row.patient.MaBenhAn}</span>
                    </td>
                    <td>{row.service.TenDichVu}</td>
                    <td className="technician-result-text">{row.lab.KetQuaXetNghiem}</td>
                    <td>
                      <button
                        type="button"
                        className="technician-secondary-button compact"
                        disabled={labActionLoading === row.lab.MaChiTietXN}
                        onClick={() => handleOpenResultModal(row)}
                      >
                        {labActionLoading === row.lab.MaChiTietXN ? 'Đang xử lý...' : 'Sửa kết quả'}
                      </button>
                    </td>
                  </tr>
                ))}
                {completedRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="technician-empty-cell">
                      Chưa có kết quả nào do tài khoản này trả trong ngày hôm nay.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="technician-account-panel">
            <section className="technician-profile-summary">
              <div>
                <span>Mã XNV</span>
                <strong>{technicianProfile.MaXNV}</strong>
              </div>
              <div>
                <span>Họ tên</span>
                <strong>{technicianProfile.HoTen}</strong>
              </div>
              <div>
                <span>Chi nhánh phụ trách</span>
                <strong>
                  {currentBranch.TenChiNhanh} ({currentBranch.MaChiNhanh})
                </strong>
              </div>
            </section>

            <div className="technician-account-actions">
              <button
                type="button"
                className="technician-primary-button"
                onClick={() => setShowPasswordForm((current) => !current)}
              >
                🔑 Đổi mật khẩu
              </button>
              {showPasswordForm && (
                <form className="technician-password-form" onSubmit={handleChangePassword}>
                  <label>
                    Mật khẩu hiện tại
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) => handlePasswordFormChange('currentPassword', event.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                    />
                  </label>
                  <label>
                    Mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => handlePasswordFormChange('newPassword', event.target.value)}
                      placeholder="Nhập mật khẩu mới"
                    />
                  </label>
                  <label>
                    Xác nhận mật khẩu mới
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => handlePasswordFormChange('confirmPassword', event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                  <div className="technician-password-actions">
                    <button type="submit" className="technician-primary-button">
                      Lưu mật khẩu mới
                    </button>
                    <button type="button" className="technician-secondary-button" onClick={handleCancelPasswordChange}>
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {paymentModal && (
        <div className="technician-modal-overlay">
          <section className="technician-payment-modal">
            <button
              type="button"
              className="technician-modal-close"
              onClick={() => setPaymentModal(null)}
              disabled={labActionLoading === paymentModal.lab.MaChiTietXN}
              aria-label="Đóng modal thanh toán"
            >
              ×
            </button>
            <span className="technician-kicker">Cổng thanh toán phòng Lab</span>
            <h2>QR thanh toán xét nghiệm</h2>
            <div className="technician-invoice-grid">
              <span>Bệnh nhân</span>
              <strong>{paymentModal.patient.HoTen}</strong>
              <span>Dịch vụ</span>
              <strong>{paymentModal.service.TenDichVu}</strong>
              <span>Giá gốc</span>
              <strong>{formatMoney(paymentModal.service.GiaGoc)}</strong>
              <span>BHYT giảm</span>
              <strong>{formatMoney(paymentModal.bhytAmount)}</strong>
              <span>Giá cuối thực trả</span>
              <strong>{formatMoney(paymentModal.finalAmount)}</strong>
            </div>
            <div className="technician-qr-box">
              <div className="technician-qr-pattern" />
              <span>QR Medicare Lab</span>
            </div>
            <button
              type="button"
              className="technician-pay-button"
              onClick={handleConfirmPayment}
              disabled={labActionLoading === paymentModal.lab.MaChiTietXN}
            >
              {labActionLoading === paymentModal.lab.MaChiTietXN ? 'Đang xác nhận...' : 'Xác nhận đã chuyển khoản'}
            </button>
          </section>
        </div>
      )}

      {resultModal && (
        <div className="technician-modal-overlay">
          <section className="technician-result-modal">
            <button
              type="button"
              className="technician-modal-close"
              onClick={handleCloseResultModal}
              disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              aria-label="Đóng form nhập kết quả"
            >
              ×
            </button>
            <span className="technician-kicker">Cập nhật kết quả</span>
            <h2>Cập nhật kết quả cận lâm sàng - Bệnh nhân {resultModal.patient.HoTen}</h2>
            <div className="technician-result-summary">
              <span>{resultModal.lab.MaLuotKham}</span>
              <strong>{resultModal.service.TenDichVu}</strong>
            </div>
            <textarea
              value={resultText}
              onChange={(event) => setResultText(event.target.value)}
              placeholder="Nhập kết quả chi tiết bằng văn bản (Ví dụ: Bạch cầu trong giới hạn bình thường, hình ảnh siêu âm gan thô...)."
              autoFocus
            />
            <div className="technician-result-actions">
              <button
                type="button"
                className="technician-primary-button"
                onClick={handleSaveResult}
                disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              >
                {labActionLoading === resultModal.lab.MaChiTietXN ? 'Đang lưu...' : 'Xác nhận & Trả kết quả'}
              </button>
              <button
                type="button"
                className="technician-secondary-button"
                onClick={handleCloseResultModal}
                disabled={labActionLoading === resultModal.lab.MaChiTietXN}
              >
                Hủy bỏ
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function PatientDashboard({
  user,
  onLogout,
  onUpdateUser,
  showNotification,
  notifications = [],
  addPatientNotifications,
  onMarkNotificationsRead,
  catalogData = EMPTY_CATALOG_DATA,
}) {
  const [activeMenu, setActiveMenu] = useState('booking')
  const [serviceSearch, setServiceSearch] = useState('')
  const [bookingMethod, setBookingMethod] = useState('time')
  const [branches] = useState([
    {
      MaChiNhanh: 'CN_CG',
      TenChiNhanh: 'Medicare - Cơ sở Cầu Giấy',
      DiaChi: 'Số 1 Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
    },
    {
      MaChiNhanh: 'CN_HBT',
      TenChiNhanh: 'Medicare - Cơ sở Hai Bà Trưng',
      DiaChi: 'Số 99 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
    },
  ])
  const [services] = useState([
    { MaDichVu: 'DV_KHAM_NOI', TenDichVu: 'Khám Nội Tổng Quát', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_GIA_DINH', TenDichVu: 'Khám Sức Khỏe Gia Đình', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_LAO_KHOA', TenDichVu: 'Khám Tư Vấn Sức Khỏe Lão Khoa', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_TIM_MACH', TenDichVu: 'Khám Sàng Lọc Tim Mạch - Huyết Áp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_KHAM_TIEU_HOA', TenDichVu: 'Khám Tiêu Hóa - Gan Mật', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_KHAM_HO_HAP', TenDichVu: 'Khám Bệnh Lý Đường Hô Hấp', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 170000 },
    { MaDichVu: 'DV_KHAM_NOI_TIET', TenDichVu: 'Khám Sàng Lọc Tiểu Đường & Nội Tiết', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 220000 },
    { MaDichVu: 'DV_KHAM_DINH_DUONG', TenDichVu: 'Khám Tư Vấn Dinh Dưỡng Chuyên Sâu', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DT_TRUYEN_DICH', TenDichVu: 'Liệu trình truyền dịch giải độc, bù nước', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 250000 },
    { MaDichVu: 'DT_TIEM_KHANG_SINH', TenDichVu: 'Dịch vụ tiêm thuốc/kháng sinh theo chỉ định', ChuyenKhoa: 'Nội tổng quát', LoaiDichVu: 'Điều trị', GiaGoc: 80000 },
    { MaDichVu: 'DV_KHAM_RANG', TenDichVu: 'Khám Răng Hàm Mặt Định Kỳ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DV_LAY_CAO', TenDichVu: 'Lấy Cao Răng Và Đánh Bóng Thẩm Mỹ', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 150000 },
    { MaDichVu: 'DV_KHAM_NIENG_RANG', TenDichVu: 'Khám Tư Vấn Chỉnh Nha/Niềng Răng', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DV_KHAM_IMPLANT', TenDichVu: 'Khám Tư Vấn Trồng Răng Implant', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 300000 },
    { MaDichVu: 'DT_HAN_RANG', TenDichVu: 'Hàn Răng Composite Thẩm Mỹ (1 Răng)', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 300000 },
    { MaDichVu: 'DT_RANG_TUY', TenDichVu: 'Liệu Trình Điều Trị Tủy Răng Toàn Diện', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1200000 },
    { MaDichVu: 'DT_NHO_RANG_KHON', TenDichVu: 'Phẫu Thuật Nhổ Răng Khôn Mọc Lệch', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 1000000 },
    { MaDichVu: 'DT_TAY_TRANG', TenDichVu: 'Tẩy Trắng Răng Công Nghệ Laser', ChuyenKhoa: 'Răng hàm mặt', LoaiDichVu: 'Điều trị', GiaGoc: 2000000 },
    { MaDichVu: 'DV_KHAM_TMH', TenDichVu: 'Khám Tai Mũi Họng Thông Thường', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 180000 },
    { MaDichVu: 'DV_NOI_SOI_TMH', TenDichVu: 'Nội Soi Tai Mũi Họng Ống Mềm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 250000 },
    { MaDichVu: 'DV_KHAM_THINH_LUC', TenDichVu: 'Khám Đo Thính Lực Đơn Âm', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Khám lâm sàng', GiaGoc: 200000 },
    { MaDichVu: 'DT_KHIDUNG', TenDichVu: 'Liệu Trình Khí Dung Mũi Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 450000 },
    { MaDichVu: 'DT_VIEM_AMIDAN', TenDichVu: 'Liệu Trình Điều Trị Viêm Amidan Hạt', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 600000 },
    { MaDichVu: 'DT_RUA_XOANG', TenDichVu: 'Hút Mủ Và Chọc Rửa Xoang Điều Trị', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 350000 },
    { MaDichVu: 'DT_LAY_DI_VAT', TenDichVu: 'Thủ Thuật Lấy Dị Vật Vùng Tai/Mũi/Họng', ChuyenKhoa: 'Tai mũi họng', LoaiDichVu: 'Điều trị', GiaGoc: 400000 },
    { MaDichVu: 'XN_MAU', TenDichVu: 'Xét Nghiệm Công Thức Máu 24 Chỉ Số', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 250000 },
    { MaDichVu: 'SA_O_BUNG', TenDichVu: 'Siêu Âm Ổ Bụng Tổng Quát', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 300000 },
    { MaDichVu: 'XN_NUOC_TIEU', TenDichVu: 'Xét Nghiệm Nước Tiểu Toàn Bộ (10 Thông Số)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 120000 },
    { MaDichVu: 'XN_SINH_HOA', TenDichVu: 'Xét Nghiệm Sinh Hóa Máu (Gan, Thận, Mỡ Máu)', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 350000 },
    { MaDichVu: 'XN_DUONG_HUYET', TenDichVu: 'Xét Nghiệm Đường Huyết Nhanh', ChuyenKhoa: 'Xét nghiệm', LoaiDichVu: 'Xét nghiệm', GiaGoc: 80000 },
  ])
  const [branchServices] = useState(() =>
    ['CN_CG', 'CN_HBT'].flatMap((maChiNhanh) =>
      services.map((service) => ({
        MaCauHinh: `${maChiNhanh === 'CN_CG' ? 'CH_CG' : 'CH_HBT'}_${service.MaDichVu}`,
        MaChiNhanh: maChiNhanh,
        MaDichVu: service.MaDichVu,
        SlotGioiHan: 15,
      })),
    ),
  )
  const [staffList] = useState([
    { MaBacSi: 'BS001', HoTen: 'Nguyễn Văn An', ChuyenKhoa: 'Nội tổng quát', SDT: '0911222333' },
    { MaBacSi: 'BS002', HoTen: 'Lê Thị Bình', ChuyenKhoa: 'Răng hàm mặt', SDT: '0922333444' },
    { MaBacSi: 'BS003', HoTen: 'Phạm Hoàng Long', ChuyenKhoa: 'Tai mũi họng', SDT: '0933444555' },
    { MaBacSi: 'BS004', HoTen: 'Trần Trần Đức', ChuyenKhoa: 'Nội tổng quát', SDT: '0944555666' },
    { MaBacSi: 'BS005', HoTen: 'Nguyễn Thị Minh', ChuyenKhoa: 'Nội tổng quát', SDT: '0912345678' },
    { MaBacSi: 'BS006', HoTen: 'Phan Văn Khải', ChuyenKhoa: 'Răng hàm mặt', SDT: '0923456789' },
    { MaBacSi: 'BS007', HoTen: 'Hoàng Lê Giang', ChuyenKhoa: 'Tai mũi họng', SDT: '0934567890' },
    { MaBacSi: 'BS008', HoTen: 'Vũ Ngô Hùng', ChuyenKhoa: 'Răng hàm mặt', SDT: '0945678901' },
    { MaBacSi: 'BS009', HoTen: 'Đỗ Thúy Hạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0913456789' },
    { MaBacSi: 'BS010', HoTen: 'Bùi Chí Kiên', ChuyenKhoa: 'Răng hàm mặt', SDT: '0924567890' },
    { MaBacSi: 'BS011', HoTen: 'Lý Thu Thảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0935678901' },
    { MaBacSi: 'BS012', HoTen: 'Đặng Quốc Bảo', ChuyenKhoa: 'Tai mũi họng', SDT: '0946789012' },
    { MaBacSi: 'BS013', HoTen: 'Ngô Bảo Ngọc', ChuyenKhoa: 'Nội tổng quát', SDT: '0914567890' },
    { MaBacSi: 'BS014', HoTen: 'Dương Văn Lâm', ChuyenKhoa: 'Răng hàm mặt', SDT: '0925678901' },
    { MaBacSi: 'BS015', HoTen: 'Võ Thị Sáu', ChuyenKhoa: 'Tai mũi họng', SDT: '0936789012' },
    { MaBacSi: 'BS016', HoTen: 'Tống Phước Hải', ChuyenKhoa: 'Nội tổng quát', SDT: '0947890123' },
    { MaBacSi: 'BS017', HoTen: 'Đinh Công Mạnh', ChuyenKhoa: 'Nội tổng quát', SDT: '0915678901' },
    { MaBacSi: 'BS018', HoTen: 'Mai Phương Thảo', ChuyenKhoa: 'Răng hàm mặt', SDT: '0926789012' },
    { MaBacSi: 'BS019', HoTen: 'Hồ Tiến Dũng', ChuyenKhoa: 'Tai mũi họng', SDT: '0937890123' },
    { MaBacSi: 'BS020', HoTen: 'Trịnh Đình Quang', ChuyenKhoa: 'Răng hàm mặt', SDT: '0948901234' },
    { MaBacSi: 'BS021', HoTen: 'Vương Kim Chi', ChuyenKhoa: 'Nội tổng quát', SDT: '0916789012' },
    { MaBacSi: 'BS022', HoTen: 'Đoàn Nguyên Đức', ChuyenKhoa: 'Răng hàm mặt', SDT: '0927890123' },
    { MaBacSi: 'BS023', HoTen: 'Lưu Hồng Quang', ChuyenKhoa: 'Tai mũi họng', SDT: '0938901234' },
  ])
  const generateMockSchedules = () => {
    const cauGiayDoctors = staffList.slice(0, 12)
    const haiBaTrungDoctors = staffList.slice(12)
    const generatedSchedules = []
    let runningIndex = 1

    for (let time = Date.UTC(2026, 5, 1), dayIndex = 0; time <= Date.UTC(2026, 6, 1); time += 86400000, dayIndex += 1) {
      const ngayTruc = new Date(time).toISOString().slice(0, 10)

      for (let ca = 1; ca <= 4; ca += 1) {
        const doctor = cauGiayDoctors[(dayIndex * 4 + ca - 1) % cauGiayDoctors.length]
        generatedSchedules.push({
          MaLichTruc: `LT_${String(runningIndex).padStart(3, '0')}`,
          MaBacSi: doctor.MaBacSi,
          MaChiNhanh: 'CN_CG',
          NgayTruc: ngayTruc,
          CaTruc: ca,
          TrangThai: 'Đang hoạt động',
        })
        runningIndex += 1
      }

      for (let ca = 1; ca <= 4; ca += 1) {
        const doctor = haiBaTrungDoctors[(dayIndex * 4 + ca - 1) % haiBaTrungDoctors.length]
        generatedSchedules.push({
          MaLichTruc: `LT_${String(runningIndex).padStart(3, '0')}`,
          MaBacSi: doctor.MaBacSi,
          MaChiNhanh: 'CN_HBT',
          NgayTruc: ngayTruc,
          CaTruc: ca,
          TrangThai: 'Đang hoạt động',
        })
        runningIndex += 1
      }
    }

    return generatedSchedules
  }
  const [doctorSchedules] = useState(generateMockSchedules())
	  const initialPatientProfile = {
	    MaBenhAn: user?.MaBenhAn || 'BN001',
	    HoTen: user?.HoTen || user?.name || 'Trần Quang Hải',
	    NgaySinh: user?.NgaySinh || '1995-04-12',
	    GioiTinh: user?.GioiTinh || 'Nam',
	    SDT: user?.SDT || '0901234567',
	    DiaChi: user?.DiaChi || 'Cầu Giấy, Hà Nội',
	    CCCD: user?.CCCD || user?.id || '001095012345',
	    MaSoBHYT: user?.MaSoBHYT || 'DN4010123456789',
	    KyTuDauBHYT: user?.KyTuDauBHYT || 'DN',
	    MatKhau: user?.MatKhau || '123456',
	  }
	  const [patient, setPatient] = useState(initialPatientProfile)
	  const [, setPatientDirectory] = useState([initialPatientProfile])
  const patientNotifications = notifications.filter(
    (notification) =>
      notification.MaBenhAn === patient.MaBenhAn ||
      notification.MaBenhNhan === patient.MaBenhAn,
  )
	  const [bookings, setBookings] = useState([
    {
      MaLichHen: 'LH_001',
      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-06-01',
      CaKham: 1,
      MaBacSi: 'BS001',
      PaymentToken: 'PAY_MOCK_100001',
      TrangThai: 'Hoàn thành',
    },
	    {
	      MaLichHen: 'LH_003',
	      MaBenhAn: 'BN001',
      MaCauHinh: 'CH_CG_DV_KHAM_NOI',
      MaDichVu: 'DV_KHAM_NOI',
      MaChiNhanh: 'CN_CG',
      NgayKham: '2026-06-01',
      CaKham: 4,
      MaBacSi: 'BS004',
      PaymentToken: 'PAY_MOCK_100002',
	      TrangThai: 'Chờ khám',
	    },
	    {
	      MaLichHen: 'LH_004',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_CG_DV_KHAM_TIEU_HOA',
	      MaDichVu: 'DV_KHAM_TIEU_HOA',
	      MaChiNhanh: 'CN_CG',
	      NgayKham: '2026-05-18',
	      CaKham: 2,
	      MaBacSi: 'BS005',
	      PaymentToken: 'PAY_MOCK_100004',
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichHen: 'LH_005',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_HBT_DV_KHAM_TMH',
	      MaDichVu: 'DV_KHAM_TMH',
	      MaChiNhanh: 'CN_HBT',
	      NgayKham: '2026-04-22',
	      CaKham: 1,
	      MaBacSi: 'BS015',
	      PaymentToken: 'PAY_MOCK_100005',
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichHen: 'LH_006',
	      MaBenhAn: 'BN001',
	      MaCauHinh: 'CH_CG_DV_KHAM_RANG',
	      MaDichVu: 'DV_KHAM_RANG',
	      MaChiNhanh: 'CN_CG',
	      NgayKham: '2026-03-30',
	      CaKham: 3,
	      MaBacSi: 'BS006',
	      PaymentToken: 'PAY_MOCK_100006',
	      TrangThai: 'Hoàn thành',
	    },
	  ])
	  const [diseases] = useState([
		    { MaBenh: 'K29', TenBenh: 'Viêm dạ dày và tá tràng' },
		    { MaBenh: 'J30', TenBenh: 'Viêm mũi dị ứng' },
		    { MaBenh: 'K02', TenBenh: 'Sâu răng' },
		    { MaBenh: 'K21', TenBenh: 'Trào ngược dạ dày thực quản' },
		    { MaBenh: 'J01', TenBenh: 'Viêm xoang cấp' },
		    { MaBenh: 'K05', TenBenh: 'Viêm nướu và bệnh nha chu' },
		  ])
	  const [visitRecords, setVisitRecords] = useState([
	    {
	      MaLuotKham: 'LK_001',
	      MaLichHen: 'LH_001',
	      TrieuChung: 'Đau rát vùng thượng vị theo chu kỳ, đầy hơi sau ăn, buồn nôn nhẹ vào buổi sáng.',
		      LoiDan: 'Ăn uống đúng giờ, kiêng đồ chua cay, hạn chế cà phê, tái khám sau 14 ngày nếu còn đau.',
		      MaBenh: 'K29',
		    },
		    {
		      MaLuotKham: 'LK_002',
		      MaLichHen: 'LH_004',
		      TrieuChung: 'Ợ nóng sau ăn, đau âm ỉ vùng thượng vị, cảm giác nghẹn nhẹ khi nằm sau bữa tối.',
		      LoiDan: 'Không nằm ngay sau ăn, chia nhỏ bữa, theo dõi triệu chứng ợ nóng và tái khám sau 3 tuần.',
		      MaBenh: 'K21',
		    },
		    {
		      MaLuotKham: 'LK_003',
		      MaLichHen: 'LH_005',
		      TrieuChung: 'Nghẹt mũi kéo dài, đau vùng trán, chảy dịch mũi vàng xanh, giảm ngửi.',
		      LoiDan: 'Rửa mũi bằng nước muối sinh lý, tránh khói bụi, quay lại nếu sốt hoặc đau tăng.',
		      MaBenh: 'J01',
		    },
		    {
		      MaLuotKham: 'LK_004',
		      MaLichHen: 'LH_006',
		      TrieuChung: 'Chảy máu chân răng khi đánh răng, ê buốt răng hàm dưới, mảng bám nhiều.',
		      LoiDan: 'Vệ sinh răng miệng đúng cách, dùng chỉ nha khoa, tái khám nha chu sau 1 tháng.',
		      MaBenh: 'K05',
		    },
		  ])
	  const [medicines] = useState([
		    { MaThuoc: 'TH001', TenThuoc: 'Omeprazole 20mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH002', TenThuoc: 'Phosphalugel', DonViTinh: 'Gói' },
		    { MaThuoc: 'TH003', TenThuoc: 'Domperidone 10mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH004', TenThuoc: 'Esomeprazole 40mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH005', TenThuoc: 'Loratadine 10mg', DonViTinh: 'Viên' },
		    { MaThuoc: 'TH006', TenThuoc: 'Nước muối xịt mũi', DonViTinh: 'Chai' },
		    { MaThuoc: 'TH007', TenThuoc: 'Chlorhexidine súc miệng', DonViTinh: 'Chai' },
		  ])
	  const [prescriptionDetails, setPrescriptionDetails] = useState([
		    { MaDonThuoc: 'DT001', MaLuotKham: 'LK_001', MaThuoc: 'TH001', SoLuong: 14, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 14 ngày.' },
		    { MaDonThuoc: 'DT002', MaLuotKham: 'LK_001', MaThuoc: 'TH002', SoLuong: 10, LieuDung: 'Uống 1 gói khi đau hoặc nóng rát dạ dày, tối đa 3 gói/ngày.' },
		    { MaDonThuoc: 'DT003', MaLuotKham: 'LK_001', MaThuoc: 'TH003', SoLuong: 10, LieuDung: 'Uống 1 viên trước bữa ăn khi buồn nôn hoặc đầy hơi.' },
		    { MaDonThuoc: 'DT004', MaLuotKham: 'LK_002', MaThuoc: 'TH004', SoLuong: 21, LieuDung: 'Uống 1 viên trước ăn sáng 30 phút trong 21 ngày.' },
		    { MaDonThuoc: 'DT005', MaLuotKham: 'LK_002', MaThuoc: 'TH002', SoLuong: 12, LieuDung: 'Uống 1 gói khi ợ nóng hoặc đau thượng vị.' },
		    { MaDonThuoc: 'DT006', MaLuotKham: 'LK_003', MaThuoc: 'TH005', SoLuong: 10, LieuDung: 'Uống 1 viên mỗi tối trong 10 ngày.' },
		    { MaDonThuoc: 'DT007', MaLuotKham: 'LK_003', MaThuoc: 'TH006', SoLuong: 1, LieuDung: 'Xịt mỗi bên mũi 2 lần, ngày 3 lần.' },
		    { MaDonThuoc: 'DT008', MaLuotKham: 'LK_004', MaThuoc: 'TH007', SoLuong: 1, LieuDung: 'Súc miệng 15ml sau đánh răng, ngày 2 lần trong 7 ngày.' },
		  ])
	  const [labDetails, setLabDetails] = useState([
	    {
	      MaChiTietXN: 'CTXN_001',
	      MaLuotKham: 'LK_001',
	      MaDichVu: 'XN_MAU',
	      KetQuaXetNghiem: 'Bạch cầu trong giới hạn bình thường, Hemoglobin 145 g/L.',
	      MaXNV: 'XNV001',
	      GiaCuoi: 50000,
	      PaymentToken: 'PAY_MOCK_XN001',
	      TrangThaiXetNghiem: 'Đã có kết quả',
	    },
	    {
	      MaChiTietXN: 'CTXN_002',
	      MaLuotKham: 'LK_001',
	      MaDichVu: 'SA_O_BUNG',
	      KetQuaXetNghiem: '',
	      MaXNV: '',
	      GiaCuoi: 60000,
	      PaymentToken: 'PAY_MOCK_XN002',
		      TrangThaiXetNghiem: 'Chưa thực hiện',
		    },
		    {
		      MaChiTietXN: 'CTXN_003',
		      MaLuotKham: 'LK_002',
		      MaDichVu: 'XN_SINH_HOA',
		      KetQuaXetNghiem: 'Men gan AST/ALT trong giới hạn, chức năng thận bình thường.',
		      MaXNV: 'XNV002',
		      GiaCuoi: 70000,
		      PaymentToken: 'PAY_MOCK_XN003',
		      TrangThaiXetNghiem: 'Đã có kết quả',
		    },
		    {
		      MaChiTietXN: 'CTXN_004',
		      MaLuotKham: 'LK_003',
		      MaDichVu: 'XN_MAU',
		      KetQuaXetNghiem: 'Bạch cầu tăng nhẹ, gợi ý tình trạng viêm cấp.',
		      MaXNV: 'XNV001',
		      GiaCuoi: 50000,
		      PaymentToken: 'PAY_MOCK_XN004',
		      TrangThaiXetNghiem: 'Đã có kết quả',
		    },
		    {
		      MaChiTietXN: 'CTXN_005',
		      MaLuotKham: 'LK_004',
		      MaDichVu: 'XN_DUONG_HUYET',
		      KetQuaXetNghiem: '',
		      MaXNV: '',
		      GiaCuoi: 16000,
		      PaymentToken: 'PAY_MOCK_XN005',
		      TrangThaiXetNghiem: 'Chưa thực hiện',
		    },
		  ])
	  const [labTechnicians] = useState([
	    { MaXNV: 'XNV001', HoTen: 'Trần Văn Cường' },
	    { MaXNV: 'XNV002', HoTen: 'Vũ Hồng Ngọc' },
	  ])
	  const [treatmentSchedules, setTreatmentSchedules] = useState([
    {
      MaLichTrinh: 'LTDT_001',
      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 1,
      NgayThucHien: '2026-06-02',
      CaKham: 3,
      TrangThai: 'Hoàn thành',
    },
    {
      MaLichTrinh: 'LTDT_002',
      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 2,
      NgayThucHien: '',
      CaKham: '',
      TrangThai: 'Chưa đặt lịch',
    },
	    {
	      MaLichTrinh: 'LTDT_003',
	      MaLuotKham: 'LK_001',
      MaDichVu: 'DT_RANG_TUY',
      BuoiSo: 3,
      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_004',
	      MaLuotKham: 'LK_002',
	      MaDichVu: 'DT_TRUYEN_DICH',
	      BuoiSo: 1,
	      NgayThucHien: '2026-05-20',
	      CaKham: 2,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_005',
	      MaLuotKham: 'LK_002',
	      MaDichVu: 'DT_TRUYEN_DICH',
	      BuoiSo: 2,
	      NgayThucHien: '2026-05-23',
	      CaKham: 1,
	      TrangThai: 'Đã đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_006',
	      MaLuotKham: 'LK_003',
	      MaDichVu: 'DT_KHIDUNG',
	      BuoiSo: 1,
	      NgayThucHien: '2026-04-24',
	      CaKham: 3,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_007',
	      MaLuotKham: 'LK_003',
	      MaDichVu: 'DT_KHIDUNG',
	      BuoiSo: 2,
	      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	    {
	      MaLichTrinh: 'LTDT_008',
	      MaLuotKham: 'LK_004',
	      MaDichVu: 'DT_HAN_RANG',
	      BuoiSo: 1,
	      NgayThucHien: '2026-04-01',
	      CaKham: 4,
	      TrangThai: 'Hoàn thành',
	    },
	    {
	      MaLichTrinh: 'LTDT_009',
	      MaLuotKham: 'LK_004',
	      MaDichVu: 'DT_HAN_RANG',
	      BuoiSo: 2,
	      NgayThucHien: '',
	      CaKham: '',
	      TrangThai: 'Chưa đặt lịch',
	    },
	  ])
  const [bookingForm, setBookingForm] = useState({
    MaChiNhanh: 'CN_CG',
    MaDichVu: 'DV_KHAM_NOI',
    NgayKham: '2026-06-05',
    CaKham: '1',
    MaBacSi: 'BS001',
  })
	  const [treatmentDrafts, setTreatmentDrafts] = useState({})
	  const [activeTreatmentId, setActiveTreatmentId] = useState('')
	  const [selectedVisitId, setSelectedVisitId] = useState('LK_001')
	  const [paymentModal, setPaymentModal] = useState(null)
	  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
	  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
	  const [appointmentsError, setAppointmentsError] = useState('')
	  const [medicalHistoryLoading, setMedicalHistoryLoading] = useState(false)
	  const [medicalHistoryError, setMedicalHistoryError] = useState('')
	  const [appointmentSearch, setAppointmentSearch] = useState('')
	  const [isEditingContact, setIsEditingContact] = useState(false)
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

  const bhytCategories = [
    { KyTuDauBHYT: 'TE', DoiTuongChinhSach: 'Trẻ em dưới 6 tuổi', TyLeHuong: 1 },
    { KyTuDauBHYT: 'HT', DoiTuongChinhSach: 'Cán bộ Hưu trí', TyLeHuong: 0.95 },
    { KyTuDauBHYT: 'DN', DoiTuongChinhSach: 'Người lao động doanh nghiệp', TyLeHuong: 0.8 },
  ]

  const effectiveBranches = catalogData?.branches?.length ? catalogData.branches : branches
  const effectiveServices = catalogData?.services?.length ? catalogData.services : services
  const effectiveDiseases = catalogData?.diseases?.length ? catalogData.diseases : diseases
  const effectiveMedicines = catalogData?.medicines?.length ? catalogData.medicines : medicines
  const effectiveBhytCategories = catalogData?.bhyt?.length ? catalogData.bhyt : bhytCategories
  const normalizedCatalogSchedules = (catalogData?.doctorSchedules || []).map((schedule) => ({
    ...schedule,
    TrangThai: schedule.TrangThai || 'Đang hoạt động',
  }))
  const effectiveDoctorSchedules = normalizedCatalogSchedules.length ? normalizedCatalogSchedules : doctorSchedules
  const allKnownServices = effectiveServices.concat(
    services.filter((mockService) => !effectiveServices.some((service) => service.MaDichVu === mockService.MaDichVu)),
  )
  const allKnownBranches = effectiveBranches.concat(
    branches.filter((mockBranch) => !effectiveBranches.some((branch) => branch.MaChiNhanh === mockBranch.MaChiNhanh)),
  )
  const catalogDoctors = (catalogData?.doctors || [])
    .filter((doctor) => (doctor.TrangThai || 'Đang hoạt động') === 'Đang hoạt động')
    .map((doctor) => ({
      MaBacSi: doctor.MaBacSi,
      HoTen: doctor.HoTen || doctor.MaBacSi,
      ChuyenKhoa: doctor.ChuyenKhoa || '',
      SDT: doctor.SDT || '',
      TrangThai: doctor.TrangThai || 'Đang hoạt động',
    }))
  const scheduleDerivedDoctors = Object.values(
    effectiveDoctorSchedules.reduce((doctorMap, schedule) => {
      if (!schedule.MaBacSi || doctorMap[schedule.MaBacSi]) return doctorMap
      const mockDoctor = staffList.find((doctor) => doctor.MaBacSi === schedule.MaBacSi)
      const catalogDoctor = catalogDoctors.find((doctor) => doctor.MaBacSi === schedule.MaBacSi)

      doctorMap[schedule.MaBacSi] = {
        MaBacSi: schedule.MaBacSi,
        HoTen: catalogDoctor?.HoTen || schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
        ChuyenKhoa: catalogDoctor?.ChuyenKhoa || schedule.ChuyenKhoa || mockDoctor?.ChuyenKhoa || '',
        SDT: catalogDoctor?.SDT || schedule.SDT || mockDoctor?.SDT || '',
      }
      return doctorMap
    }, {}),
  )
  const dbDoctorSource = catalogDoctors.length ? catalogDoctors : scheduleDerivedDoctors
  const effectiveStaffList = dbDoctorSource.length
    ? dbDoctorSource.concat(
        staffList.filter((mockDoctor) => !dbDoctorSource.some((doctor) => doctor.MaBacSi === mockDoctor.MaBacSi)),
      )
    : staffList
  const effectiveBranchServices = catalogData?.branchServices?.length
    ? catalogData.branchServices.map((config) => ({
        MaCauHinh: config.MaCauHinh,
        MaChiNhanh: config.MaChiNhanh,
        MaDichVu: config.MaDichVu,
        SlotGioiHan: Number(config.SlotGioiHan || 15),
        TrangThai: config.TrangThai || 'Đang cung cấp',
        TenChiNhanh: config.TenChiNhanh || '',
        TenDichVu: config.TenDichVu || '',
        ChuyenKhoa: config.ChuyenKhoa || '',
        LoaiDichVu: config.LoaiDichVu || '',
        GiaGoc: Number(config.GiaGoc || 0),
      }))
    : branchServices
  const allKnownBranchServices = effectiveBranchServices.concat(
    branchServices.filter(
      (mockConfig) => !effectiveBranchServices.some((config) => config.MaCauHinh === mockConfig.MaCauHinh),
    ),
  )
  const allKnownDoctorSchedules = effectiveDoctorSchedules.concat(
    doctorSchedules.filter(
      (mockSchedule) =>
        !effectiveDoctorSchedules.some(
          (schedule) =>
            schedule.MaBacSi === mockSchedule.MaBacSi &&
            schedule.MaChiNhanh === mockSchedule.MaChiNhanh &&
            schedule.NgayTruc === mockSchedule.NgayTruc &&
            Number(schedule.CaTruc) === Number(mockSchedule.CaTruc),
        ),
    ),
  )

  const isBranchServiceAvailable = (config) =>
    !config?.TrangThai || config.TrangThai === 'active' || config.TrangThai === 'Đang cung cấp'

  const normalizeAppointmentRow = (appointment) => ({
    MaLichHen: appointment.MaLichHen,
    MaBenhAn: appointment.MaBenhAn || patient.MaBenhAn,
    MaCauHinh: appointment.MaCauHinh || '',
    MaDichVu: appointment.MaDichVu || '',
    TenDichVu: appointment.TenDichVu || '',
    MaChiNhanh: appointment.MaChiNhanh || '',
    TenChiNhanh: appointment.TenChiNhanh || '',
    NgayKham: appointment.NgayKham || '',
    CaKham: appointment.CaKham || '',
    STT: appointment.STT || appointment.STT_HangDoi || '',
    MaBacSi: appointment.MaBacSi || '',
    TenBacSi: appointment.TenBacSi || '',
    PaymentToken: appointment.PaymentToken || '',
    GiaCuoi: appointment.GiaCuoi || 0,
    TrangThai: appointment.TrangThai || 'Chờ khám',
  })

  const loadPatientAppointments = async () => {
    if (!patient.MaBenhAn) return

    setAppointmentsLoading(true)
    setAppointmentsError('')

    try {
      const response = await fetch(`${BACKEND_URL}/patient/appointments?ma_benh_an=${encodeURIComponent(patient.MaBenhAn)}`)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải lịch hẹn của bệnh nhân.')
      }

      if (Array.isArray(result.data)) {
        setBookings(result.data.map(normalizeAppointmentRow))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải lịch hẹn của bệnh nhân.'
      setAppointmentsError(message)
      console.warn('PATIENT_APPOINTMENTS_LOAD_FAILED', message)
    } finally {
      setAppointmentsLoading(false)
    }
  }

  const loadPatientNotifications = async () => {
    if (!patient.MaBenhAn) return

    try {
      const response = await fetch(`${BACKEND_URL}/patient/notifications?ma_benh_an=${encodeURIComponent(patient.MaBenhAn)}`)
      const result = await response.json()

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Không thể tải thông báo bệnh nhân.')
      }

      addPatientNotifications?.(
        (result.data || []).map((item) => ({
          MaThongBao: item.MaThongBao,
          MaBenhAn: patient.MaBenhAn,
          MaLichHen: item.MaLichHen,
          NoiDung: item.NoiDung,
          ThoiGianGui: item.ThoiGianGui,
          read: Boolean(item.DaDoc || item.read),
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
      const response = await fetch(`${BACKEND_URL}/patient/medical-history?ma_benh_an=${encodeURIComponent(patient.MaBenhAn)}`)
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

  const patientBookingStartDate = '2026-06-05'
  const patientBookingEndDate = '2026-07-01'
  const weekDayHeaders = [
    { label: 'Thứ Hai', shortLabel: 'T2', dayIndex: 1 },
    { label: 'Thứ Ba', shortLabel: 'T3', dayIndex: 2 },
    { label: 'Thứ Tư', shortLabel: 'T4', dayIndex: 3 },
    { label: 'Thứ Năm', shortLabel: 'T5', dayIndex: 4 },
    { label: 'Thứ Sáu', shortLabel: 'T6', dayIndex: 5 },
    { label: 'Thứ Bảy', shortLabel: 'T7', dayIndex: 6 },
    { label: 'Chủ Nhật', shortLabel: 'CN', dayIndex: 0 },
  ]

  const clinicalServices = effectiveServices.filter(
    (service) =>
      service.LoaiDichVu === 'Khám lâm sàng' &&
      allKnownBranchServices.some(
        (config) => config.MaDichVu === service.MaDichVu && isBranchServiceAvailable(config),
      ),
  )
  const getAvailableBranchesForService = (maDichVu) =>
    effectiveBranches.filter((branch) =>
      allKnownBranchServices.some(
        (config) =>
          config.MaChiNhanh === branch.MaChiNhanh &&
          config.MaDichVu === maDichVu &&
          isBranchServiceAvailable(config),
      ),
    )
  const bookingAvailableBranches = getAvailableBranchesForService(bookingForm.MaDichVu)
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
    allKnownBranchServices.find(
      (config) =>
        config.MaChiNhanh === maChiNhanh &&
        config.MaDichVu === maDichVu &&
        isBranchServiceAvailable(config),
    )

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

  const getBhytRate = () =>
    effectiveBhytCategories.find((category) => category.KyTuDauBHYT === patient.KyTuDauBHYT)?.TyLeHuong || 0

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

  const toDateKey = (date) => date.toISOString().slice(0, 10)

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

  useEffect(() => {
    if (!effectiveBranches.length || !clinicalServices.length) return

    setBookingForm((current) => {
      const next = { ...current }

      if (!clinicalServices.some((service) => service.MaDichVu === next.MaDichVu)) {
        next.MaDichVu = clinicalServices[0]?.MaDichVu || ''
      }

      const availableBranchesForService = getAvailableBranchesForService(next.MaDichVu)
      if (!availableBranchesForService.some((branch) => branch.MaChiNhanh === next.MaChiNhanh)) {
        next.MaChiNhanh = availableBranchesForService[0]?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || ''
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
  }, [catalogData, bookingMethod])

  useEffect(() => {
    loadPatientAppointments()
    loadMedicalHistory()
    loadPatientNotifications()
  }, [patient.MaBenhAn])

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

	  const handleSaveContact = () => {
	    const nextPatient = {
	      ...patient,
	      SDT: contactForm.SDT.trim(),
	      DiaChi: contactForm.DiaChi.trim(),
	    }

	    setPatient(nextPatient)
	    setPatientDirectory((current) =>
	      current.map((item) => (item.MaBenhAn === nextPatient.MaBenhAn ? nextPatient : item)),
	    )
	    onUpdateUser?.({
	      SDT: nextPatient.SDT,
	      DiaChi: nextPatient.DiaChi,
	      id: nextPatient.SDT,
	    })
	    setIsEditingContact(false)
	    showNotification?.('Cập nhật thông tin liên hệ thành công!')
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

	  const handleConfirmPasswordChange = () => {
	    if (passwordForm.currentPassword !== patient.MatKhau) {
	      showNotification?.('Mật khẩu hiện tại không chính xác.', 'error')
	      return
	    }

	    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
	      showNotification?.('Mật khẩu mới và xác nhận mật khẩu không khớp.', 'error')
	      return
	    }

	    const nextPatient = {
	      ...patient,
	      MatKhau: passwordForm.newPassword,
	    }

	    setPatient(nextPatient)
	    setPatientDirectory((current) =>
	      current.map((item) => (item.MaBenhAn === nextPatient.MaBenhAn ? nextPatient : item)),
	    )
	    onUpdateUser?.({ MatKhau: passwordForm.newPassword })
	    handleCancelPasswordChange()
	    showNotification?.('Đổi mật khẩu thành công!')
	  }

	  const handleTreatmentDraftChange = (maLichTrinh, field, value) => {
    setTreatmentDrafts((current) => {
      const currentDraft = current[maLichTrinh] || {
        MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
        NgayKham: '2026-06-05',
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
          ngayKham: currentDraft?.NgayKham || '2026-06-05',
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
    const availableTreatmentBranches = getAvailableBranchesForService(treatment.MaDichVu)
    const initialDraft = {
      MaChiNhanh: availableTreatmentBranches[0]?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || '',
      NgayKham: '2026-06-05',
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

  const openBookingPayment = () => {
    if (!bookingForm.CaKham || !bookingForm.MaBacSi) {
      showNotification?.('Hiện chưa có ca trống phù hợp. Vui lòng chọn ngày hoặc chi nhánh khác.', 'error')
      return
    }

    const config = getBranchConfig(bookingForm.MaChiNhanh, bookingForm.MaDichVu)
    if (!config) {
      showNotification?.('Dịch vụ này chưa được phân phối tại chi nhánh đã chọn.', 'error')
      return
    }

    setPaymentModal({
      type: 'new-booking',
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

  const confirmMockPayment = async () => {
    if (!paymentModal) return

	    if (paymentModal.type === 'new-booking') {
	      setIsConfirmingPayment(true)
	      try {
        const response = await fetch(`${BACKEND_URL}/patient/book-and-pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ma_benh_an: patient.MaBenhAn,
            ma_cau_hinh: paymentModal.payload.MaCauHinh,
            ngay_kham: paymentModal.invoice.ngayKham,
            ca_kham: Number(paymentModal.invoice.caKham),
            ma_bac_si: paymentModal.payload.MaBacSi,
          }),
        })
        const result = await response.json()

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Không thể tạo lịch hẹn.')
        }

        if (result.data) {
          setBookings((current) => {
            const nextBooking = normalizeAppointmentRow({
              ...result.data,
              MaDichVu: result.data.MaDichVu || paymentModal.invoice.maDichVu,
              MaChiNhanh: result.data.MaChiNhanh || paymentModal.invoice.maChiNhanh,
            })
            return [nextBooking, ...current.filter((booking) => booking.MaLichHen !== nextBooking.MaLichHen)]
          })
        }

        await loadPatientAppointments()
        setPaymentModal(null)
        showNotification?.('Thanh toán thành công! Lịch hẹn của bạn đã được lưu vào hệ thống.')
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
	        const response = await fetch(`${BACKEND_URL}/patient/book-treatment`, {
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
	        })
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
	        await loadMedicalHistory()
	        setActiveTreatmentId('')
	        setPaymentModal(null)
	        showNotification?.('Thanh toán thành công! Buổi điều trị đã được xác nhận.')
	      } catch (error) {
	        const message = error instanceof Error ? error.message : 'Không thể đặt lịch điều trị.'
	        showNotification?.(message, 'error')
	      } finally {
	        setIsConfirmingPayment(false)
	      }
	      return
	    }

	    const paymentToken = `PAY_MOCK_${Math.floor(100000 + Math.random() * 900000)}`
    const newBooking = {
      MaLichHen: `LH_${String(bookings.length + 1).padStart(3, '0')}`,
      MaBenhAn: patient.MaBenhAn,
      MaCauHinh: paymentModal.payload.MaCauHinh,
      MaDichVu: paymentModal.invoice.maDichVu,
      MaChiNhanh: paymentModal.invoice.maChiNhanh,
      NgayKham: paymentModal.invoice.ngayKham,
      CaKham: paymentModal.invoice.caKham,
      MaBacSi: paymentModal.payload.MaBacSi,
      PaymentToken: paymentToken,
      TrangThai: 'Đã xác nhận',
    }

    setBookings((current) => [...current, newBooking])

    if (paymentModal.type === 'treatment-booking') {
      setTreatmentSchedules((current) =>
        current.map((item) =>
          item.MaLichTrinh === paymentModal.payload.MaLichTrinh
	            ? {
	                ...item,
	                NgayThucHien: paymentModal.invoice.ngayKham,
	                CaKham: paymentModal.invoice.caKham,
	                MaBacSi: paymentModal.payload.MaBacSi,
	                TrangThai: 'Đã đặt lịch',
	              }
            : item,
        ),
      )
      setActiveTreatmentId('')
    }

    setPaymentModal(null)
    showNotification?.('Thanh toán thành công! Lịch hẹn của bạn đã được hệ thống xác nhận.')
  }

  const renderPaymentModal = () => {
    if (!paymentModal) return null

    return (
      <div className="payment-overlay">
        <div className="payment-modal">
          <div className="payment-modal-header">
            <div>
              <span>Cổng thanh toán QR</span>
              <h2>Xác nhận thanh toán</h2>
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
            <div>
              <span>BHYT giảm</span>
              <strong>{formatMoney(paymentModal.invoice.bhytAmount)}</strong>
            </div>
            <div>
              <span>Giá cuối thực trả</span>
              <strong>{formatMoney(paymentModal.invoice.finalAmount)}</strong>
            </div>
          </div>

          <div className="qr-box">
            <div className="qr-grid" />
            <span>QR chuyển khoản giả lập</span>
          </div>

          <button
            type="button"
            className="payment-confirm-button"
            onClick={confirmMockPayment}
            disabled={isConfirmingPayment}
          >
            Bấm vào đây để giả lập đã chuyển khoản thành công
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
                      const remainingSlots = schedule
                        ? getRemainingSlots({
                            maChiNhanh: bookingForm.MaChiNhanh,
                            maDichVu: bookingForm.MaDichVu,
                            ngayKham: date.dateKey,
                            caKham: shift,
                          })
                        : 0
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
                              <em>Còn {remainingSlots} slot</em>
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
                {bookingAvailableBranches.map((branch) => (
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
                  {bookingAvailableBranches.map((branch) => (
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
          <strong>Xem trước hóa đơn</strong>
          {canStartPayment && selectedDoctor && (
            <span>
              Lịch chọn: {bookingForm.NgayKham} - {getShiftTimeLabel(bookingForm.CaKham)} - Bác sĩ{' '}
              {selectedDoctor.HoTen}
            </span>
          )}
	          <span>Giá gốc: {formatMoney(invoice.giaGoc)}</span>
	          <span>BHYT giảm: {formatMoney(invoice.bhytAmount)}</span>
	          <span>Giá cuối: {formatMoney(invoice.finalAmount)}</span>
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
          disabled={!canStartPayment}
        >
          Tiến hành thanh toán
        </button>
      </div>
    )
  }

	  const renderMyBookings = () => (
	    <div className="patient-card">
	      <h2>Lịch hẹn của tôi</h2>
	      <div className="patient-appointment-toolbar">
	        <input
	          type="search"
	          value={appointmentSearch}
	          onChange={(event) => setAppointmentSearch(event.target.value)}
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
	              <th>PaymentToken</th>
	            </tr>
	          </thead>
	          <tbody>
	            {filteredBookings.map((booking) => (
	              <tr key={booking.MaLichHen}>
	                <td>{booking.MaLichHen}</td>
	                <td>{getService(booking.MaDichVu).TenDichVu}</td>
	                <td>{getBranchName(booking.MaChiNhanh)}</td>
	                <td>{booking.MaBacSi ? getDoctorInfo(booking.MaBacSi).HoTen : 'Đang điều phối'}</td>
	                <td>{booking.NgayKham}</td>
	                <td>Ca {booking.CaKham}</td>
	                <td>{booking.TrangThai}</td>
	                <td>{booking.PaymentToken}</td>
	              </tr>
	            ))}
	            {filteredBookings.length === 0 && (
	              <tr>
	                <td colSpan="8" className="patient-empty-row">
	                  Không tìm thấy lịch hẹn phù hợp.
	                </td>
	              </tr>
	            )}
	          </tbody>
	        </table>
	      </div>
	    </div>
  )

	  const renderTreatmentBookingControl = (treatment) => {
	    const draft = treatmentDrafts[treatment.MaLichTrinh] || {
	      MaChiNhanh: effectiveBranches[0]?.MaChiNhanh || '',
	      NgayKham: '2026-06-05',
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
    const treatmentAvailableBranches = getAvailableBranchesForService(treatment.MaDichVu)

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
	          {treatmentAvailableBranches.map((branch) => (
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
            {completedVisits.map((visit) => {
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
	                <button type="button" className="patient-primary-button" onClick={handleSaveContact}>
	                  Lưu thay đổi
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
	            <input type="text" value={patient.MaSoBHYT || 'Không sử dụng'} disabled />
	          </label>
	          <label>
	            Mức hưởng BHYT
	            <input type="text" value={`${Math.round(getBhytRate() * 100)}%`} disabled />
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
	              disabled={!isEditingContact}
	              onChange={(event) => setContactForm((current) => ({ ...current, DiaChi: event.target.value }))}
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
