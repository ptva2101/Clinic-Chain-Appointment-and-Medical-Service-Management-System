import { useEffect, useState } from 'react'
import { getPatientProfile, updatePatientProfile } from '../api/patientProfile.js'

export default function PatientProfileForm({ accessToken, showNotification }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ full_name: '', date_of_birth: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) return
    let active = true
    getPatientProfile(accessToken)
      .then((patient) => {
        if (!active) return
        setProfile(patient)
        setForm({
          full_name: patient.full_name || '',
          date_of_birth: patient.date_of_birth || '',
          phone: patient.phone || '',
        })
        setError('')
      })
      .catch((reason) => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [accessToken])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const updated = await updatePatientProfile(accessToken, {
        full_name: form.full_name.trim() || null,
        date_of_birth: form.date_of_birth || null,
        phone: form.phone.trim() || null,
      })
      setProfile(updated)
      showNotification?.('Đã lưu hồ sơ bệnh nhân tại Registry.')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="patient-registry-profile">
      <h2>Hồ sơ bệnh nhân</h2>
      {profile && <p>CCCD: <strong>{profile.cccd}</strong></p>}
      {error && <p className="auth-catalog-error" role="alert">{error}</p>}
      {profile && (
        <form className="auth-form" onSubmit={save}>
          <label className="field-group">Họ và tên
            <input className="admin-input" value={form.full_name} maxLength={160} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
          </label>
          <label className="field-group">Ngày sinh
            <input className="admin-input" type="date" value={form.date_of_birth} onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })} />
          </label>
          <label className="field-group">Số điện thoại
            <input className="admin-input" type="tel" value={form.phone} maxLength={16} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <button className="submit-button" type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
        </form>
      )}
    </div>
  )
}
