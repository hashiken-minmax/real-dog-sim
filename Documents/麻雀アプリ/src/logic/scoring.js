import { isTerminalOrHonor, isDragon, isWind, isSimple, isTerminal, tilesEqual, tileLabel, isGreen, tile } from './tiles';

function roundUpTo10(n) {
  return Math.ceil(n / 10) * 10;
}

function roundUpTo100(n) {
  return Math.ceil(n / 100) * 100;
}

// Determines if any tile in mentsu is terminal or honor
function mentsuHasTermOrHonor(m) {
  return m.tiles.some(t => isTerminalOrHonor(t));
}

function getPairFu(pairTile, env) {
  if (isDragon(pairTile)) return 2;
  if (isWind(pairTile)) {
    const isSeat = pairTile.num === env.seatWind;
    const isRound = pairTile.num === env.round;
    if (isSeat && isRound) return 4; // double wind
    if (isSeat || isRound) return 2;
  }
  return 0;
}

export function calculateFu(hand) {
  const { mentsu, pair, winTile, waitType, tsumo, environment, yaku } = hand;
  const isChiitoitsu = yaku && yaku.some(y => y.id === 'chiitoitsu');

  if (isChiitoitsu) {
    return { fu: 25, breakdown: ['七対子: 固定25符'] };
  }

  const breakdown = [];
  let fu = 20;
  breakdown.push('基本符: 20符');

  const isClosed = mentsu.every(m => !m.open);
  const hasPinfu = yaku && yaku.some(y => y.id === 'pinfu');

  if (!tsumo && isClosed && !hasPinfu) {
    fu += 10;
    breakdown.push('門前加符: 10符');
  }

  if (tsumo && !hasPinfu) {
    fu += 2;
    breakdown.push('ツモ: 2符');
  }

  for (const m of mentsu) {
    const termOrHonor = mentsuHasTermOrHonor(m);
    const isWinningKoutsu = m.type === 'tri' &&
      waitType === 'shanpon' &&
      m.tiles.some(t => tilesEqual(t, winTile));

    let mFu = 0;
    if (m.type === 'seq') {
      mFu = 0;
    } else if (m.type === 'tri') {
      if (isWinningKoutsu && !tsumo) {
        // Shanpon ron: treated as minkou
        mFu = termOrHonor ? 4 : 2;
        breakdown.push(`${m.tiles.map(tileLabel).join('')}(シャンポン明刻): ${mFu}符`);
      } else if (m.open) {
        mFu = termOrHonor ? 4 : 2;
        breakdown.push(`${m.tiles.map(tileLabel).join('')}(明刻): ${mFu}符`);
      } else {
        mFu = termOrHonor ? 8 : 4;
        breakdown.push(`${m.tiles.map(tileLabel).join('')}(暗刻): ${mFu}符`);
      }
    } else if (m.type === 'kan') {
      if (m.open) {
        mFu = termOrHonor ? 16 : 8;
        breakdown.push(`${m.tiles.map(tileLabel).join('')}(明槓): ${mFu}符`);
      } else {
        mFu = termOrHonor ? 32 : 16;
        breakdown.push(`${m.tiles.map(tileLabel).join('')}(暗槓): ${mFu}符`);
      }
    }
    fu += mFu;
  }

  const pairFu = getPairFu(pair, environment);
  if (pairFu > 0) {
    breakdown.push(`雀頭${tileLabel(pair)}(${pairFu === 4 ? 'ダブ東/西' : '役牌'}): ${pairFu}符`);
    fu += pairFu;
  }

  const waitFuMap = { kanchan: 2, penchan: 2, tanki: 2, ryanmen: 0, shanpon: 0 };
  const waitFuLabels = { kanchan: '嵌張待ち', penchan: '辺張待ち', tanki: '単騎待ち' };
  const waitFu = waitFuMap[waitType] || 0;
  if (waitFu > 0) {
    breakdown.push(`${waitFuLabels[waitType]}: ${waitFu}符`);
    fu += waitFu;
  }

  if (hasPinfu) {
    fu = tsumo ? 20 : 30;
    return { fu, breakdown: ['平和: ' + (tsumo ? '20符固定' : '30符固定')] };
  }

  const finalFu = roundUpTo10(fu);
  if (finalFu !== fu) {
    breakdown.push(`切り上げ: ${fu}符 → ${finalFu}符`);
  }

  return { fu: finalFu, breakdown };
}

