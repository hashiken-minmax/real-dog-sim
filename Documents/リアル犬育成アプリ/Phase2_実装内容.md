# Phase 2 実装内容：完成ファイル一覧

## 🎉 自動実装が完了しました！

ご覧いただいているこのフォルダに、以下のファイルが生成されました。

---

## 📁 ファイル一覧

### API 実装ファイル（4つ）

| ファイル | 説明 | 役割 |
|---------|------|------|
| `api_create-checkout-session.js` | Stripe 決済セッション作成 | ゲームの「購入」ボタン → Stripe決済ページへ遷移 |
| `api_webhook.js` | Stripe Webhook 処理 【最重要】 | 「決済完了通知」を受け取る → ゴールド付与 |
| `api_get-gold-balance.js` | ゴールド残高取得 | ゲーム画面がゴールド数を表示 |
| `api_consume-gold.js` | ゴールド消費 | Canis Royal でアイテム購入時にゴールドを減算 |

### ドキュメント

| ファイル | 説明 |
|---------|------|
| `PHASE2_SETUP_GUIDE.md` | セットアップ方法・統合手順（このガイドを読んでください！） |
| `Phase2_実装内容.md` | このファイル（概要説明） |

---

## 🚀 次のステップ（5ステップ、15〜20分）

### **STEP 1：ファイルを `/api` フォルダに配置**

現在のフォルダ構造：
```
リアル犬育成アプリ/
  ├── api_create-checkout-session.js
  ├── api_webhook.js
  ├── api_get-gold-balance.js
  ├── api_consume-gold.js    ← これらを /api フォルダに移動
  └── ...
```

目標フォルダ構造：
```
real-dog-sim/
  ├── api/
  │   ├── create-checkout-session.js
  │   ├── webhook.js
  │   ├── get-gold-balance.js
  │   └── consume-gold.js
  └── ...
```

**手順：**
1. プロジェクトルートに `/api` フォルダを作成
2. `api_*.js` ファイルを `/api` フォルダにコピー
3. ファイル名から「api_」を削除（例：`api_create-checkout-session.js` → `create-checkout-session.js`）

### **STEP 2：npm パッケージをインストール**

ターミナルで実行：
```bash
npm install stripe @supabase/supabase-js
```

### **STEP 3：GitHub にプッシュ**

```bash
git add .
git commit -m "Phase 2: Add backend APIs"
git push origin main
```

### **STEP 4：Vercel で自動デプロイを確認**

- Vercel ダッシュボード → Deployments
- ステータスが「Ready」 ✅ になるまで待つ（2〜5分）

### **STEP 5：テスト**

詳細は「`PHASE2_SETUP_GUIDE.md`」を参照

---

## 💡 各 API の動作原理

### `create-checkout-session.js`
```
ゲーム画面
  ↓ [購入ボタン押下]
  ↓ userId + priceId を送信
  ↓
Vercel API
  ↓ Stripe と通信
  ↓ チェックアウトセッション作成
  ↓
Stripe 決済ページ
  ↓ ユーザーがカード情報入力
  ↓ 決済実行
  ↓
Stripe（決済完了）
  ↓ Webhook で通知
```

### `webhook.js`（【最重要】ゴールド付与）
```
Stripe（決済完了）
  ↓ POST /api/webhook へ通知
  ↓
Vercel API（webhook.js）
  ↓ ①署名検証
  ↓ ②ユーザーID確認
  ↓ ③ゴールド数を計算
  ↓
Supabase
  ↓ gold_balances テーブルを更新
  ↓ purchase_history に記録
  ↓
✅ ゴール付与完了
  （ユーザーがブラウザを閉じてもここで処理されます）
```

### `get-gold-balance.js`
```
ゲーム画面
  ↓ ゴールド数を表示したい
  ↓ POST /api/get-gold-balance へ
  ↓
Vercel API
  ↓ Supabase に問い合わせ
  ↓
Supabase
  ↓ gold_balances テーブルから残高を取得
  ↓
ゲーム画面
  ↓ 残高を表示 ✅
```

### `consume-gold.js`
```
ゲーム画面（Canis Royal）
  ↓ [アイテム購入]
  ↓ userId + itemId + goldCost を送信
  ↓
Vercel API
  ↓ ①残高チェック
  ↓ ②不足なら エラー
  ↓ ③OK なら Supabase で減算
  ↓
Supabase
  ↓ balance を更新
  ↓ gold_transactions に記録
  ↓
ゲーム画面
  ↓ 「購入成功」と表示 ✅
```

---

## 🔐 セキュリティ

### ✅ 実装済み

- [x] 秘密鍵（STRIPE_SECRET_KEY、SUPABASE_SERVICE_ROLE_KEY）は Vercel 環境変数から読込
- [x] Stripe Webhook 署名検証（なりすまし防止）
- [x] ゴールド計算はサーバー側（API）のみ（クライアント側は読取専用）
- [x] 残高チェックでゴールド不足を防止
- [x] すべてのアクション（購入・消費）をログに記録（監査証跡）

---

## ❓ よくある質問

### Q1：このコードを自分で書いたの？
**A：** いいえ。Claude Code が自動生成しました。あなたがすることは、ファイルを配置して GitHub にプッシュするだけです。

### Q2：API の細かい部分を変更したい
**A：** 可能ですが、セキュリティ上の理由から、署名検証やサーバーサイド処理の変更はお勧めしません。詳しくは相談してください。

### Q3：エラーが出た場合は？
**A：** エラーメッセージを教えてください。一緒にデバッグします。

---

## 📞 次のアクション

1. **`PHASE2_SETUP_GUIDE.md` を読んでセットアップを進めてください**
2. セットアップ完了後、「完了しました」と連絡してください
3. テスト方法について詳しく説明します

**準備はいいですか？では `PHASE2_SETUP_GUIDE.md` を開いてください！** 🚀
