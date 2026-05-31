import { defineConfig } from 'vite'
import { crx, defineManifest } from '@crxjs/vite-plugin'

const manifest = defineManifest({
  manifest_version: 3,
  name: 'Chatwork Message Scheduler',
  description: 'Chatwork のメッセージを予約送信する',
  version: '0.0.1',
  // side panel は Chrome 114 以降
  minimum_chrome_version: '114',
  icons: {
    16: 'public/icons/16.png',
    48: 'public/icons/48.png',
    128: 'public/icons/128.png',
  },
  // storage: 予約/設定の永続化, alarms: 予約時刻の発火,
  // sidePanel: メインUI, notifications: 送信失敗の通知
  permissions: ['storage', 'alarms', 'sidePanel', 'notifications'],
  // api: メッセージ送信, www: 開いてるタブのURLから room_id 取得
  host_permissions: [
    'https://api.chatwork.com/*',
    'https://www.chatwork.com/*',
  ],
  action: {
    default_title: 'Chatwork Message Scheduler',
    default_icon: {
      16: 'public/icons/16.png',
      48: 'public/icons/48.png',
      128: 'public/icons/128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})

export default defineConfig({
  base: './',
  plugins: [crx({ manifest })],
})