export function calculateHan(hand) {
  const { mentsu, pair, winTile, waitType, tsumo, environment } = hand;
  const isClosed = mentsu.every(m => !m.open);
  const yaku = [];

  // Helper: all tiles in hand as array
  const allMentsuTiles = mentsu.flatMap(m => m.tiles);
  const allTiles = [...allMentsuTiles, pair, pair]; // pair appears twice

  // Riichi
  if (environment.riichi) {
    if (environment.doubleRiichi) {
      yaku.push({ id: 'double_riichi', name: 'ダブル立直', han: 2, closed: true });
    } else {
      yaku.push({ id: 'riichi', name: '立直', han: 1, closed: true });
    }
    if (environment.ippatsu) {
      yaku.push({ id: 'ippatsu', name: '一発', han: 1, closed: true });
    }
  }

  // Menzen tsumo
  if (tsumo && isClosed && !environment.rinshan) {
    yaku.push({ id: 'menzen_tsumo', name: '門前清自摸和', han: 1, closed: true });
  }

  // Rinshan
  if (environment.rinshan) {
    yaku.push({ id: 'rinshan', name: '嶺上開花', han: 1, closed: false });
  }

  // Haitei
  if (environment.haitei && tsumo) {
    yaku.push({ id: 'haitei', name: '海底撈月', han: 1, closed: false });
  }
  if (environment.houtei && !tsumo) {
    yaku.push({ id: 'houtei', name: '河底撈魚', han: 1, closed: false });
  }

  // Tanyao
  if (allTiles.every(t => isSimple(t))) {
    yaku.push({ id: 'tanyao', name: '断么九', han: 1, closed: false });
  }

  // Pinfu: all sequences, non-yakuhai pair, ryanmen wait
  if (isClosed && mentsu.every(m => m.type === 'seq')) {
    const pairIsYakuhai = isDragon(pair) ||
      pair.num === environment.seatWind || pair.num === environment.round;
    if (!pairIsYakuhai && waitType === 'ryanmen') {
      yaku.push({ id: 'pinfu', name: '平和', han: 1, closed: true });
    }
  }

  // Iipeiko: two identical sequences (closed)
  if (isClosed) {
    const seqs = mentsu.filter(m => m.type === 'seq');
    let hasIipeiko = false;
    let ipeikoCount = 0;
    const usedIdx = new Set();
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) {
        if (!usedIdx.has(i) && !usedIdx.has(j) &&
          seqs[i].tiles[0].suit === seqs[j].tiles[0].suit &&
          seqs[i].tiles[0].num === seqs[j].tiles[0].num) {
          ipeikoCount++;
          usedIdx.add(i);
          usedIdx.add(j);
        }
      }
    }
    if (ipeikoCount === 2) {
      yaku.push({ id: 'ryanpeikou', name: '二盃口', han: 3, closed: true });
    } else if (ipeikoCount === 1) {
      yaku.push({ id: 'iipeiko', name: '一盃口', han: 1, closed: true });
    }
  }

  // Yakuhai (honor triplets)
  for (const m of mentsu) {
    if (m.type === 'tri' || m.type === 'kan') {
      const t = m.tiles[0];
      if (isDragon(t)) {
        const dragonNames = { 5: '白', 6: '發', 7: '中' };
        yaku.push({ id: `yakuhai_${t.num}`, name: `役牌:${dragonNames[t.num]}`, han: 1, closed: false });
      } else if (t.suit === 'z' && t.num === environment.seatWind) {
        const windNames = { 1: '東', 2: '南', 3: '西', 4: '北' };
        yaku.push({ id: 'yakuhai_seat', name: `役牌:自風(${windNames[t.num]})`, han: 1, closed: false });
      } else if (t.suit === 'z' && t.num === environment.round) {
        const windNames = { 1: '東', 2: '南', 3: '西', 4: '北' };
        yaku.push({ id: 'yakuhai_round', name: `役牌:場風(${windNames[t.num]})`, han: 1, closed: false });
      }
    }
  }

  // Toitoi: all triplets
  if (mentsu.every(m => m.type === 'tri' || m.type === 'kan')) {
    yaku.push({ id: 'toitoi', name: '対々和', han: 2, closed: false });
  }

  // Chiitoitsu: 7 pairs (detected separately in generator)
  if (environment.isChiitoitsu) {
    yaku.push({ id: 'chiitoitsu', name: '七対子', han: 2, closed: true });
  }

  // Sanankou: three concealed triplets
  const concealedTri = mentsu.filter(m => {
    if (m.type !== 'tri' && m.type !== 'kan') return false;
    if (m.open) return false;
    // The koutsu completed by tsumo is still concealed
    // The koutsu completed by ron in shanpon is NOT concealed
    if (waitType === 'shanpon' && !tsumo && m.tiles.some(t => tilesEqual(t, winTile))) return false;
    return true;
  });
  if (concealedTri.length === 3 && mentsu.some(m => m.type === 'tri' || m.type === 'kan')) {
    yaku.push({ id: 'sanankou', name: '三暗刻', han: 2, closed: false });
  }

  // Sanshoku dojun: same sequence in all 3 suits
  const seqMentsu = mentsu.filter(m => m.type === 'seq');
  for (const s1 of seqMentsu) {
    if (s1.tiles[0].suit === 'm') {
      const startNum = s1.tiles[0].num;
      const hasPin = seqMentsu.some(m => m.tiles[0].suit === 'p' && m.tiles[0].num === startNum);
      const hasSou = seqMentsu.some(m => m.tiles[0].suit === 's' && m.tiles[0].num === startNum);
      if (hasPin && hasSou) {
        const hanVal = isClosed ? 2 : 1;
        yaku.push({ id: 'sanshoku_dojun', name: '三色同順', han: hanVal, closed: false });
        break;
      }
    }
  }

  // Sanshoku dokou: same triplet in all 3 suits
  const triMentsu = mentsu.filter(m => m.type === 'tri' || m.type === 'kan');
  for (const t1 of triMentsu) {
    if (t1.tiles[0].suit === 'm') {
      const num = t1.tiles[0].num;
      const hasPin = triMentsu.some(m => m.tiles[0].suit === 'p' && m.tiles[0].num === num);
      const hasSou = triMentsu.some(m => m.tiles[0].suit === 's' && m.tiles[0].num === num);
      if (hasPin && hasSou) {
        yaku.push({ id: 'sanshoku_dokou', name: '三色同刻', han: 2, closed: false });
        break;
      }
    }
  }

  // Ittsu: 1-2-3, 4-5-6, 7-8-9 same suit
  for (const suit of ['m', 'p', 's']) {
    const has123 = seqMentsu.some(m => m.tiles[0].suit === suit && m.tiles[0].num === 1);
    const has456 = seqMentsu.some(m => m.tiles[0].suit === suit && m.tiles[0].num === 4);
    const has789 = seqMentsu.some(m => m.tiles[0].suit === suit && m.tiles[0].num === 7);
    if (has123 && has456 && has789) {
      const hanVal = isClosed ? 2 : 1;
      yaku.push({ id: 'ittsu', name: '一気通貫', han: hanVal, closed: false });
      break;
    }
  }

  // Chanta: all sets contain terminal or honor
  const allHaveTermOrHonor =
    mentsu.every(m => m.tiles.some(t => isTerminalOrHonor(t))) &&
    isTerminalOrHonor(pair);
  const hasSequence = mentsu.some(m => m.type === 'seq');
  if (allHaveTermOrHonor && hasSequence) {
    const noHonors = allTiles.every(t => t.suit !== 'z');
    if (noHonors) {
      // Junchan: all sets contain terminal, no honors
      const hanVal = isClosed ? 3 : 2;
      yaku.push({ id: 'junchan', name: '純全帯么九', han: hanVal, closed: false });
    } else {
      // Chanta: all sets contain terminal or honor, with honors present
      const hanVal = isClosed ? 2 : 1;
      yaku.push({ id: 'chanta', name: '混全帯么九', han: hanVal, closed: false });
    }
  }

  // Honitsu: one suit + honors, not chinitsu
  const suits = new Set(allTiles.filter(t => t.suit !== 'z').map(t => t.suit));
  const hasHonors = allTiles.some(t => t.suit === 'z');
  if (suits.size === 1 && hasHonors) {
    const hanVal = isClosed ? 3 : 2;
    yaku.push({ id: 'honitsu', name: '混一色', han: hanVal, closed: false });
  }

  // Chinitsu: pure one suit
  if (suits.size === 1 && !hasHonors) {
    const hanVal = isClosed ? 6 : 5;
    yaku.push({ id: 'chinitsu', name: '清一色', han: hanVal, closed: false });
  }

  // Yakuman checks
  const yakumanList = [];

  // Tsuiso: all honors
  if (allTiles.every(t => t.suit === 'z')) {
    yakumanList.push({ id: 'tsuiso', name: '字一色', han: 13, closed: false });
  }

  // Chinroutou: all terminals
  if (allTiles.every(t => isTerminal(t))) {
    yakumanList.push({ id: 'chinroutou', name: '清老頭', han: 13, closed: false });
  }

  // Ryuuiisou: all green tiles
  if (allTiles.every(t => isGreen(t))) {
    yakumanList.push({ id: 'ryuuiisou', name: '緑一色', han: 13, closed: false });
  }

  // Daisangen: all 3 dragon triplets
  const dragonTri = mentsu.filter(m =>
    (m.type === 'tri' || m.type === 'kan') && isDragon(m.tiles[0]));
  if (dragonTri.length === 3) {
    yakumanList.push({ id: 'daisangen', name: '大三元', han: 13, closed: false });
  }

  // Suuankou: 4 concealed triplets
  const allConcealedTri = mentsu.filter(m => {
    if (m.type !== 'tri' && m.type !== 'kan') return false;
    if (m.open) return false;
    if (waitType === 'shanpon' && !tsumo && m.tiles.some(t => tilesEqual(t, winTile))) return false;
    return true;
  });
  if (allConcealedTri.length === 4) {
    yakumanList.push({ id: 'suuankou', name: '四暗刻', han: 13, closed: true });
  }

  // Daisuushi / Shosuushi
  const windTri = mentsu.filter(m =>
    (m.type === 'tri' || m.type === 'kan') && isWind(m.tiles[0]));
  if (windTri.length === 4) {
    yakumanList.push({ id: 'daisuushi', name: '大四喜', han: 26, closed: false });
  } else if (windTri.length === 3 && isWind(pair)) {
    yakumanList.push({ id: 'shosuushi', name: '小四喜', han: 13, closed: false });
  }

  if (yakumanList.length > 0) {
    return { yaku: yakumanList, isYakuman: true, totalHan: yakumanList[0].han };
  }

  if (yaku.length === 0) {
    // No yaku (shouldn't happen in valid generated hands, but fallback)
    yaku.push({ id: 'riichi', name: '立直', han: 1, closed: true });
  }

  const totalHan = yaku.reduce((sum, y) => sum + y.han, 0);

  // Dora
  const doraCount = countDora(allTiles, environment.dora || []);
  if (doraCount > 0) {
    yaku.push({ id: 'dora', name: `ドラ${doraCount}`, han: doraCount, closed: false });
  }
  const uraDoraCount = environment.riichi ?
    countDora(allTiles, environment.uraDora || []) : 0;
  if (uraDoraCount > 0) {
    yaku.push({ id: 'ura_dora', name: `裏ドラ${uraDoraCount}`, han: uraDoraCount, closed: false });
  }

  const finalHan = yaku.reduce((sum, y) => sum + y.han, 0);
  return { yaku, isYakuman: false, totalHan: finalHan };
}

