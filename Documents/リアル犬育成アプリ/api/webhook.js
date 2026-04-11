// /api/webhook.js
// Stripe からの Webhook 通知を処理し、ゴールドを付与する 【最重要】

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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
}

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
