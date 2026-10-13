import { useEffect, useState } from 'react'
import { createAccount, listAccounts, setAccountEnabled } from '../api/identity.js'
import { listStaffProfiles } from '../api/staffProfile.js'

const STAFF_PAGE_SIZE = 20

const STAFF_ROLES = [
  { value: 'doctor', label: 'Bác sĩ' },
  { value: 'letan', label: 'Lễ tân' },
  { value: 'xnv', label: 'Xét nghiệm viên' },
]

export default function IdentityStaffAccounts({ accessToken, showNotification, onChanged }) {
  const [accounts, setAccounts] = useState([])
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
    const groups = await Promise.all(STAFF_ROLES.map(({ value }) => listAccounts(accessToken, value)))
    setAccounts(groups.flat())
  }

  useEffect(() => {
    if (!accessToken) return
    let active = true
    Promise.all(STAFF_ROLES.map(({ value }) => listAccounts(accessToken, value)))
      .then((groups) => { if (active) setAccounts(groups.flat()) })
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
          limit: STAFF_PAGE_SIZE,
          offset: profilePage * STAFF_PAGE_SIZE,
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
    if (!username || !subjectId || !form.full_name.trim() || form.password.length < 12) {
      setError('Cần mã đăng nhập, mã nhân sự, họ tên và mật khẩu ít nhất 12 ký tự.')
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
      await reload()
      setProfileReload((value) => value + 1)
      onChanged?.()
      showNotification?.(`Đã cấp tài khoản Identity ${username}.`)
    } catch (reason) {
      await reload().catch(() => {})
      setError(`${reason.message} Nếu Registry tạm lỗi, gửi lại cùng mã và mật khẩu để hoàn tất tài khoản chờ.`)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (account) => {
    if (account.registration_pending) {
      setError('Tài khoản đang chờ hồ sơ Registry. Gửi lại form với cùng mã và mật khẩu; không thể mở khóa trực tiếp.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setAccountEnabled(accessToken, account.id, !account.is_active)
      await reload()
      onChanged?.()
      showNotification?.(`Đã ${account.is_active ? 'khóa' : 'mở khóa'} tài khoản ${account.username}.`)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-section-header">
        <div>
          <h2>Tài khoản đăng nhập Identity</h2>
          <p>Admin cấp tài khoản Identity và tạo hồ sơ nhân viên Registry cùng lúc. Bảng hồ sơ bên dưới lấy dữ liệu thật từ Registry.</p>
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
        <label>Mật khẩu ban đầu (ít nhất 12 ký tự)
          <input className="admin-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={12} required autoComplete="new-password" />
        </label>
        <button className="admin-primary-button" type="submit" disabled={busy}>Cấp tài khoản Identity</button>
      </form>
      {error && <p role="alert" className="auth-catalog-error">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Vai trò</th><th>Mã đăng nhập</th><th>Mã nhân sự</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{STAFF_ROLES.find((role) => role.value === account.role)?.label}</td>
                <td>{account.username}</td>
                <td>{account.subject_id || '—'}</td>
                <td>{account.registration_pending ? 'Chờ Registry' : account.is_active ? 'Đang hoạt động' : 'Đã khóa'}</td>
                <td><button type="button" className={account.is_active ? 'admin-danger-button' : 'admin-success-button'} disabled={busy || account.registration_pending} onClick={() => toggle(account)}>{account.registration_pending ? 'Chờ hoàn tất' : account.is_active ? 'Khóa' : 'Mở khóa'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-staff-directory">
        <div className="admin-section-header">
          <div>
            <h2>Hồ sơ nhân viên Registry</h2>
            <p>Chỉ hiện hồ sơ đã tạo thật; tài khoản chờ liên kết sẽ chưa có trong bảng này.</p>
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
            <thead><tr><th>Mã nhân sự</th><th>Họ tên</th><th>Vai trò</th><th>Chuyên khoa</th><th>Chi nhánh</th><th>Số điện thoại</th></tr></thead>
            <tbody>
              {!profileLoading && !profileError && profiles.map((profile) => (
                <tr key={profile.staff_code}>
                  <td>{profile.staff_code}</td>
                  <td>{profile.full_name}</td>
                  <td>{STAFF_ROLES.find((role) => role.value === profile.role)?.label || profile.role}</td>
                  <td>{profile.specialty || '—'}</td>
                  <td>{profile.branch_code || '—'}</td>
                  <td>{profile.phone || '—'}</td>
                </tr>
              ))}
              {(profileLoading || profileError || profiles.length === 0) && <tr><td colSpan="6">{profileLoading ? 'Đang tải nhân viên...' : profileError ? 'Không thể tải hồ sơ. Hãy thử làm mới.' : 'Chưa có hồ sơ nhân viên.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {!profileError && profileTotal > 0 && <div className="admin-patient-pagination">
          <span>Hiển thị {profilePage * STAFF_PAGE_SIZE + 1}–{Math.min((profilePage + 1) * STAFF_PAGE_SIZE, profileTotal)} / {profileTotal} nhân viên</span>
          <div className="admin-actions-row">
            <button type="button" className="admin-secondary-button" disabled={profileLoading || profilePage === 0} onClick={() => { setProfileLoading(true); setProfilePage((page) => page - 1) }}>Trang trước</button>
            <button type="button" className="admin-secondary-button" disabled={profileLoading || (profilePage + 1) * STAFF_PAGE_SIZE >= profileTotal} onClick={() => { setProfileLoading(true); setProfilePage((page) => page + 1) }}>Trang sau</button>
          </div>
        </div>}
      </div>
    </section>
  )
}
