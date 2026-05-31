// 状態遷移: pending -> sending -> sent / failed
// sending は claim 済みの一時状態。二重送信防止(mutex)とタイムアウト復旧のために存在する
type ReservationStatus = 'pending' | 'sending' | 'sent' | 'failed'

// 1件の予約。chrome.storage.local に永続化する唯一の真実源
type Reservation = {
  id: string // crypto.randomUUID()
  roomId: string // Chatwork の room_id。例: '405354226'
  roomName: string // 表示用。作成時に GET /rooms で解決した名前のスナップショット
  body: string // 送信本文。Chatwork 記法可。1〜65535 文字
  scheduledAt: string // 送信予定。ISO8601(オフセット付き)。例: '2026-06-01T15:30:00+09:00'
  status: ReservationStatus
  createdAt: string
  updatedAt: string

  // status に応じて埋まる補助フィールド
  claimedAt?: string // sending に入った時刻。タイムアウト復旧の判定に使う
  sentAt?: string
  sentMessageId?: string // 送信成功時に API が返す message_id（送信証跡）
  failedAt?: string
  error?: string // failed の理由（人間可読）
}

// アプリ設定。chrome.storage.local に保存
type Settings = {
  apiToken: string | null // Chatwork API トークン。ユーザーが入力。null = 未設定
  defaultSelfUnread: boolean // 送信時に自分を未読にするか(API の self_unread)
}

// chrome.storage.local 全体のスキーマ
type StorageSchema = {
  reservations: Record<string, Reservation> // id -> Reservation。O(1)更新・index race 回避
  settings: Settings
}

// ルーム選択UI用。GET /rooms のうち拡張で使うフィールドだけ抜き出す
type ChatworkRoom = {
  roomId: string
  name: string
  type: 'my' | 'direct' | 'group'
  role: 'admin' | 'member' | 'readonly'
}

export type {
  ReservationStatus,
  Reservation,
  Settings,
  StorageSchema,
  ChatworkRoom,
}
