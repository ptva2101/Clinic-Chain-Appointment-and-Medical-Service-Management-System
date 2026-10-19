import { useEffect, useRef, useState } from 'react'
import { Lock, UserRound } from 'lucide-react'
import medicalLogoImage from './assets/medical-logo-cutout.png'
import medicalTeamImage from './assets/medical-team-cutout.png'
import { EMPTY_CATALOG_DATA } from './shared/catalog.js'
import { getFutureDateKey, getTodayDateKey } from './shared/dates.js'
import { InputField, GlobalToast } from './shared/Widgets.jsx'
import PatientProfileForm from './shared/PatientProfileForm.jsx'
import AdminDashboard from './dashboards/AdminDashboard.jsx'
import DoctorDashboard from './dashboards/DoctorDashboard.jsx'
import ReceptionistDashboard from './dashboards/ReceptionistDashboard.jsx'
import TechnicianDashboard from './dashboards/TechnicianDashboard.jsx'
import PatientDashboard from './dashboards/PatientDashboard.jsx'
import { catalogEndpoints, fetchCatalog } from './api/registry.js'
import { changeAccountPassword, getCurrentAccount, loginAccount, logoutAccount, refreshAccount, registerAccount } from './api/identity.js'
import { getStaffProfile } from './api/staffProfile.js'
import { listDoctorSchedules } from './api/scheduling.js'
import { markPatientNotificationsRead as persistPatientNotificationsRead } from './api/appointment.js'
import './App.css'

const STAFF_ROLES = new Set(['doctor', 'letan', 'xnv'])

