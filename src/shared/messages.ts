import type { Reservation } from './types'

// 作成時に panel が渡す入力。id/status/createdAt 等は background が補う
type NewReservationInput = {
  roomId: string
  roomName: string
  body: string
  scheduledAt: string
}

// 編集可能なフィールド。status === 'pending' の予約のみ更新可
type ReservationPatch = Partial<
  Pick<Reservation, 'roomId' | 'roomName' | 'body' | 'scheduledAt'>
>

// サイドパネル → background のリクエスト(discriminated union)
// 状態の書き込みは必ず background を経由する(単一 writer)
type BackgroundRequest =
  | { type: 'reservation/create'; payload: NewReservationInput }
  | {
      type: 'reservation/update'
      payload: { id: string; patch: ReservationPatch }
    }
  | { type: 'reservation/delete'; payload: { id: string } }
  | { type: 'reservation/sendNow'; payload: { id: string } }
  | { type: 'rooms/list' } // GET /rooms 経由でルーム一覧
  | { type: 'rooms/currentTab' } // アクティブタブの URL から room_id を取得
  | { type: 'settings/setToken'; payload: { apiToken: string } }
  | { type: 'auth/verify' } // GET /me で疎通確認

// background → panel の応答。成功 or 失敗を必ず明示する(握りつぶさない)
type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type { NewReservationInput, ReservationPatch, BackgroundRequest, Result }
