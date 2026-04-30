# 麻雀点数計算アプリ - デプロイ手順

## セットアップと公開手順

### 1. Expo アカウントの作成（初回のみ）
- [Expo.dev](https://expo.dev/) にアクセスして無料アカウントを作成

### 2. EAS CLI でログイン
```bash
npx eas-cli@latest login
```
- プロンプトに従って、メールアドレスとパスワードを入力

### 3. プロジェクトを EAS に登録
```bash
npx eas-cli@latest build --platform android --type preview
```

> 注意: 初回実行時は、プロジェクト登録の確認が表示されます。"Yes" を選択してください。

### 4. ビルド完了を待機
- ビルドプロセスが開始され、QR コードと URL が表示されます
- ビルド完了には数分かかります

### 5. 共有可能な URL を取得
ビルド完了後、以下の URL で アプリにアクセス可能です：
```
https://expo.dev/@<username>/<project-slug>
```

## 直接リンク共有方法

### Expo Go で直接開く
ビルド完了後、以下の形式で共有可能：
```
exp://u.expo.dev/<uuid>
```

### QR コード
```bash
npx eas-cli@latest build --platform android
```
実行時に表示される QR コードをスキャンして、Expo Go でアプリをインストール可能。

## アップデート後の再デプロイ

アプリを更新して公開する場合：
```bash
# バージョン更新
npm version patch

# 再度ビルド
npx eas-cli@latest build --platform android --type preview
```

## トラブルシューティング

### ログインエラーが出た場合
```bash
npx eas-cli@latest logout
npx eas-cli@latest login
```

### キャッシュをクリア
```bash
npx expo prebuild --clean
```

## 注記
- Android APK は無料で作成・公開可能
- iOS ビルドは有料プランが必要
- ビルド時間は通常 5〜15 分程度

---

**公開後の URL 例:**
```
https://expo.dev/@hashiken/mahjong-score-practice
```
