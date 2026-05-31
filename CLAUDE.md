# 開発メモ

コードや設定ファイルを読めば分かることは書かない。ここには「読んでも分からないこと」だけを残す。

## 拡張の読み込み・更新

- 読み込むのは `pnpm build` で生成される `dist/`。`chrome://extensions` → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」で `dist/` を選ぶ。
- コードを変えたら `pnpm build` し直し、拡張カードの **リロード（🔄）をクリック**する。
- とくに **background（Service Worker）や manifest を変えたときはカードのリロードが必須**。サイドパネルを開き直すだけでは Service Worker は更新されない。
- ログは2か所を見る: 拡張カードの「Service Worker」リンク（background の console）と、サイドパネルを右クリック→検証（UI の console）。

## 設計上の不変条件（壊さない）

- **`chrome.storage` への書き込みは background だけ**が行う。サイドパネルは読み取り（+ `onChanged` 購読）に徹し、変更は background へメッセージで依頼する。これが二重送信防止の前提。
- 送信処理は mutex で直列化する。`pending → sending` への遷移（claim）は必ずロック内で「状態」と「予約時刻の到来」を再確認してから行う。ここを緩めると alarm 発火・起動時キャッチアップ・今すぐ送信が競合して二重送信になる。
- 送信は Chatwork 公式 API のみ。DOM 操作モードは不要と判断して持たない（API トークンが使えるため）。

## 受容済みの制約（仕様。直そうとしない）

- サーバー型ではない。送信は Chrome 起動中のみで、未起動のまま過ぎた予約は次回起動時に送られる。
- 送信直後（API 受理後・状態更新前）に Service Worker が強制終了されると、復旧時に再送されうる（at-least-once）。公式 API に冪等キーが無いため exactly-once は実現できない。閾値と in-flight 集合で頻度を下げているだけ。

## ビルド環境の落とし穴

- pnpm 10 は依存のビルドスクリプトを既定でブロックする。`vite` が使う `esbuild` のネイティブバイナリ取得もブロックされ `vite build` が壊れるため、`package.json` の `pnpm.onlyBuiltDependencies` で `esbuild` を明示的に許可している。これを外すと動かなくなる。
