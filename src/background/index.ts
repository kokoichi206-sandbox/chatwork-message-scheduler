import type { BackgroundRequest, Result } from '../shared/messages'
import * as chatwork from './chatwork'
import * as scheduler from './scheduler'
import * as store from './store'

// アクションアイコンのクリックでサイドパネルを開く
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('setPanelBehavior failed', err))

// 起動・更新時に整合を取る（未送信のキャッチアップ・alarm 再構築）
chrome.runtime.onStartup.addListener(() => {
  scheduler.reconcile().catch((e) => console.error('reconcile failed', e))
})
chrome.runtime.onInstalled.addListener(() => {
  scheduler.reconcile().catch((e) => console.error('reconcile failed', e))
})

// 予約時刻の発火。発火 id ではなく「期限到来分すべて」を流す
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!scheduler.reservationIdFromAlarm(alarm.name)) return
  scheduler.drainDue().catch((e) => console.error('drain failed', e))
})

// アクティブな Chatwork タブの URL から room_id を取り出す
const roomIdFromActiveTab = async (): Promise<string | null> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const matched = tab?.url?.match(/#!rid(\d+)/)
  return matched?.[1] ?? null
}

const handleRequest = async (
  message: BackgroundRequest,
): Promise<Result<unknown>> => {
  switch (message.type) {
    case 'reservation/create': {
      const reservation = await store.createReservation(message.payload)
      scheduler.scheduleAlarm(reservation)
      return { ok: true, data: reservation }
    }
    case 'reservation/update': {
      const reservation = await store.updateReservation(
        message.payload.id,
        message.payload.patch,
      )
      await scheduler.clearAlarm(reservation.id)
      scheduler.scheduleAlarm(reservation)
      return { ok: true, data: reservation }
    }
    case 'reservation/delete': {
      await scheduler.clearAlarm(message.payload.id)
      await store.deleteReservation(message.payload.id)
      return { ok: true, data: null }
    }
    case 'reservation/sendNow': {
      await scheduler.sendNow(message.payload.id)
      return { ok: true, data: null }
    }
    case 'rooms/list': {
      const settings = await store.getSettings()
      if (!settings.apiToken)
        return { ok: false, error: 'APIトークンが未設定です' }
      return await chatwork.listRooms(settings.apiToken)
    }
    case 'rooms/currentTab': {
      const roomId = await roomIdFromActiveTab()
      if (!roomId)
        return {
          ok: false,
          error: 'アクティブなタブが Chatwork のルームではありません',
        }
      const settings = await store.getSettings()
      let name = `ルーム ${roomId}`
      if (settings.apiToken) {
        const rooms = await chatwork.listRooms(settings.apiToken)
        if (rooms.ok) {
          const found = rooms.data.find((r) => r.roomId === roomId)
          if (found) name = found.name
        }
      }
      return { ok: true, data: { roomId, name } }
    }
    case 'settings/setToken': {
      const settings = await store.setSettings({
        apiToken: message.payload.apiToken,
      })
      return { ok: true, data: { hasToken: settings.apiToken !== null } }
    }
    case 'auth/verify': {
      const settings = await store.getSettings()
      if (!settings.apiToken)
        return { ok: false, error: 'APIトークンが未設定です' }
      return await chatwork.verifyToken(settings.apiToken)
    }
    default: {
      // 全 type を網羅していることをコンパイル時に保証する
      const exhaustive: never = message
      return { ok: false, error: `未知のリクエスト: ${String(exhaustive)}` }
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: BackgroundRequest, _sender, sendResponse) => {
    handleRequest(message)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e) }))
    // 非同期で応答するため true を返す
    return true
  },
)
