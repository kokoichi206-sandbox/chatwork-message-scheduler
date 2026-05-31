import type {
  BackgroundRequest,
  NewReservationInput,
  ReservationPatch,
  Result,
} from '../shared/messages'
import type { ChatworkRoom, Reservation } from '../shared/types'

// background へリクエストを送る薄いラッパ
const send = <T>(request: BackgroundRequest): Promise<Result<T>> =>
  chrome.runtime.sendMessage(request) as Promise<Result<T>>

const $ = <T extends HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`要素が見つかりません: ${selector}`)
  return el
}

const tokenInput = $<HTMLInputElement>('#token')
const saveTokenBtn = $<HTMLButtonElement>('#saveToken')
const authStatus = $<HTMLParagraphElement>('#authStatus')
const roomSelect = $<HTMLSelectElement>('#roomSelect')
const loadRoomsBtn = $<HTMLButtonElement>('#loadRooms')
const currentRoomBtn = $<HTMLButtonElement>('#currentRoom')
const roomStatus = $<HTMLParagraphElement>('#roomStatus')
const formTitle = $<HTMLHeadingElement>('#formTitle')
const scheduledAtInput = $<HTMLInputElement>('#scheduledAt')
const bodyInput = $<HTMLTextAreaElement>('#body')
const submitBtn = $<HTMLButtonElement>('#submit')
const cancelEditBtn = $<HTMLButtonElement>('#cancelEdit')
const formStatus = $<HTMLParagraphElement>('#formStatus')
const listEl = $<HTMLDivElement>('#list')

// 編集中の予約 id（null なら新規作成モード）
let editingId: string | null = null

const setStatus = (
  el: HTMLElement,
  message: string,
  kind: 'ok' | 'error' | '' = '',
): void => {
  el.textContent = message
  el.className = `status${kind ? ` ${kind}` : ''}`
}

// datetime-local(ローカル時刻) を ISO8601(絶対時刻) に変換
const localInputToIso = (value: string): string => new Date(value).toISOString()

// ISO8601 を datetime-local(ローカル時刻) に変換
const isoToLocalInput = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const STATUS_LABEL: Record<Reservation['status'], string> = {
  pending: '予約中',
  sending: '送信中',
  sent: '送信済み',
  failed: '失敗',
}

// --- ルーム選択 ---

const upsertRoomOption = (roomId: string, name: string): void => {
  const existing = Array.from(roomSelect.options).find(
    (o) => o.value === roomId,
  )
  const option = existing ?? document.createElement('option')
  option.value = roomId
  option.textContent = name
  if (!existing) roomSelect.appendChild(option)
  roomSelect.value = roomId
}

const populateRooms = (rooms: ChatworkRoom[]): void => {
  const selected = roomSelect.value
  roomSelect.replaceChildren()
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '-- ルームを選択 --'
  roomSelect.appendChild(placeholder)
  for (const room of rooms) {
    const option = document.createElement('option')
    option.value = room.roomId
    option.textContent = room.name
    roomSelect.appendChild(option)
  }
  roomSelect.value = selected
}

const loadRooms = async (): Promise<void> => {
  setStatus(roomStatus, '取得中...')
  const result = await send<ChatworkRoom[]>({ type: 'rooms/list' })
  if (result.ok) {
    populateRooms(result.data)
    setStatus(roomStatus, `${result.data.length} 件のルームを取得`, 'ok')
  } else {
    setStatus(roomStatus, result.error, 'error')
  }
}

const useCurrentRoom = async (): Promise<void> => {
  setStatus(roomStatus, '取得中...')
  const result = await send<{ roomId: string; name: string }>({
    type: 'rooms/currentTab',
  })
  if (result.ok) {
    upsertRoomOption(result.data.roomId, result.data.name)
    setStatus(roomStatus, `選択: ${result.data.name}`, 'ok')
  } else {
    setStatus(roomStatus, result.error, 'error')
  }
}

// --- トークン ---

const saveToken = async (): Promise<void> => {
  const token = tokenInput.value.trim()
  if (!token) {
    setStatus(authStatus, 'トークンを入力してください', 'error')
    return
  }
  setStatus(authStatus, '確認中...')
  const saved = await send<{ hasToken: boolean }>({
    type: 'settings/setToken',
    payload: { apiToken: token },
  })
  if (!saved.ok) {
    setStatus(authStatus, saved.error, 'error')
    return
  }
  const verified = await send<{ accountId: number; name: string }>({
    type: 'auth/verify',
  })
  if (verified.ok) {
    setStatus(authStatus, `接続OK: ${verified.data.name}`, 'ok')
    tokenInput.value = ''
  } else {
    setStatus(authStatus, verified.error, 'error')
  }
}

// --- 予約フォーム ---

