# chatwork-message-scheduler

Chatwork のメッセージを予約送信する Chrome 拡張 (Manifest V3)。
サイドパネルで予約を作成し、指定時刻に Chatwork 公式 API で送信します。

## できること (Phase 1)

- API トークンの設定と疎通確認 (`GET /me`)
- 送信先ルームの選択 (`GET /rooms` の一覧、または開いている Chatwork タブの URL から取得)
- 予約の作成・編集・削除・「今すぐ送信」
- 予約時刻に自動送信 (`chrome.alarms` + 公式 API `POST /rooms/{room_id}/messages`)
- 予約データの永続化 (`chrome.storage.local`、ブラウザ再起動後も保持)
- 状態管理 (予約中 / 送信中 / 送信済み / 失敗) と失敗通知

## セットアップ

```
pnpm install
pnpm build        # dist/ を生成
```

Chrome で `chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択。
開発時は `pnpm dev` (CRXJS の HMR)。

### API トークン

[Chatwork の API トークン](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php)
を発行し、サイドパネルに貼り付けて「保存して確認」。

## 制約 (重要)

- **サーバー型ではない**: 送信は Chrome が起動している間だけ実行される。予約時刻に Chrome が
  落ちていた場合、次回起動時にまとめて送信される (遅延送信)。
- **時刻精度**: `chrome.alarms` の仕様上、秒単位ぴったりではなく、端末スリープ中は復帰まで
  発火しない。
- **タイムゾーン**: 送信日時は端末のローカルタイムゾーンで解釈される。
- **at-least-once**: 送信直後 (API 受理後・状態更新前) に Service Worker が強制終了すると、
  復旧時に再送され二重送信になる可能性がある。公式 API に冪等キーが無いため完全な
  exactly-once は保証できない。
- **API トークンの保存**: トークンは `chrome.storage.local` に平文保存される。端末上で拡張
  データにアクセスできる主体には読まれ得る。
- **送信方式**: 公式 API のみ。DOM 操作モードは不要と判断し非対応 (API トークンが使えるため)。

## 構成

- `src/shared/` — 型コントラクト (`types.ts`, `messages.ts`)
- `src/background/` — Service Worker。唯一の状態 writer。`mutex` で読み書きを直列化し、
  `store` の状態機械 (pending→sending→sent/failed) で二重送信を防ぐ。`scheduler` が alarms と
  送信を担い、`chatwork` が公式 API クライアント。
- `src/sidepanel/` — UI。`chrome.storage` を購読して表示し、変更は background へメッセージで依頼する。