const toDashboardUser = (account, profile = null) => {
  const profileId = account.subject_id || account.username
  return {
    id: profileId,
    name: profile?.full_name || account.username,
    HoTen: profile?.full_name || account.username,
    loginRole: account.role,
    username: account.username,
    SDT: profile?.phone || '',
    ChuyenKhoa: profile?.specialty || '',
    MaChiNhanh: profile?.branch_code || '',
    ...(account.role === 'doctor' ? { MaBacSi: profileId } : {}),
    ...(account.role === 'letan' ? { MaLeTan: profileId } : {}),
    ...(account.role === 'xnv' ? { MaXNV: profileId } : {}),
  }
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
    if (!identityTokens?.access_token) return
    try {
      const response = await persistPatientNotificationsRead(identityTokens.access_token)
      if (!response.ok) throw new Error('Không thể đánh dấu thông báo đã đọc.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể đánh dấu thông báo đã đọc.'
      console.warn('PATIENT_NOTIFICATIONS_MARK_READ_FAILED', message)
      showNotification(message, 'error')
      return
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
    setCatalogData(EMPTY_CATALOG_DATA)
    const endpoints = catalogEndpoints()

    try {
      const [entries, doctorSchedules] = await Promise.all([
        Promise.all(
          Object.entries(endpoints).map(async ([key, endpoint]) => {
            const response = await fetchCatalog(endpoint)
            const result = await response.json()

            if (!response.ok || !Array.isArray(result)) {
              throw new Error(`Không thể tải ${key} từ Registry`)
            }

            return [key, result]
          }),
        ),
        listDoctorSchedules(new URLSearchParams({
          from_date: getTodayDateKey(),
          to_date: getFutureDateKey(30),
        }).toString()),
      ])

      const nextCatalog = entries.reduce(
        (accumulator, [key, result]) => ({
          ...accumulator,
          [key]: result,
        }),
        { ...EMPTY_CATALOG_DATA, doctorSchedules, meta: {} },
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

  useEffect(() => {
    // Old staff sessions contained only a role and ID, not an Identity credential.
    window.localStorage.removeItem('medicare_session')
  }, [])

  useEffect(() => {
    if (!identityTokens?.refresh_token) return undefined
    let active = true
    const delay = Math.max(1000, (identityTokens.expires_in - 60) * 1000)
    const timer = window.setTimeout(async () => {
      try {
        const issued = await refreshAccount(identityTokens.refresh_token)
        if (active) setIdentityTokens(issued)
      } catch {
        if (active) {
          setIdentityTokens(null)
          setIdentityAccount(null)
          setCurrentUser(null)
          setMode('login')
          showNotification('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error')
        }
      }
    }, delay)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [identityTokens])

  const handleLogin = async (event) => {
    event.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      showNotification('Vui lòng nhập đầy đủ tài khoản và mật khẩu.', 'error')
      return
    }

    setAuthBusy(true)
    let issued = null
    try {
      issued = await loginAccount(role, normalizedUsername, password)
      const account = await getCurrentAccount(issued.access_token)
      if (account.role !== role) {
        await logoutAccount(issued.refresh_token)
        throw new Error('Vai trò tài khoản không khớp.')
      }
      const staffProfile = STAFF_ROLES.has(role) ? await getStaffProfile(issued.access_token) : null
      setIdentityTokens(issued)
      setIdentityAccount(account)
      setPassword('')
      if (role !== 'patient') {
        setCurrentUser(toDashboardUser(account, staffProfile))
        setMode(role)
        loadCatalogData().catch((error) => {
          showNotification(error instanceof Error ? error.message : 'Không thể tải danh mục Registry.', 'error')
        })
      }
      showNotification('Đăng nhập thành công.')
    } catch (error) {
      if (issued?.refresh_token) await logoutAccount(issued.refresh_token).catch(() => {})
      showNotification(error instanceof Error ? error.message : 'Không kết nối được dịch vụ đăng nhập.', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()

    const cccd = cccdDangKy.trim()
    if (!/^[0-9]{12}$/.test(cccd)) {
      showNotification('CCCD phải gồm đúng 12 chữ số.', 'error')
      return
    }
    if (matKhauDangKy.length < 6) {
      showNotification('Mật khẩu phải có ít nhất 6 ký tự.', 'error')
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
      showNotification(error instanceof Error ? error.message : 'Không kết nối được dịch vụ đăng nhập.', 'error')
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
      setCurrentUser(null)
      setAuthBusy(false)
      setMode('login')
      setRole('patient')
      showNotification('Đã đăng xuất.')
    }
  }

  const handleChangeIdentityPassword = async (oldPassword, newPassword) => {
    if (!identityTokens?.access_token) throw new Error('Phiên đăng nhập đã kết thúc.')
    await changeAccountPassword(identityTokens.access_token, oldPassword, newPassword)
    setIdentityTokens(null)
    setIdentityAccount(null)
    setCurrentUser(null)
    setMode('login')
    setPassword('')
    showNotification('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')
  }

	  const handleUpdateCurrentUser = (updatedFields) => {
	    setCurrentUser((current) => {
      if (!current) return current
      return { ...current, ...updatedFields }
    })
	  }

	  if (mode === 'admin') {
	    return renderWithToast(
	      <AdminDashboard
	        user={currentUser}
	        onLogout={handleIdentityLogout}
	        identityAccountId={identityAccount?.id}
	        identityAccessToken={identityTokens?.access_token}
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
	        onLogout={handleIdentityLogout}
	        onChangePassword={handleChangeIdentityPassword}
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
	        onLogout={handleIdentityLogout}
	        showNotification={showNotification}
	        catalogData={catalogData}
	      />,
	    )
	  }
	  if (mode === 'xnv') {
	    return renderWithToast(
	      <TechnicianDashboard
	        user={currentUser}
	        onLogout={handleIdentityLogout}
	        onChangePassword={handleChangeIdentityPassword}
	        showNotification={showNotification}
	        catalogData={catalogData}
	      />,
	    )
	  }
	  if (mode === 'patient') {
	    return renderWithToast(
	      <PatientDashboard
	        user={currentUser}
	        onLogout={handleIdentityLogout}
	        onChangePassword={handleChangeIdentityPassword}
	        onUpdateUser={handleUpdateCurrentUser}
	        showNotification={showNotification}
	        notifications={notifications}
	        addPatientNotifications={addPatientNotifications}
	        onMarkNotificationsRead={markPatientNotificationsRead}
	        identityAccessToken={identityTokens?.access_token}
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
                <PatientProfileForm accessToken={identityTokens?.access_token} showNotification={showNotification} />
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
                  label="Mật khẩu (ít nhất 6 ký tự)"
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