const resetForm = (): void => {
  editingId = null
  formTitle.textContent = '新規予約'
  submitBtn.textContent = '予約する'
  cancelEditBtn.classList.add('hidden')
  scheduledAtInput.value = ''
  bodyInput.value = ''
  setStatus(formStatus, '')
}

const submitForm = async (): Promise<void> => {
  const roomId = roomSelect.value
  const roomName = roomSelect.selectedOptions[0]?.textContent ?? ''
  const scheduledAtValue = scheduledAtInput.value
  const body = bodyInput.value.trim()

  if (!roomId) {
    setStatus(formStatus, '送信先ルームを選択してください', 'error')
    return
  }
  if (!scheduledAtValue) {
    setStatus(formStatus, '送信日時を入力してください', 'error')
    return
  }
  if (!body) {
    setStatus(formStatus, '本文を入力してください', 'error')
    return
  }
  const scheduledAt = localInputToIso(scheduledAtValue)

  if (editingId) {
    const patch: ReservationPatch = { roomId, roomName, body, scheduledAt }
    const result = await send<Reservation>({
      type: 'reservation/update',
      payload: { id: editingId, patch },
    })
    if (result.ok) resetForm()
    else setStatus(formStatus, result.error, 'error')
    return
  }

  const payload: NewReservationInput = { roomId, roomName, body, scheduledAt }
  const result = await send<Reservation>({
    type: 'reservation/create',
    payload,
  })
  if (result.ok) resetForm()
  else setStatus(formStatus, result.error, 'error')
}

const startEdit = (reservation: Reservation): void => {
  editingId = reservation.id
  formTitle.textContent = '予約を編集'
  submitBtn.textContent = '更新する'
  cancelEditBtn.classList.remove('hidden')
  upsertRoomOption(reservation.roomId, reservation.roomName)
  scheduledAtInput.value = isoToLocalInput(reservation.scheduledAt)
  bodyInput.value = reservation.body
  setStatus(formStatus, '')
}

// --- 一覧 ---

const buildItem = (reservation: Reservation): HTMLDivElement => {
  const item = document.createElement('div')
  item.className = 'item'

  const head = document.createElement('div')
  head.className = 'item-head'
  const room = document.createElement('span')
  room.className = 'item-room'
  room.textContent = reservation.roomName || reservation.roomId
  const badge = document.createElement('span')
  badge.className = `badge ${reservation.status}`
  badge.textContent = STATUS_LABEL[reservation.status]
  head.append(room, badge)

  const time = document.createElement('div')
  time.className = 'item-time'
  time.textContent = formatTime(reservation.scheduledAt)

  const body = document.createElement('div')
  body.className = 'item-body'
  body.textContent = reservation.body

  item.append(head, time, body)

  if (reservation.status === 'failed' && reservation.error) {
    const err = document.createElement('div')
    err.className = 'item-error'
    err.textContent = reservation.error
    item.appendChild(err)
  }

  const actions = document.createElement('div')
  actions.className = 'item-actions'

  if (reservation.status === 'pending') {
    const editBtn = document.createElement('button')
    editBtn.textContent = '編集'
    editBtn.addEventListener('click', () => startEdit(reservation))
    actions.appendChild(editBtn)
  }

  if (reservation.status !== 'sending') {
    const sendNowBtn = document.createElement('button')
    sendNowBtn.textContent = '今すぐ送信'
    sendNowBtn.addEventListener('click', () => {
      void send({
        type: 'reservation/sendNow',
        payload: { id: reservation.id },
      })
    })
    actions.appendChild(sendNowBtn)
  }

  const deleteBtn = document.createElement('button')
  deleteBtn.textContent = '削除'
  deleteBtn.addEventListener('click', () => {
    void send({ type: 'reservation/delete', payload: { id: reservation.id } })
    if (editingId === reservation.id) resetForm()
  })
  actions.appendChild(deleteBtn)

  item.appendChild(actions)
  return item
}

const renderList = async (): Promise<void> => {
  const raw = await chrome.storage.local.get('reservations')
  const reservations = (raw.reservations as Record<string, Reservation>) ?? {}
  const sorted = Object.values(reservations).sort(
    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt),
  )
  listEl.replaceChildren()
  if (sorted.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'status'
    empty.textContent = '予約はまだありません'
    listEl.appendChild(empty)
    return
  }
  for (const reservation of sorted) {
    listEl.appendChild(buildItem(reservation))
  }
}

// --- 初期化 ---

saveTokenBtn.addEventListener('click', () => void saveToken())
loadRoomsBtn.addEventListener('click', () => void loadRooms())
currentRoomBtn.addEventListener('click', () => void useCurrentRoom())
submitBtn.addEventListener('click', () => void submitForm())
cancelEditBtn.addEventListener('click', () => resetForm())

// 予約データの変更を購読してリストを再描画する（background が書き込み元）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.reservations) void renderList()
})

void renderList()
