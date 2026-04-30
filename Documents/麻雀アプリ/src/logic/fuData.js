// Fu calculation data based on fu_calculation.md
export const fuCalculationRules = {
  // Basic points (基礎点)
  tsumo_basic: 20,
  ron_naki_basic: 20,
  ron_menzen_basic: 30,

  // Pair fu (頭の符)
  pair: {
    simple: 0, // 数牌2-8
    terminal_honor: 0, // 1・9牌、字牌（役牌以外）
    yakuhai: 2, // 役牌（三元牌、場風、自風）
    double_wind: 4, // 連風牌（場風＝自風）
  },

  // Mentsu fu (面子の符)
  mentsu: {
    sequence: 0, // 順子 - 0符 always
    minkou_simple: 2, // 明刻 - 数牌2-8
    minkou_terminal: 4, // 明刻 - 1・9牌・字牌
    ankou_simple: 4, // 暗刻 - 数牌2-8
    ankou_terminal: 8, // 暗刻 - 1・9牌・字牌
    minkan_simple: 8, // 明槓 - 数牌2-8
    minkan_terminal: 16, // 明槓 - 1・9牌・字牌
    ankan_simple: 16, // 暗槓 - 数牌2-8
    ankan_terminal: 32, // 暗槓 - 1・9牌・字牌
  },

  // Wait fu (待ち符)
  wait: {
    ryanmen_ron: 0, // 両面待ち - ロン
    ryanmen_tsumo: 2, // 両面待ち - ツモ
    shanpon_ron: 0, // シャンポン待ち - ロン
    shanpon_tsumo: 2, // シャンポン待ち - ツモ
    kanchan_ron: 2, // 嵌張待ち - ロン
    kanchan_tsumo: 4, // 嵌張待ち - ツモ
    penchan_ron: 2, // 辺張待ち - ロン
    penchan_tsumo: 4, // 辺張待ち - ツモ
    tanki_ron: 2, // 単騎待ち - ロン
    tanki_tsumo: 4, // 単騎待ち - ツモ
  },

  // Special cases (固定符)
  special: {
    pinfu_tsumo: 20, // 平和ツモ - 20符固定
    pinfu_ron_naki: 30, // 鳴き平和形でのロン - 30符固定
    chiitoitsu: 25, // 七対子 - 25符固定
  },
};

export function calculateFuBreakdown(hand) {
  const { mentsu, pair, winTile, waitType, tsumo, environment, yaku, isSimple } = hand;
  const breakdown = [];

  // Check for special cases
  const isChiitoitsu = yaku && yaku.some(y => y.id === 'chiitoitsu');
  if (isChiitoitsu) {
    return { fu: 25, breakdown: ['七対子: 固定25符'] };
  }

  const hasPinfu = yaku && yaku.some(y => y.id === 'pinfu');
  if (hasPinfu) {
    const fu = tsumo ? 20 : 30;
    return { fu, breakdown: [`平和: ${tsumo ? '20符固定' : '30符固定'}`] };
  }

  // Regular calculation
  let fu = tsumo ?
    fuCalculationRules.tsumo_basic :
    fuCalculationRules.ron_menzen_basic;

  breakdown.push(`基本符: ${fu}符`);

  // Handle open menzu
  const isClosed = mentsu.every(m => !m.open);
  if (!tsumo && isClosed && !hasPinfu) {
    fu += 10;
    breakdown.push('門前加符: 10符');
  }

  // Pair fu
  const pairFu = calculatePairFu(pair, environment);
  if (pairFu > 0) {
    breakdown.push(`雀頭: ${pairFu}符`);
    fu += pairFu;
  }

  // Mentsu fu
  for (const m of mentsu) {
    const mFu = calculateMentsuFu(m, winTile, waitType, tsumo);
    if (mFu > 0) {
      breakdown.push(`面子: ${mFu}符`);
      fu += mFu;
    }
  }

  // Wait fu
  const waitFu = calculateWaitFu(waitType, tsumo);
  if (waitFu > 0) {
    const waitLabel = {
      kanchan: '嵌張待ち',
      penchan: '辺張待ち',
      tanki: '単騎待ち',
    };
    breakdown.push(`${waitLabel[waitType] || ''}: ${waitFu}符`);
    fu += waitFu;
  }

  // Round up to 10
  const finalFu = Math.ceil(fu / 10) * 10;
  if (finalFu !== fu) {
    breakdown.push(`切り上げ: ${fu}符 → ${finalFu}符`);
  }

  return { fu: finalFu, breakdown };
}

function calculatePairFu(pair, environment) {
  const isDragon = pair.suit === 'z' && pair.num >= 5;
  const isWind = pair.suit === 'z' && pair.num <= 4;

  if (isDragon) return fuCalculationRules.pair.yakuhai;

  if (isWind) {
    const isSeat = pair.num === environment.seatWind;
    const isRound = pair.num === environment.round;
    if (isSeat && isRound) return fuCalculationRules.pair.double_wind;
    if (isSeat || isRound) return fuCalculationRules.pair.yakuhai;
  }

  return fuCalculationRules.pair.simple;
}

function calculateMentsuFu(m, winTile, waitType, tsumo) {
  if (m.type === 'seq') return 0;

  const isTerminal = m.tiles[0].num === 1 || m.tiles[0].num === 9 || m.tiles[0].suit === 'z';
  const isWinningKoutsu = m.type === 'tri' && waitType === 'shanpon' &&
    m.tiles.some(t => t.suit === winTile.suit && t.num === winTile.num);

  if (m.type === 'tri') {
    if (isWinningKoutsu && !tsumo) {
      return isTerminal ? fuCalculationRules.mentsu.minkou_terminal : fuCalculationRules.mentsu.minkou_simple;
    } else if (m.open) {
      return isTerminal ? fuCalculationRules.mentsu.minkou_terminal : fuCalculationRules.mentsu.minkou_simple;
    } else {
      return isTerminal ? fuCalculationRules.mentsu.ankou_terminal : fuCalculationRules.mentsu.ankou_simple;
    }
  } else if (m.type === 'kan') {
    if (m.open) {
      return isTerminal ? fuCalculationRules.mentsu.minkan_terminal : fuCalculationRules.mentsu.minkan_simple;
    } else {
      return isTerminal ? fuCalculationRules.mentsu.ankan_terminal : fuCalculationRules.mentsu.ankan_simple;
    }
  }

  return 0;
}

function calculateWaitFu(waitType, tsumo) {
  const rules = fuCalculationRules.wait;
  if (waitType === 'ryanmen') return tsumo ? rules.ryanmen_tsumo : rules.ryanmen_ron;
  if (waitType === 'shanpon') return tsumo ? rules.shanpon_tsumo : rules.shanpon_ron;
  if (waitType === 'kanchan') return tsumo ? rules.kanchan_tsumo : rules.kanchan_ron;
  if (waitType === 'penchan') return tsumo ? rules.penchan_tsumo : rules.penchan_ron;
  if (waitType === 'tanki') return tsumo ? rules.tanki_tsumo : rules.tanki_ron;
  return 0;
}
