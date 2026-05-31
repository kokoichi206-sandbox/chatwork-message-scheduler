import type { Result } from '../shared/messages'
import type { ChatworkRoom } from '../shared/types'

const API_BASE = 'https://api.chatwork.com/v2'

type Me = { accountId: number; name: string }
type SendResult = { messageId: string }

// HTTP ステータスを人間可読なエラー文に変換する
const describeError = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '')
  if (res.status === 401 || res.status === 403)
    return 'APIトークンが無効か、権限がありません'
  if (res.status === 429)
    return 'レート制限に達しました。時間をおいて再試行してください'
  if (res.status === 404) return 'ルームが見つかりません'
  const detail = text ? ` ${text.slice(0, 200)}` : ''
  return `APIエラー: ${res.status} ${res.statusText}${detail}`
}

const verifyToken = async (token: string): Promise<Result<Me>> => {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'X-ChatWorkToken': token },
    })
    if (!res.ok) return { ok: false, error: await describeError(res) }
    const data = (await res.json()) as { account_id: number; name: string }
    return { ok: true, data: { accountId: data.account_id, name: data.name } }
  } catch (e) {
    return { ok: false, error: `通信エラー: ${String(e)}` }
  }
}

const listRooms = async (token: string): Promise<Result<ChatworkRoom[]>> => {
  try {
    const res = await fetch(`${API_BASE}/rooms`, {
      headers: { 'X-ChatWorkToken': token },
    })
    if (!res.ok) return { ok: false, error: await describeError(res) }
    const data = (await res.json()) as Array<{
      room_id: number
      name: string
      type: ChatworkRoom['type']
      role: ChatworkRoom['role']
    }>
    const rooms: ChatworkRoom[] = data.map((r) => ({
      roomId: String(r.room_id),
      name: r.name,
      type: r.type,
      role: r.role,
    }))
    return { ok: true, data: rooms }
  } catch (e) {
    return { ok: false, error: `通信エラー: ${String(e)}` }
  }
}

const sendMessage = async (
  token: string,
  roomId: string,
  body: string,
  selfUnread: boolean,
): Promise<Result<SendResult>> => {
  try {
    const res = await fetch(`${API_BASE}/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { 'X-ChatWorkToken': token },
      body: new URLSearchParams({
        body,
        self_unread: selfUnread ? '1' : '0',
      }),
    })
    if (!res.ok) return { ok: false, error: await describeError(res) }
    const data = (await res.json()) as { message_id: number | string }
    return { ok: true, data: { messageId: String(data.message_id) } }
  } catch (e) {
    return { ok: false, error: `通信エラー: ${String(e)}` }
  }
}

export { verifyToken, listRooms, sendMessage }
