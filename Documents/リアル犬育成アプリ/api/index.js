// Express.js サーバー - Vercel Serverless Functions
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Supabase クライアント初期化
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ミドルウェア
app.use(express.json());

// ===== API エンドポイント =====

// GET /api/get-gold-balance - ゴールド残高取得
app.post('/api/get-gold-balance', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const { data, error } = await supabase
      .from('gold_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const balance = data?.balance || 0;
    return res.status(200).json({ balance });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Failed to get gold balance' });
  }
});

// POST /api/consume-gold - ゴール消費
app.post('/api/consume-gold', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, itemId, goldCost } = req.body;

  if (!userId || !itemId || !goldCost) {
    return res.status(400).json({ error: 'userId, itemId, and goldCost are required' });
  }

  try {
    // 現在の残高を確認
    const { data: balanceData } = await supabase
      .from('gold_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    const currentBalance = balanceData?.balance || 0;

    // 残高チェック
    if (currentBalance < goldCost) {
      return res.status(400).json({ error: 'Insufficient gold balance' });
    }

    // ゴールドを減算
    const newBalance = currentBalance - goldCost;
    await supabase
      .from('gold_balances')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    // トランザクションログを記録
    await supabase.from('gold_transactions').insert({
      user_id: userId,
      amount: goldCost,
      type: 'consume',
      item_id: itemId,
    });

    return res.status(200).json({ success: true, newBalance });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Failed to consume gold' });
  }
});

// POST /api/create-checkout-session - Stripe チェックアウトセッション作成
app.post('/api/create-checkout-session', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, priceId } = req.body;

  if (!userId || !priceId) {
    return res.status(400).json({ error: 'userId and priceId are required' });
  }

  try {
    // Stripe のチェックアウトセッションを作成
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata: {
        userId: userId,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/webhook - Stripe Webhook
app.post('/api/webhook', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = req.body;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 決済完了イベントの処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const goldAmount = calculateGoldAmount(session.amount_total);

    try {
      // ユーザーのゴールド残高を更新
      const { data: existingBalance } = await supabase
        .from('gold_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      const newBalance = (existingBalance?.balance || 0) + goldAmount;

      await supabase
        .from('gold_balances')
        .upsert({ user_id: userId, balance: newBalance }, { onConflict: 'user_id' });

      // 購入履歴を記録
      await supabase.from('purchase_history').insert({
        user_id: userId,
        price_id: session.amount_total.toString(),
        gold_amount: goldAmount,
        stripe_payment_id: session.payment_intent,
      });

      console.log(`✅ Gold granted to ${userId}: +${goldAmount} Gold`);
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to grant gold' });
    }
  }

  return res.status(200).json({ received: true });
});

// ===== ヘルスチェック =====
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API is running' });
});

// ===== ヘルパー関数 =====
function calculateGoldAmount(amountInCents) {
  // 価格ごとのゴールド数を計算
  const priceMapping = {
    10000: 1000,        // 100円 = 1000G
    50000: 6000,        // 500円 = 6000G
    100000: 12000,      // 1000円 = 12000G
    1000000: 180000,    // 10000円 = 180000G
  };
  return priceMapping[amountInCents] || 0;
}

// ===== サーバー起動 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
});

// Vercel Serverless Function として export
module.exports = app;
