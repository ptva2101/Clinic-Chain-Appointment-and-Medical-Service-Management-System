import { useEffect, useState } from 'react'
import { KeyRound, LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { createAccount, listAccounts, resetAccountPassword, setAccountEnabled } from '../api/identity.js'
import { listStaffProfiles } from '../api/staffProfile.js'
import TablePagination from './TablePagination.jsx'
import { getPageRows, TABLE_PAGE_SIZE } from './tablePagination.js'

const STAFF_ROLES = [
  { value: 'doctor', label: 'Bác sĩ' },
  { value: 'letan', label: 'Lễ tân' },
  { value: 'xnv', label: 'Xét nghiệm viên' },
]
const ACCOUNT_ROLES = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'patient', label: 'Bệnh nhân' },
  ...STAFF_ROLES,
]

function profileSourceLabel(profile) {
  if (profile.source === 'legacy_demo' || profile.source === 'legacy_mysql') {
    return profile.identity_account_id ? 'Đã nhập · đã liên kết' : 'Đã nhập · chưa liên kết'
  }
  return profile.identity_account_id ? 'Tạo từ tài khoản' : 'Chưa liên kết tài khoản'
}

async function loadAllAccounts(accessToken) {
  const accounts = []
  for (let offset = 0; ; offset += 100) {
    const page = await listAccounts(accessToken, undefined, offset)
    accounts.push(...page)
    if (page.length < 100) return accounts
  }
}

