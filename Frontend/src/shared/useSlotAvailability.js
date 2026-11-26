import { useEffect, useState } from 'react'
import { getSchedulingAvailability } from '../api/scheduling.js'

const CHANGE_EVENT = 'clinic:slot-availability-changed'
const CHANNEL = 'clinic-slot-availability'
const EMPTY_ROWS = Object.freeze({})

export function refreshSlotAvailability() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL)
    channel.postMessage('refresh')
    channel.close()
  }
}

// Availability is shared by every patient for a branch/service/date/shift.
// Never infer it from the signed-in patient's appointment list.
export default function useSlotAvailability(configCode, date) {
  const key = configCode && date ? `${configCode}:${date}` : ''
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    if (!configCode || !date) return undefined
    let active = true
    let generation = 0
    let controller
    const load = async () => {
      controller?.abort()
      controller = new AbortController()
      const current = ++generation
      try {
        const rows = await Promise.all([1, 2, 3, 4].map((shift) => getSchedulingAvailability({
          configCode, date, shift, signal: controller.signal,
        })))
        if (active && current === generation) {
          setSnapshot({ key, rows: Object.fromEntries(rows.map((row) => [row.shift, row])), error: '' })
        }
      } catch (reason) {
        if (active && current === generation && reason.name !== 'AbortError') {
          setSnapshot({ key, rows: {}, error: reason instanceof Error ? reason.message : 'Không thể tải số chỗ trống.' })
        }
      }
    }
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void load()
    }
    const initial = window.setTimeout(load, 0)
    const timer = window.setInterval(refresh, 10000)
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
    channel?.addEventListener('message', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener(CHANGE_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      controller?.abort()
      window.clearTimeout(initial)
      window.clearInterval(timer)
      channel?.close()
      window.removeEventListener('focus', refresh)
      window.removeEventListener(CHANGE_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [configCode, date, key])

  const current = key && snapshot?.key === key ? snapshot : null
  return { key, rows: current?.rows || EMPTY_ROWS, error: current?.error || '', ready: Boolean(current && !current.error) }
}
