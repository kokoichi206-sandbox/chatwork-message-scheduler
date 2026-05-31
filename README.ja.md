# Chatwork Message Scheduler

_[English](./README.md) | [日本語](./README.ja.md)_

> Chatwork のメッセージを、指定した日時に自動送信する Chrome 拡張機能。サイドパネルから
> 予約しておけば、その時刻に自動で送られます。

<!-- デモ GIF をここに置きます: docs/demo.gif -->

![demo](docs/demo.gif)

## 機能

- 日時を指定してメッセージを予約送信
- 送信先ルームを一覧から選択（今開いているルームはワンクリックで指定）
- 予約の一覧表示・編集・削除・今すぐ送信
- ブラウザや PC を再起動しても予約は保持

## 導入

```sh
pnpm install
pnpm build
```

`chrome://extensions` を開き、**デベロッパーモード**を ON →「**パッケージ化されていない拡張機能を読み込む**」→ `dist` フォルダを選択。

## 使い方

1. 拡張機能アイコンからサイドパネルを開く。
2. [Chatwork の API トークン](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php) を発行し、サイドパネルに設定。
3. 送信先ルーム・日時・本文を指定して予約。
4. 指定時刻に自動送信。状態はサイドパネルの一覧で確認できる。

<!-- サイドパネルのスクリーンショットをここに: docs/sidepanel.png -->

![side panel](docs/sidepanel.png)

## 注意

- 送信は Chrome が起動している間だけ行われます。PC やブラウザを閉じている時刻の予約は、次に Chrome を起動したときに送信されます。
- 送信日時はお使いの端末のタイムゾーンで解釈されます。
- 利用には Chatwork の API トークンが必要です。

## 開発者向け

[CLAUDE.md](./CLAUDE.md) を参照してください。

## ライセンス

[MIT](./LICENSE) © 2026 kokoichi206
