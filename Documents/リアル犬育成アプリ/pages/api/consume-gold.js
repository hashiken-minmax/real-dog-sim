// /api/consume-gold.js
// ゴールドを消費する API（Canis Royal でのアイテム購入時）

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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
}
