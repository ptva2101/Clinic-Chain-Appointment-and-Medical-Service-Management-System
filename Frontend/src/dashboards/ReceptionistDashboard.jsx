import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { LogOut } from 'lucide-react'
import { EMPTY_CATALOG_DATA } from '../shared/catalog.js'
import { getTodayDateKey } from '../shared/dates.js'
import { checkIn, getCheckinAppointments, getWaitingList, searchCheckinAppointment } from '../api/appointment.js'
import TablePagination from './TablePagination.jsx'
import { getCurrentPage, getPageRows, TABLE_PAGE_SIZE } from './tablePagination.js'

export default function ReceptionistDashboard({ user, identityAccessToken, onLogout, showNotification, catalogData = EMPTY_CATALOG_DATA }) {
  const TODAY = getTodayDateKey()
  const [activeQueueTab, setActiveQueueTab] = useState('prebooked')
  const [prebookedPage, setPrebookedPage] = useState(0)
  const [queueGroupPage, setQueueGroupPage] = useState(0)
  const [queuePagesByDoctor, setQueuePagesByDoctor] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState('')
  const [checkinRows, setCheckinRows] = useState([])
  const [queueRows, setQueueRows] = useState([])
  const [searchRows, setSearchRows] = useState([])
  const [hasLoadedCheckinRows, setHasLoadedCheckinRows] = useState(true)
  const [hasLoadedQueueRows, setHasLoadedQueueRows] = useState(true)
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
  const [patients] = useState([])
  const [bookings, setBookings] = useState([])

  const effectiveBranches = catalogData?.branches || []
  const effectiveServices = catalogData?.services || []
  const catalogDoctors = Object.values(
    (catalogData?.doctorSchedules || []).reduce((doctorMap, schedule) => {
      if (!schedule.MaBacSi || doctorMap[schedule.MaBacSi]) return doctorMap

      doctorMap[schedule.MaBacSi] = {
        MaBacSi: schedule.MaBacSi,
        HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
        ChuyenKhoa: schedule.ChuyenKhoa || '',
        SDT: schedule.SDT || '',
      }
      return doctorMap
    }, {}),
  )
  const effectiveStaffList = catalogDoctors

  const maChiNhanh = user?.MaChiNhanh || effectiveBranches[0]?.MaChiNhanh || ''
  const currentBranch = effectiveBranches.find((branch) => branch.MaChiNhanh === maChiNhanh) || effectiveBranches[0]
  const branchDoctorsToday = useMemo(() => {
    const doctorMap = (catalogData?.doctorSchedules || [])
      .filter((schedule) => schedule.MaChiNhanh === maChiNhanh && schedule.NgayTruc === TODAY)
      .reduce((currentMap, schedule) => {
        if (!schedule.MaBacSi || currentMap[schedule.MaBacSi]) return currentMap

        currentMap[schedule.MaBacSi] = {
          MaBacSi: schedule.MaBacSi,
          HoTen: schedule.TenBacSi || schedule.HoTen || schedule.MaBacSi,
          ChuyenKhoa: schedule.ChuyenKhoa || '',
          SDT: schedule.SDT || '',
        }
        return currentMap
      }, {})

    return Object.values(doctorMap)
  }, [catalogData?.doctorSchedules, maChiNhanh, TODAY])

  const normalizeReceptionBooking = useCallback((appointment) => ({
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
  }), [maChiNhanh, TODAY])

  const loadCheckinAppointments = async () => {
    if (!maChiNhanh) return

    setCheckinRowsLoading(true)
    setReceptionError('')

    try {
      const params = new URLSearchParams({ ma_chi_nhanh: maChiNhanh, ngay: TODAY })
      const response = await getCheckinAppointments(params.toString(), identityAccessToken)
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
          const response = await getWaitingList(doctor.MaBacSi, TODAY, params.toString(), identityAccessToken)
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

  const onLoadCheckinAppointments = useEffectEvent(() => { void loadCheckinAppointments() })
  useEffect(() => {
    const timer = window.setTimeout(() => onLoadCheckinAppointments(), 0)
    return () => window.clearTimeout(timer)
  }, [maChiNhanh, TODAY, identityAccessToken])

  const onLoadDoctorQueues = useEffectEvent(() => { void loadDoctorQueues() })
  useEffect(() => {
    const timer = window.setTimeout(() => onLoadDoctorQueues(), 0)
    return () => window.clearTimeout(timer)
  }, [maChiNhanh, branchDoctorsToday, TODAY, identityAccessToken])

  useEffect(() => {
    const keyword = searchTerm.trim()

    if (keyword.length < 2) {
      const timer = window.setTimeout(() => {
        setSearchRows([])
        setSearchError('')
        setSearchLoading(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const timeoutId = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchError('')

      try {
        const params = new URLSearchParams({ keyword, ma_chi_nhanh: maChiNhanh, ngay: TODAY })
        const response = await searchCheckinAppointment(params.toString(), identityAccessToken)
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
  }, [searchTerm, maChiNhanh, TODAY, identityAccessToken, normalizeReceptionBooking])

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

       const response = await checkIn({
        method: 'POST',
        body: formData,
       }, identityAccessToken)
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
          <>
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
                {getPageRows(waitingReceptionBookings, prebookedPage).map((booking, index) => {
                  const patient = getPatient(booking.MaBenhAn)
                  const service = getService(booking.MaDichVu)
                  return (
                    <tr key={booking.MaLichHen}>
                      <td>{getCurrentPage(prebookedPage, waitingReceptionBookings.length) * TABLE_PAGE_SIZE + index + 1}</td>
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
          <TablePagination page={prebookedPage} total={waitingReceptionBookings.length} label="lịch chờ tiếp đón" onPageChange={setPrebookedPage} />
          </>
        ) : queueGroups.length > 0 ? (
          <>
          <div className="reception-doctor-queue-grid">
            {getPageRows(queueGroups, queueGroupPage).map((group) => (
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
                      {getPageRows(group.items, queuePagesByDoctor[group.doctor.MaBacSi] || 0).map((booking, index) => {
                        const patient = getPatient(booking.MaBenhAn)
                        const service = getService(booking.MaDichVu)
                        return (
                          <tr key={booking.MaLichHen}>
                            <td>{getCurrentPage(queuePagesByDoctor[group.doctor.MaBacSi] || 0, group.items.length) * TABLE_PAGE_SIZE + index + 1}</td>
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
                <TablePagination page={queuePagesByDoctor[group.doctor.MaBacSi] || 0} total={group.items.length} label="bệnh nhân" onPageChange={(page) => setQueuePagesByDoctor((current) => ({ ...current, [group.doctor.MaBacSi]: page }))} />
              </article>
            ))}
          </div>
          <TablePagination page={queueGroupPage} total={queueGroups.length} label="bác sĩ" onPageChange={setQueueGroupPage} />
          </>
        ) : (
          <div className="reception-empty-state">Chưa có bệnh nhân nào trong hàng đợi khám.</div>
        )}
      </section>
    </main>
  )
}
