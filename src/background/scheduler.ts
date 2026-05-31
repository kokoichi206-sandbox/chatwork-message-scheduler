import type { Reservation, Settings } from '../shared/types'
import * as chatwork from './chatwork'
import * as store from './store'

const ALARM_PREFIX = 'res:'

const alarmName = (id: string): string => `${ALARM_PREFIX}${id}`

const reservationIdFromAlarm = (name: string): string | null =>
  name.startsWith(ALARM_PREFIX) ? name.slice(ALARM_PREFIX.length) : null

const scheduleAlarm = (reservation: Reservation): void => {
  chrome.alarms.create(alarmName(reservation.id), {
    when: Date.parse(reservation.scheduledAt),
  })
}

const clearAlarm = (id: string): Promise<boolean> =>
  chrome.alarms.clear(alarmName(id))

// 送信失敗を通知する。アイコン未配置などで失敗しても致命ではない
const notifyFailure = (reservation: Reservation, error: string): void => {
  chrome.notifications.create(
    `fail:${reservation.id}`,
    {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/128.png'),
      title: '予約送信に失敗しました',
      message: `${reservation.roomName}: ${error}`,
    },
    () => {
      // lastError を読み捨てて未処理例外を防ぐ
      void chrome.runtime.lastError
    },
  )
}

// 現 SW で送信中の予約 id。releaseStuckSending が in-flight を誤って再送するのを防ぐ
const inFlight = new Set<string>()

// claim 済みの予約を実際に送信する
const sendClaimed = async (
  reservation: Reservation,
  settings: Settings,
): Promise<void> => {
  inFlight.add(reservation.id)
  try {
    if (!settings.apiToken) {
      const reason = 'APIトークンが未設定です'
      await store.markFailed(reservation.id, reason)
      notifyFailure(reservation, reason)
      return
    }
    const result = await chatwork.sendMessage(
      settings.apiToken,
      reservation.roomId,
      reservation.body,
      settings.defaultSelfUnread,
    )
    if (result.ok) {
      await store.markSent(reservation.id, result.data.messageId)
      await clearAlarm(reservation.id)
    } else {
      await store.markFailed(reservation.id, result.error)
      notifyFailure(reservation, result.error)
    }
  } finally {
    inFlight.delete(reservation.id)
  }
}

// 送信時刻を過ぎた pending を順に送る。alarm 発火・起動時キャッチアップ共通の入口。
const drainDue = async (): Promise<void> => {
  const { reservations, settings } = await store.readAll()
  const nowMs = Date.now()
  const due = Object.values(reservations).filter(
    (r) => r.status === 'pending' && Date.parse(r.scheduledAt) <= nowMs,
  )
  for (const r of due) {
    const claimed = await store.claimDueReservation(r.id, nowMs)
    if (!claimed) continue
    await sendClaimed(claimed, settings)
  }
}

// 予約時刻を待たず即時送信する。claimForSend が単一ロックで sending を確定するので、
// 同時に走る drainDue との二重送信は起きない。
const sendNow = async (id: string): Promise<void> => {
  const claimed = await store.claimForSend(id)
  if (!claimed) return
  const { settings } = await store.readAll()
  await sendClaimed(claimed, settings)
}

// 起動・更新時の整合: 詰まった sending を解放 → pending の alarm を貼り直し → 未送信を流す
const reconcile = async (): Promise<void> => {
  await store.releaseStuckSending(inFlight)
  const { reservations } = await store.readAll()
  for (const r of Object.values(reservations)) {
    if (r.status === 'pending') scheduleAlarm(r)
  }
  await drainDue()
}

export {
  reservationIdFromAlarm,
  scheduleAlarm,
  clearAlarm,
  drainDue,
  sendNow,
  reconcile,
}
