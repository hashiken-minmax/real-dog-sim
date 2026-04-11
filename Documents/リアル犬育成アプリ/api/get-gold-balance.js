// /api/get-gold-balance.js
// ゴールド所持数を取得する API

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
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
};
