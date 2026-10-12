import { useState } from 'react'

export function InputField({ label, placeholder, icon, type = 'text', value, onChange }) {
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

export function GlobalToast({ toast }) {
  if (!toast.show) return null

  const isError = toast.type === 'error'

  return (
    <div className={`global-toast ${isError ? 'error' : 'success'}`} role="status" aria-live="polite">
      <span className="global-toast-icon">{isError ? '×' : '✓'}</span>
      <span>{toast.message}</span>
    </div>
  )
}

export function NotificationBell({ notifications, onMarkAllRead }) {
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
