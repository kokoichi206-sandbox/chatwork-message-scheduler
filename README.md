# Chatwork Message Scheduler

Chatwork のメッセージを指定した日時に自動送信できる Chrome 拡張機能です。
サイドパネルから予約しておけば、その時刻に自動で送信されます。

## 機能

- 日時を指定してメッセージを予約送信
- 送信先ルームを一覧から選択（今開いているルームはワンクリックで指定）
- 予約の一覧表示・編集・削除・今すぐ送信
- ブラウザや PC を再起動しても予約は保持

## 使い方

1. 拡張機能をインストール（読み込み方法は [CLAUDE.md](CLAUDE.md)）
2. [Chatwork の API トークン](https://www.chatwork.com/service/packages/chatwork/subpackages/api/token.php) を発行し、サイドパネルに設定
3. 送信先ルーム・日時・本文を指定して予約
4. 指定時刻に自動送信。予約状況はサイドパネルの一覧で確認できる

## 注意

- 送信は Chrome が起動している間だけ行われます。PC やブラウザを閉じている時刻の予約は、次に Chrome を起動したときに送信されます。
- 送信日時はお使いの端末のタイムゾーンで解釈されます。
- 利用には Chatwork の API トークンが必要です。

## 開発

[CLAUDE.md](CLAUDE.md) を参照してください。

## ライセンス

MIT
