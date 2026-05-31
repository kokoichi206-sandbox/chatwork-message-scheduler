import type { NewReservationInput, ReservationPatch } from '../shared/messages'
import type { Reservation, Settings, StorageSchema } from '../shared/types'
import { withLock } from './mutex'

const DEFAULT_SETTINGS: Settings = {
  apiToken: null,
  defaultSelfUnread: false,
}

// sending のまま放置された予約を pending に戻す閾値（再送を避けるため保守的に長めにとる）
const STUCK_SENDING_MS = 120_000

const nowIso = (): string => new Date().toISOString()

// storage は外部入力なので、欠損時は既定値で補完する
const readAll = async (): Promise<StorageSchema> => {
  const raw = await chrome.storage.local.get(['reservations', 'settings'])
  return {
    reservations: (raw.reservations as Record<string, Reservation>) ?? {},
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings as Partial<Settings>) },
  }
}

const writeReservations = (
  reservations: Record<string, Reservation>,
): Promise<void> => chrome.storage.local.set({ reservations })

const getSettings = async (): Promise<Settings> => (await readAll()).settings

const setSettings = (patch: Partial<Settings>): Promise<Settings> =>
  withLock(async () => {
    const current = await getSettings()
    const next = { ...current, ...patch }
    await chrome.storage.local.set({ settings: next })
    return next
  })

const createReservation = (input: NewReservationInput): Promise<Reservation> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const ts = nowIso()
    const reservation: Reservation = {
      id: crypto.randomUUID(),
      roomId: input.roomId,
      roomName: input.roomName,
      body: input.body,
      scheduledAt: input.scheduledAt,
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    }
    reservations[reservation.id] = reservation
    await writeReservations(reservations)
    return reservation
  })

// 送信前(pending)の予約のみ更新できる
const updateReservation = (
  id: string,
  patch: ReservationPatch,
): Promise<Reservation> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const current = reservations[id]
    if (!current) throw new Error('予約が見つかりません')
    if (current.status !== 'pending')
      throw new Error('送信前(pending)の予約のみ編集できます')
    const next: Reservation = { ...current, ...patch, updatedAt: nowIso() }
    reservations[id] = next
    await writeReservations(reservations)
    return next
  })

const deleteReservation = (id: string): Promise<void> =>
  withLock(async () => {
    const { reservations } = await readAll()
    delete reservations[id]
    await writeReservations(reservations)
  })

// 期限到来した pending のみ pending -> sending に原子的に遷移する。
// due 判定もロック内で再確認するので、claim 直前の時刻変更と競合しても誤送信しない。
// 二重送信防止の要で、claim できた呼び出しだけが送信に進む。
const claimDueReservation = (
  id: string,
  nowMs: number,
): Promise<Reservation | null> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const current = reservations[id]
    if (
      !current ||
      current.status !== 'pending' ||
      Date.parse(current.scheduledAt) > nowMs
    )
      return null
    const ts = nowIso()
    const next: Reservation = {
      ...current,
      status: 'sending',
      claimedAt: ts,
      updatedAt: ts,
    }
    reservations[id] = next
    await writeReservations(reservations)
    return next
  })

const markSent = (id: string, messageId: string): Promise<void> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const current = reservations[id]
    if (!current) return
    const ts = nowIso()
    reservations[id] = {
      ...current,
      status: 'sent',
      sentMessageId: messageId,
      sentAt: ts,
      updatedAt: ts,
      error: undefined,
    }
    await writeReservations(reservations)
  })

const markFailed = (id: string, error: string): Promise<void> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const current = reservations[id]
    if (!current) return
    const ts = nowIso()
    reservations[id] = {
      ...current,
      status: 'failed',
      error,
      failedAt: ts,
      updatedAt: ts,
    }
    await writeReservations(reservations)
  })

// 即時送信用。sending 以外なら sending に遷移して返す（pending/sent/failed から送れる）。
// reset と claim を 1 つのロックで行い、drainDue との競合による二重送信を防ぐ。
const claimForSend = (id: string): Promise<Reservation | null> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const current = reservations[id]
    if (!current || current.status === 'sending') return null
    const ts = nowIso()
    // 過去の試行の証跡（sent/failed 由来）を消してから送り直す
    const next: Reservation = {
      ...current,
      status: 'sending',
      claimedAt: ts,
      error: undefined,
      sentAt: undefined,
      sentMessageId: undefined,
      failedAt: undefined,
      updatedAt: ts,
    }
    reservations[id] = next
    await writeReservations(reservations)
    return next
  })

// SW が送信途中で落ちた場合の復旧: sending のまま閾値を過ぎ、かつ現 SW で送信中でない
// ものを pending に戻す。excludeIds は「今まさに送信中」の id 集合。
const releaseStuckSending = (excludeIds: ReadonlySet<string>): Promise<void> =>
  withLock(async () => {
    const { reservations } = await readAll()
    const threshold = Date.now() - STUCK_SENDING_MS
    let changed = false
    for (const r of Object.values(reservations)) {
      if (
        r.status === 'sending' &&
        !excludeIds.has(r.id) &&
        r.claimedAt &&
        Date.parse(r.claimedAt) < threshold
      ) {
        reservations[r.id] = {
          ...r,
          status: 'pending',
          claimedAt: undefined,
          updatedAt: nowIso(),
        }
        changed = true
      }
    }
    if (changed) await writeReservations(reservations)
  })

export {
  readAll,
  getSettings,
  setSettings,
  createReservation,
  updateReservation,
  deleteReservation,
  claimDueReservation,
  claimForSend,
  markSent,
  markFailed,
  releaseStuckSending,
}