function countDora(tiles, doraIndicators) {
  let count = 0;
  for (const indicator of doraIndicators) {
    const dora = doraFromIndicator(indicator);
    count += tiles.filter(t => tilesEqual(t, dora)).length;
  }
  return count;
}

function doraFromIndicator(indicator) {
  if (indicator.suit === 'z') {
    if (indicator.num <= 4) {
      return tile('z', indicator.num === 4 ? 1 : indicator.num + 1); // winds cycle
    } else {
      return tile('z', indicator.num === 7 ? 5 : indicator.num + 1); // dragons cycle
    }
  }
  return tile(indicator.suit, indicator.num === 9 ? 1 : indicator.num + 1);
}

export function calculateScore(fu, han, isDealer, tsumo, gameMode, isYakuman) {
  const numOtherPlayers = gameMode === 3 ? 2 : 3;

  // Yakuman
  if (isYakuman || han >= 13) {
    if (isDealer) {
      if (tsumo) {
        const payment = 16000;
        return { total: payment * numOtherPlayers, payments: { ko: payment }, rank: '役満' };
      } else {
        return { total: 48000, payments: { ron: 48000 }, rank: '役満' };
      }
    } else {
      if (tsumo) {
        const oyaPayment = 16000;
        const koPayment = gameMode === 3 ? 16000 : 8000;
        const total = oyaPayment + koPayment * (gameMode === 3 ? 1 : 2);
        return { total, payments: { oya: oyaPayment, ko: koPayment }, rank: '役満' };
      } else {
        return { total: 32000, payments: { ron: 32000 }, rank: '役満' };
      }
    }
  }

  const getRank = (h, f) => {
    if (h >= 11) return '三倍満';
    if (h >= 8) return '倍満';
    if (h >= 6) return '跳満';
    if (h >= 5) return '満貫';
    if (h === 4 && f >= 30) return '満貫';
    if (h === 3 && f >= 70) return '満貫';
    return null;
  };

  const rank = getRank(han, fu);

  const manganPayments = {
    dealer_ron: 12000,
    dealer_tsumo: 4000,
    ko_ron: 8000,
    ko_tsumo_oya: 4000,
    ko_tsumo_ko: 2000,
  };

  const multiplier = rank === '跳満' ? 1.5 : rank === '倍満' ? 2 : rank === '三倍満' ? 3 : 1;

  if (rank) {
    if (isDealer) {
      if (tsumo) {
        const payment = manganPayments.dealer_tsumo * multiplier;
        return { total: payment * numOtherPlayers, payments: { ko: payment }, rank };
      } else {
        const total = manganPayments.dealer_ron * multiplier;
        return { total, payments: { ron: total }, rank };
      }
    } else {
      if (tsumo) {
        const oyaPayment = manganPayments.ko_tsumo_oya * multiplier;
        const koPayment = gameMode === 3 ? oyaPayment : manganPayments.ko_tsumo_ko * multiplier;
        const total = oyaPayment + koPayment * (gameMode === 3 ? 1 : 2);
        return { total, payments: { oya: oyaPayment, ko: koPayment }, rank };
      } else {
        const total = manganPayments.ko_ron * multiplier;
        return { total, payments: { ron: total }, rank };
      }
    }
  }

  // Normal calculation
  const basicPoints = fu * Math.pow(2, han + 2);

  if (isDealer) {
    if (tsumo) {
      const payment = roundUpTo100(basicPoints * 2);
      return { total: payment * numOtherPlayers, payments: { ko: payment }, rank: null };
    } else {
      const total = roundUpTo100(basicPoints * 6);
      return { total, payments: { ron: total }, rank: null };
    }
  } else {
    if (tsumo) {
      const oyaPayment = roundUpTo100(basicPoints * 2);
      const koPayment = gameMode === 3 ? oyaPayment : roundUpTo100(basicPoints);
      const total = oyaPayment + koPayment * (gameMode === 3 ? 1 : 2);
      return { total, payments: { oya: oyaPayment, ko: koPayment }, rank: null };
    } else {
      const total = roundUpTo100(basicPoints * 4);
      return { total, payments: { ron: total }, rank: null };
    }
  }
}
