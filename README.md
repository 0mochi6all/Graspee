# StressLog Web版

Android版 StressLog（`../app`）を機能そのままにWebへ移植したもの。
Vite + React + TypeScript の静的SPAで、サーバ不要・データはすべてブラウザ内（IndexedDB）に保存される。

## 起動方法

```powershell
cd web
npm install
npm run dev     # → http://localhost:5173 を Chrome で開く
```

- テスト: `npm test`（domain層のKotlin版とのパリティ検証）
- 本番ビルド: `npm run build`（`dist/` に出力）

Windowsでダブルクリック起動したい場合は [`open-stresslog.ps1`](open-stresslog.ps1) にショートカットを張るとよい。開発サーバーが起動していなければ自動起動し、`http://localhost:5173` をブラウザで開く。

## Android版との対応関係

| Android (Kotlin) | Web (TypeScript) |
|---|---|
| `domain/StressCalculator.kt` ほかドメイン4クラス | `src/domain/` （純関数として1:1移植、vitestで検証済み） |
| Room (`stresslog.db` 3テーブル) | Dexie/IndexedDB (`src/data/db.ts`) |
| DataStore 設定 | localStorage (`src/data/settings.ts`) |
| WorkManager 定期サンプリング | `src/work/samplingLoop.ts`（タブが開いている間の setInterval） |
| 通知 (NotificationManager) | Web Notifications API (`src/work/notifier.ts`) |
| `data/ble/PressureBleClient.kt` | Web Bluetooth (`src/data/ble/pressureBleClient.ts`) |
| Compose Canvas チャート7種 | HTML5 Canvas (`src/ui/common/`) |
| 6タブ + 記録詳細画面 | `src/ui/{home,records,analysis,advice,settings,sensor,moments}/` |

## センサータブ（Web Bluetooth）

- **ブラウザから実機ESP32（StressLog-PS）に直接BLE接続できる**。Android実機は不要
- 対応ブラウザ: **デスクトップ版 Chrome / Edge のみ**（Firefox・Safari・iOSは非対応）
- HTTPS または localhost でのみ動作（`npm run dev` の localhost はOK）
- GATT仕様は `../docs/BLE_PRESSURE.md` が唯一の正

## Webならではの制約

- **タブを閉じている間はサンプリングが停止する**（バックグラウンド実行不可）。
  タブ復帰時に設定間隔以上経過していれば1回だけ即サンプリングする
- データはブラウザ・プロファイル単位（シークレットモードでは消える）。
  起動時に `navigator.storage.persist()` で永続化を要求している
- 動作確認用に「設定 → 今すぐサンプル」ボタンと `?tab=analysis` のような初期タブ指定がある

## デプロイ（任意）

静的ホスティング（GitHub Pages等、HTTPS必須）にそのまま置ける。
サブパス配信の場合は `vite.config.ts` に `base: '/リポジトリ名/'` を追加して `npm run build`。
