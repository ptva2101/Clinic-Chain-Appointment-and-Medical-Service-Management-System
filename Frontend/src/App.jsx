import { useEffect, useRef, useState } from 'react'
import { Lock, UserRound } from 'lucide-react'
import medicalLogoImage from './assets/medical-logo-cutout.png'
import medicalTeamImage from './assets/medical-team-cutout.png'
import { getTodayDateKey, getFutureDateKey } from './shared/dates.js'
import { EMPTY_CATALOG_DATA } from './shared/catalog.js'
import { InputField, GlobalToast } from './shared/Widgets.jsx'
import AdminDashboard from './dashboards/AdminDashboard.jsx'
import DoctorDashboard from './dashboards/DoctorDashboard.jsx'
import ReceptionistDashboard from './dashboards/ReceptionistDashboard.jsx'
import TechnicianDashboard from './dashboards/TechnicianDashboard.jsx'
import PatientDashboard from './dashboards/PatientDashboard.jsx'
import { catalogEndpoints, fetchCatalog } from './api/registry.js'
import { loginLegacyRole, restoreLegacySession } from './api/legacyAuth.js'
import { getCurrentAccount, loginAccount, logoutAccount, registerAccount } from './api/identity.js'
import { doctorScheduleCatalogEndpoint } from './api/scheduling.js'
import './App.css'

const MEDICARE_SESSION_KEY = 'medicare_session'

const getSessionUserId = (user, selectedRole) => {
  if (!user) return ''
  if (selectedRole === 'patient') return user.MaBenhAn || user.CCCD || user.id || ''
  if (selectedRole === 'doctor') return user.MaBacSi || user.id || ''
  if (selectedRole === 'letan') return user.MaLeTan || user.id || ''
  if (selectedRole === 'xnv') return user.MaXNV || user.id || ''
  if (selectedRole === 'admin') return user.username || user.id || 'admin'
  return user.id || ''
}

export default function App() {
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get('auth') === 'register' ? 'register' : 'login',
  )
  const [role, setRole] = useState('patient')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cccdDangKy, setCccdDangKy] = useState('')
  const [matKhauDangKy, setMatKhauDangKy] = useState('')
  const [xacNhanMatKhauDangKy, setXacNhanMatKhauDangKy] = useState('')
  const [identityTokens, setIdentityTokens] = useState(null)
  const [identityAccount, setIdentityAccount] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [sessionRestoring, setSessionRestoring] = useState(true)
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

  const markPatientNotificationsRead = (maBenhAn) => {
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
      ...catalogEndpoints(),
      doctorSchedules: doctorScheduleCatalogEndpoint(scheduleStartDate, scheduleEndDate),
    }

    try {
      const entries = await Promise.all(
        Object.entries(endpoints).map(async ([key, endpoint]) => {
          const response = await fetchCatalog(endpoint)
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
      // Patient accounts now authenticate through Identity, not legacy localStorage sessions.
      if (parsedSession.role === 'patient') {
        clearSession()
        return
      }

      const response = await restoreLegacySession({
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

    if (role === 'patient') {
      setAuthBusy(true)
      try {
        const issued = await loginAccount('patient', normalizedUsername, password)
        const account = await getCurrentAccount(issued.access_token)
        setIdentityTokens(issued)
        setIdentityAccount(account)
        setPassword('')
        showNotification('Đăng nhập Identity thành công.')
      } catch (error) {
        showNotification(error instanceof Error ? error.message : 'Không kết nối được Identity service.', 'error')
      } finally {
        setAuthBusy(false)
      }
      return
    }

    const { endpoint, payload } = getLoginRequest(role, normalizedUsername, password)

    try {
      const response = await loginLegacyRole(endpoint, {
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

    const cccd = cccdDangKy.trim()
    if (!/^[0-9]{12}$/.test(cccd)) {
      showNotification('CCCD phải gồm đúng 12 chữ số.', 'error')
      return
    }
    if (matKhauDangKy.length < 12) {
      showNotification('Mật khẩu phải có ít nhất 12 ký tự.', 'error')
      return
    }
    if (matKhauDangKy !== xacNhanMatKhauDangKy) {
      showNotification('Mật khẩu xác nhận không trùng khớp, vui lòng kiểm tra lại!', 'error')
      return
    }
    setAuthBusy(true)
    try {
      await registerAccount(cccd, matKhauDangKy)
      setUsername(cccd)
      setPassword('')
      setMatKhauDangKy('')
      setXacNhanMatKhauDangKy('')
      setRole('patient')
      setMode('login')
      window.history.replaceState({}, '', '/')
      showNotification('Đã tạo tài khoản và hồ sơ Registry. Mời bạn đăng nhập.')
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Không kết nối được Identity service.', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleIdentityLogout = async () => {
    setAuthBusy(true)
    try {
      if (identityTokens?.refresh_token) await logoutAccount(identityTokens.refresh_token)
    } catch {
      // Always clear the in-memory session if the network is unavailable.
    } finally {
      setIdentityTokens(null)
      setIdentityAccount(null)
      setAuthBusy(false)
      setMode('login')
      showNotification('Đã đăng xuất.')
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

            {!identityAccount && <div className="tab-row">
              <button
                type="button"
                className={`tab-button ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); window.history.replaceState({}, '', '/') }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={`tab-button ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); window.history.replaceState({}, '', '/') }}
              >
                Đăng ký
              </button>
            </div>}

            {identityAccount && (
              <div className="auth-identity-summary">
                <h1>Đã đăng nhập</h1>
                <p>Tài khoản bệnh nhân: <strong>{identityAccount.username}</strong></p>
                <p>Mã hồ sơ Registry: <strong>{identityAccount.subject_id}</strong></p>
                <p>Hồ sơ đã liên kết. Tính năng đặt lịch trên dashboard đang được chuyển sang các service mới.</p>
                <button className="submit-button" type="button" onClick={handleIdentityLogout} disabled={authBusy}>Đăng xuất</button>
              </div>
            )}

            {!identityAccount && mode === 'login' && (
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

                {role !== 'patient' && catalogError && <p className="auth-catalog-error">{catalogError}</p>}
                <button type="submit" className="submit-button" disabled={catalogLoading || authBusy}>
                  {authBusy ? 'Đang đăng nhập...' : catalogLoading && role !== 'patient' ? 'Đang nạp dữ liệu hệ thống...' : 'Đăng nhập'}
                </button>
              </form>
            )}

            {!identityAccount && mode === 'register' && (
              <form className="auth-form" onSubmit={handleRegister}>
                <InputField
                  label="Số Căn cước công dân"
                  placeholder="Nhập 12 số CCCD"
                  icon={UserRound}
                  value={cccdDangKy}
                  onChange={setCccdDangKy}
                />
                <InputField
                  label="Mật khẩu (ít nhất 12 ký tự)"
                  placeholder="Tạo mật khẩu"
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

                <button type="submit" className="submit-button" disabled={authBusy}>
                  {authBusy ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
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