export default function IdentityStaffAccounts({ accessToken, currentAccountId, onOwnPasswordReset, showNotification, onChanged }) {
  const [accounts, setAccounts] = useState([])
  const [accountSearch, setAccountSearch] = useState('')
  const [accountPage, setAccountPage] = useState(0)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [form, setForm] = useState({
    role: 'doctor', username: '', subject_id: '', full_name: '', phone: '',
    specialty: '', branch_code: '', password: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [profiles, setProfiles] = useState([])
  const [profileSearch, setProfileSearch] = useState('')
  const [profilePage, setProfilePage] = useState(0)
  const [profileTotal, setProfileTotal] = useState(0)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [profileReload, setProfileReload] = useState(0)

  const reload = async () => {
    setAccounts(await loadAllAccounts(accessToken))
  }

  useEffect(() => {
    if (!accessToken) return
    let active = true
    loadAllAccounts(accessToken)
      .then((loaded) => { if (active) setAccounts(loaded) })
      .catch((reason) => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) return
    let active = true
    const timer = setTimeout(async () => {
      if (active) setProfileLoading(true)
      try {
        const result = await listStaffProfiles(accessToken, {
          search: profileSearch,
          limit: TABLE_PAGE_SIZE,
          offset: profilePage * TABLE_PAGE_SIZE,
        })
        if (active) {
          setProfiles(result.items)
          setProfileTotal(result.total)
          setProfileError('')
        }
      } catch (reason) {
        if (active) {
          setProfiles([])
          setProfileTotal(0)
          setProfileError(reason.message)
        }
      } finally {
        if (active) setProfileLoading(false)
      }
    }, profileSearch ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [accessToken, profileSearch, profilePage, profileReload])

  const create = async (event) => {
    event.preventDefault()
    const username = form.username.trim()
    const subjectId = form.subject_id.trim() || username
    if (!username || !subjectId || !form.full_name.trim() || form.password.length < 6) {
      setError('Cần mã đăng nhập, mã nhân sự, họ tên và mật khẩu ít nhất 6 ký tự.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createAccount(accessToken, {
        role: form.role,
        username,
        subject_id: subjectId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        specialty: form.role === 'doctor' ? form.specialty.trim() || null : null,
        branch_code: form.branch_code.trim() || null,
        password: form.password,
      })
      setForm((current) => ({
        ...current, username: '', subject_id: '', full_name: '', phone: '',
        specialty: '', branch_code: '', password: '',
      }))
      setAccountPage(0)
      await reload()
      setProfileReload((value) => value + 1)
      onChanged?.()
      showNotification?.(`Đã cấp tài khoản ${username}.`)
    } catch (reason) {
      await reload().catch(() => {})
      setError(`${reason.message} Nếu Registry tạm lỗi, gửi lại cùng mã và mật khẩu để hoàn tất tài khoản chờ.`)
    } finally {
      setBusy(false)
    }
  }

  const openToggle = (account) => {
    if (account.registration_pending) {
      setError('Tài khoản đang chờ hồ sơ Registry. Gửi lại form với cùng mã và mật khẩu; không thể mở khóa trực tiếp.')
      return
    }
    setError('')
    setToggleTarget(account)
  }

  const closeToggle = () => {
    setToggleTarget(null)
    setError('')
  }

  const submitToggle = async (event) => {
    event.preventDefault()
    if (!toggleTarget || busy) return
    const account = toggleTarget
    setBusy(true)
    setError('')
    try {
      await setAccountEnabled(accessToken, account.id, !account.is_active)
      setToggleTarget(null)
      await reload()
      onChanged?.()
      showNotification?.(`Đã ${account.is_active ? 'khóa' : 'mở khóa'} tài khoản ${account.username}.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được trạng thái tài khoản.')
    } finally {
      setBusy(false)
    }
  }

  const openReset = (account) => {
    setError('')
    setResetTarget(account)
  }

  const closeReset = () => {
    setResetTarget(null)
    setError('')
  }

  const submitReset = async (event) => {
    event.preventDefault()
    if (!resetTarget || busy) return
    const target = resetTarget
    setBusy(true)
    setError('')
    try {
      await resetAccountPassword(accessToken, target.id)
      closeReset()
      if (target.id === currentAccountId) {
        await onOwnPasswordReset?.()
        showNotification?.('Đã đặt lại mật khẩu của bạn. Vui lòng đăng nhập lại.')
      } else {
        showNotification?.(`Đã đặt lại mật khẩu mặc định cho ${target.username}.`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không đặt lại được mật khẩu.')
    } finally {
      setBusy(false)
    }
  }

  const normalizedSearch = accountSearch.trim().toLocaleLowerCase('vi')
  const visibleAccounts = normalizedSearch
    ? accounts.filter((account) => [account.username, account.subject_id, account.role]
      .some((value) => String(value || '').toLocaleLowerCase('vi').includes(normalizedSearch)))
    : accounts

  return (
    <section className="admin-card">
      <div className="admin-section-header">
        <div>
          <h2>Tài khoản đăng nhập</h2>
          <p>Admin cấp tài khoản nhân viên và quản lý mật khẩu của mọi vai trò. Bảng hồ sơ bên dưới lấy dữ liệu từ Registry.</p>
        </div>
      </div>
      <form className="admin-form-grid" onSubmit={create}>
        <label>Vai trò
          <select className="admin-input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            {STAFF_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </label>
        <label>Mã đăng nhập
          <input className="admin-input" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} maxLength={128} required />
        </label>
        <label>Mã nhân sự (để trống nếu giống mã đăng nhập)
          <input className="admin-input" value={form.subject_id} onChange={(event) => setForm({ ...form, subject_id: event.target.value })} maxLength={128} />
        </label>
        <label>Họ và tên
          <input className="admin-input" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} maxLength={160} required />
        </label>
        <label>Số điện thoại
          <input className="admin-input" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={16} />
        </label>
        {form.role === 'doctor' && <label>Chuyên khoa
          <input className="admin-input" value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} maxLength={160} />
        </label>}
        <label>Mã chi nhánh
          <input className="admin-input" value={form.branch_code} onChange={(event) => setForm({ ...form, branch_code: event.target.value })} maxLength={32} />
        </label>
        <label>Mật khẩu ban đầu (ít nhất 6 ký tự)
          <input className="admin-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} required autoComplete="new-password" />
        </label>
        <button className="admin-primary-button" type="submit" disabled={busy}>Cấp tài khoản</button>
      </form>
      {error && !resetTarget && !toggleTarget && <p role="alert" className="auth-catalog-error">{error}</p>}
      <label className="admin-search-field">
        <span>Tìm tài khoản</span>
        <input className="admin-input" value={accountSearch} maxLength={128} placeholder="Mã đăng nhập, mã hồ sơ hoặc vai trò" onChange={(event) => { setAccountSearch(event.target.value); setAccountPage(0) }} />
      </label>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Vai trò</th><th>Mã đăng nhập</th><th>Mã hồ sơ/nhân sự</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {getPageRows(visibleAccounts, accountPage).map((account) => (
              <tr key={account.id}>
                <td>{ACCOUNT_ROLES.find((role) => role.value === account.role)?.label || account.role}</td>
                <td>{account.username}</td>
                <td>{account.subject_id || '—'}</td>
                <td><span className={`status-pill ${account.registration_pending ? 'muted' : account.is_active ? 'active' : 'danger'}`}>{account.registration_pending ? 'Chờ hồ sơ' : account.is_active ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                <td>
                  <div className="admin-actions-row">
                    {STAFF_ROLES.some((role) => role.value === account.role) && (
                      <button type="button" className={`admin-icon-action ${account.is_active ? 'admin-icon-action-danger' : 'admin-icon-action-success'}`} disabled={busy || account.registration_pending} onClick={() => openToggle(account)} aria-label={account.registration_pending ? `Tài khoản ${account.username} đang chờ hồ sơ` : `${account.is_active ? 'Khóa' : 'Mở khóa'} tài khoản ${account.username}`} title={account.registration_pending ? 'Chờ hoàn tất hồ sơ' : account.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>{account.is_active ? <LockKeyhole size={18} aria-hidden="true" /> : <LockKeyholeOpen size={18} aria-hidden="true" />}</button>
                    )}
                    <button type="button" className="admin-icon-action" disabled={busy} onClick={() => openReset(account)} aria-label={`Đặt lại mật khẩu cho ${account.username}`} title="Đặt lại mật khẩu"><KeyRound size={18} aria-hidden="true" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleAccounts.length === 0 && <tr><td colSpan="5">Không tìm thấy tài khoản phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      <TablePagination page={accountPage} total={visibleAccounts.length} label="tài khoản" onPageChange={setAccountPage} />
      {toggleTarget && (
        <div className="admin-modal-overlay">
          <section className="admin-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-toggle-title">
            <form className="admin-password-reset-form" onSubmit={submitToggle}>
              <h2 id="admin-toggle-title">Xác nhận {toggleTarget.is_active ? 'khóa' : 'mở khóa'} tài khoản</h2>
              <p>{toggleTarget.is_active
                ? <>Tài khoản <strong>{toggleTarget.username}</strong> sẽ không thể đăng nhập và các phiên hiện tại sẽ hết hiệu lực.</>
                : <>Tài khoản <strong>{toggleTarget.username}</strong> sẽ có thể đăng nhập trở lại.</>}</p>
              {error && <p role="alert" className="auth-catalog-error">{error}</p>}
              <div className="admin-actions-row">
                <button className={toggleTarget.is_active ? 'admin-danger-button' : 'admin-success-button'} type="submit" disabled={busy}>Xác nhận {toggleTarget.is_active ? 'khóa' : 'mở khóa'}</button>
                <button className="admin-secondary-button" type="button" disabled={busy} onClick={closeToggle}>Hủy</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {resetTarget && (
        <div className="admin-modal-overlay">
          <section className="admin-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-reset-title">
            <form className="admin-password-reset-form" onSubmit={submitReset}>
              <h2 id="admin-reset-title">Đặt lại mật khẩu: {resetTarget.username}</h2>
              <p>Mật khẩu của tài khoản này sẽ được đặt về mặc định <strong>123456</strong>. Các phiên đăng nhập hiện tại sẽ hết hiệu lực. Thao tác này không mở khóa tài khoản đã bị vô hiệu hóa.</p>
              {error && <p role="alert" className="auth-catalog-error">{error}</p>}
              <div className="admin-actions-row">
                <button className="admin-primary-button" type="submit" disabled={busy}>Xác nhận đặt lại</button>
                <button className="admin-secondary-button" type="button" disabled={busy} onClick={closeReset}>Hủy</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <div className="admin-staff-directory">
        <div className="admin-section-header">
          <div>
            <h2>Hồ sơ nhân viên Registry</h2>
            <p>Gồm hồ sơ nhân viên từ Registry. Cột Nguồn cho biết hồ sơ được tạo từ tài khoản hay nhập từ hệ thống cũ và đã liên kết tài khoản chưa.</p>
          </div>
          <button type="button" className="admin-secondary-button" disabled={profileLoading} onClick={() => { setProfileLoading(true); setProfileReload((value) => value + 1) }}>Làm mới</button>
        </div>
        <label className="admin-search-field">
          <span>Tìm nhân viên</span>
          <input className="admin-input" value={profileSearch} maxLength={100} placeholder="Mã nhân sự, họ tên hoặc số điện thoại" onChange={(event) => { setProfileLoading(true); setProfileSearch(event.target.value); setProfilePage(0) }} />
        </label>
        {profileError && <p role="alert" className="admin-feedback">{profileError}</p>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Mã nhân sự</th><th>Họ tên</th><th>Vai trò</th><th>Chuyên khoa</th><th>Chi nhánh</th><th>Số điện thoại</th><th>Nguồn</th></tr></thead>
            <tbody>
              {!profileLoading && !profileError && profiles.map((profile) => (
                <tr key={profile.staff_code}>
                  <td>{profile.staff_code}</td>
                  <td>{profile.full_name}</td>
                  <td>{STAFF_ROLES.find((role) => role.value === profile.role)?.label || profile.role}</td>
                  <td>{profile.specialty || '—'}</td>
                  <td>{profile.branch_code || '—'}</td>
                  <td>{profile.phone || '—'}</td>
                  <td>{profileSourceLabel(profile)}</td>
                </tr>
              ))}
              {(profileLoading || profileError || profiles.length === 0) && <tr><td colSpan="7">{profileLoading ? 'Đang tải nhân viên...' : profileError ? 'Không thể tải hồ sơ. Hãy thử làm mới.' : 'Chưa có hồ sơ nhân viên.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {!profileError && <TablePagination page={profilePage} total={profileTotal} label="nhân viên" disabled={profileLoading} onPageChange={(page) => { setProfileLoading(true); setProfilePage(page) }} />}
      </div>
    </section>
  )
}
