import { tile, tilesEqual, isDragon, isWind } from './tiles';
import { calculateFu, calculateHan, calculateScore } from './scoring';

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function seq(suit, start) {
  return {
    type: 'seq',
    open: false,
    tiles: [tile(suit, start), tile(suit, start + 1), tile(suit, start + 2)],
  };
}

function tri(t, open = false) {
  return { type: 'tri', open, tiles: [t, t, t] };
}

function kan(t, open = false) {
  return { type: 'kan', open, tiles: [t, t, t, t] };
}

// Random sequence in a suit (valid starts: 1-7)
function randSeq(suit) {
  const start = randInt(1, 7);
  return seq(suit, start);
}

// Random simple sequence (2-8 only, start 2-6)
function randSimpleSeq(suit) {
  const start = randInt(2, 6);
  return seq(suit, start);
}

// Random simple tile (num 2-8)
function randSimpleTile(suit) {
  return tile(suit, randInt(2, 8));
}

// Random suit from given list
function randSuit(suits = ['m', 'p', 's']) {
  return rand(suits);
}

// Generate random dora indicator
function randDora(gameMode) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const suit = randSuit(suits);
  const num = randInt(1, 9);
  return tile(suit, num);
}

// Generate random environment
function randEnvironment(gameMode, opts = {}) {
  const suitPool = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const round = rand([1, 2]);
  const seatWind = randInt(1, gameMode === 3 ? 3 : 4);
  const riichi = opts.forceRiichi !== undefined ? opts.forceRiichi : Math.random() > 0.5;
  const tsumo = Math.random() > 0.4;
  const haitei = !riichi && tsumo && Math.random() > 0.8;
  const houtei = !riichi && !tsumo && Math.random() > 0.8;
  const rinshan = !riichi && !haitei && !houtei && Math.random() > 0.85;

  const numDora = randInt(0, 2);
  const dora = Array.from({ length: numDora }, () => randDora(gameMode));
  const uraDora = riichi ? Array.from({ length: randInt(0, 2) }, () => randDora(gameMode)) : [];

  return {
    round,
    seatWind,
    riichi,
    ippatsu: riichi && Math.random() > 0.7,
    doubleRiichi: riichi && Math.random() > 0.8,
    tsumo,
    rinshan,
    haitei,
    houtei,
    dora,
    uraDora,
    isDealer: seatWind === 1,
    gameMode,
    isChiitoitsu: false,
  };
}

// Determine wait type for a given hand decomposition
function getWaitInfo(mentsu, pair, winTile) {
  // Check each mentsu to see if winTile could be the completing tile
  for (const m of mentsu) {
    if (m.type === 'seq') {
      const [a, b, c] = m.tiles;
      // Ryanmen: win tile is at either end, with valid other end
      if (tilesEqual(a, winTile) && b.num > 2) return 'ryanmen'; // wait on a and c
      if (tilesEqual(c, winTile) && b.num < 8) return 'ryanmen';
      // Penchan: 1-2-3 winning on 3, or 7-8-9 winning on 7
      if (tilesEqual(a, winTile) && a.num === 1) return 'penchan';
      if (tilesEqual(c, winTile) && c.num === 9) return 'penchan';
      // Kanchan: middle tile
      if (tilesEqual(b, winTile)) return 'kanchan';
    }
    if (m.type === 'tri') {
      if (m.tiles.some(t => tilesEqual(t, winTile))) return 'shanpon';
    }
  }
  // Tanki: pair
  if (tilesEqual(pair, winTile)) return 'tanki';
  return 'ryanmen'; // fallback
}

// Hand recipe functions - each returns a hand object or null

function makeTanyaoHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const mentsu = [];
  const openCount = env.riichi ? 0 : randInt(0, 2);

  for (let i = 0; i < 4; i++) {
    const suit = randSuit(suits);
    if (Math.random() > 0.5) {
      mentsu.push({ ...randSimpleSeq(suit), open: i < openCount });
    } else {
      const t = randSimpleTile(suit);
      mentsu.push({ type: 'tri', open: i < openCount, tiles: [t, t, t] });
    }
  }

  const pairSuit = randSuit(suits);
  const pair = randSimpleTile(pairSuit);

  // Choose win tile from hand
  const seqs = mentsu.filter(m => m.type === 'seq');
  let winTile, waitType;
  if (seqs.length > 0) {
    const s = rand(seqs);
    // Ryanmen wait
    if (Math.random() > 0.5 && s.tiles[0].num <= 7) {
      winTile = s.tiles[0]; waitType = 'ryanmen';
    } else if (s.tiles[2].num >= 1) {
      winTile = s.tiles[2]; waitType = 'ryanmen';
    } else {
      winTile = pair; waitType = 'tanki';
    }
  } else {
    winTile = pair; waitType = 'tanki';
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeYakuhaiHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const mentsu = [];

  // Choose a yakuhai tile (dragon or wind)
  let yakuhaiTile;
  const yakuhaiType = rand(['dragon', 'dragon', 'wind']);
  if (yakuhaiType === 'dragon') {
    yakuhaiTile = tile('z', randInt(5, 7));
  } else {
    // seat or round wind
    yakuhaiTile = tile('z', rand([env.seatWind, env.round]));
  }

  const openYakuhai = !env.riichi;
  mentsu.push({ type: 'tri', open: openYakuhai, tiles: [yakuhaiTile, yakuhaiTile, yakuhaiTile] });

  // Fill remaining 3 mentsu
  for (let i = 0; i < 3; i++) {
    const suit = randSuit(suits);
    if (Math.random() > 0.4) {
      mentsu.push({ ...randSeq(suit), open: false });
    } else {
      const t = tile(suit, randInt(1, 9));
      mentsu.push({ type: 'tri', open: false, tiles: [t, t, t] });
    }
  }

  const pairSuit = randSuit(suits);
  const pairNum = randInt(1, 9);
  const pair = tile(pairSuit, pairNum);

  // Win tile: from a sequence (ryanmen) or tanki
  const seqs = mentsu.filter(m => m.type === 'seq');
  let winTile, waitType;
  if (seqs.length > 0) {
    const s = rand(seqs);
    winTile = rand([s.tiles[0], s.tiles[2]]);
    waitType = 'ryanmen';
  } else {
    winTile = pair; waitType = 'tanki';
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makePinfuHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  env = { ...env, riichi: true }; // Pinfu usually with riichi

  const mentsu = [];
  for (let i = 0; i < 4; i++) {
    mentsu.push({ ...randSeq(randSuit(suits)), open: false });
  }

  // Non-yakuhai pair
  const pairSuit = randSuit(suits);
  const pair = tile(pairSuit, randInt(2, 8)); // simple pair to avoid yakuhai

  // Ryanmen wait
  const lastSeq = mentsu[3];
  const winTile = Math.random() > 0.5 ? lastSeq.tiles[0] : lastSeq.tiles[2];
  const waitType = 'ryanmen';

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeToitoiHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const openCount = env.riichi ? 0 : randInt(1, 3);
  const mentsu = [];

  for (let i = 0; i < 4; i++) {
    const suit = Math.random() > 0.7 ? 'z' : randSuit(suits);
    let t;
    if (suit === 'z') {
      t = tile('z', randInt(1, 7));
    } else {
      t = tile(suit, randInt(1, 9));
    }
    mentsu.push({ type: 'tri', open: i < openCount, tiles: [t, t, t] });
  }

  const pairSuit = randSuit(suits);
  const pair = tile(pairSuit, randInt(1, 9));

  // Shanpon or tanki wait
  const waitType = Math.random() > 0.5 ? 'shanpon' : 'tanki';
  let winTile;
  if (waitType === 'shanpon') {
    winTile = mentsu[3].tiles[0];
  } else {
    winTile = pair;
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeChiitoisuHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  env = { ...env, riichi: true, isChiitoitsu: true };

  const usedTiles = new Set();
  const pairs = [];
  while (pairs.length < 7) {
    const suit = Math.random() > 0.3 ? randSuit(suits) : 'z';
    const num = suit === 'z' ? randInt(1, 7) : randInt(1, 9);
    const key = `${suit}${num}`;
    if (!usedTiles.has(key)) {
      usedTiles.add(key);
      pairs.push(tile(suit, num));
    }
  }

  const winTile = pairs[6];
  const pair = pairs[6];

  // Represent as mentsu-like structure for display
  const mentsu = pairs.slice(0, 6).map(t => ({
    type: 'pair_display', open: false, tiles: [t, t],
  }));

  return {
    mentsu,
    pair,
    winTile,
    waitType: 'tanki',
    tsumo: env.tsumo,
    environment: env,
    chiitoitsuPairs: pairs,
    isChiitoitsu: true,
  };
}

function makeHonitsuHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const suit = randSuit(suits);
  const openCount = env.riichi ? 0 : randInt(0, 2);
  const mentsu = [];

  // Mix of suit sequences/triplets and honor triplets
  for (let i = 0; i < 4; i++) {
    if (Math.random() > 0.5 && mentsu.filter(m => m.tiles[0].suit === 'z').length < 2) {
      const t = tile('z', randInt(1, 7));
      mentsu.push({ type: 'tri', open: i < openCount, tiles: [t, t, t] });
    } else if (Math.random() > 0.4) {
      mentsu.push({ ...randSeq(suit), open: i < openCount });
    } else {
      const t = tile(suit, randInt(1, 9));
      mentsu.push({ type: 'tri', open: i < openCount, tiles: [t, t, t] });
    }
  }

  const pairTile = Math.random() > 0.5 ? tile(suit, randInt(1, 9)) : tile('z', randInt(1, 7));
  const pair = pairTile;

  const seqs = mentsu.filter(m => m.type === 'seq');
  let winTile, waitType;
  if (seqs.length > 0 && !env.riichi) {
    winTile = rand([seqs[0].tiles[0], seqs[0].tiles[2]]);
    waitType = 'ryanmen';
  } else if (seqs.length > 0) {
    winTile = rand([seqs[0].tiles[0], seqs[0].tiles[2]]);
    waitType = 'ryanmen';
  } else {
    winTile = pair; waitType = 'tanki';
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeChiitsuHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const suit = randSuit(suits);
  env = { ...env, riichi: Math.random() > 0.3 };
  const openCount = env.riichi ? 0 : randInt(0, 1);
  const mentsu = [];

  for (let i = 0; i < 4; i++) {
    if (Math.random() > 0.5) {
      mentsu.push({ ...randSeq(suit), open: i < openCount });
    } else {
      const t = tile(suit, randInt(1, 9));
      mentsu.push({ type: 'tri', open: i < openCount, tiles: [t, t, t] });
    }
  }

  const pair = tile(suit, randInt(1, 9));
  const seqs = mentsu.filter(m => m.type === 'seq');
  let winTile, waitType;
  if (seqs.length > 0) {
    winTile = rand([seqs[0].tiles[0], seqs[0].tiles[2]]);
    waitType = 'ryanmen';
  } else {
    winTile = pair; waitType = 'tanki';
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeIttusuHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const itsuSuit = randSuit(suits);
  const openCount = env.riichi ? 0 : randInt(0, 1);

  const mentsu = [
    { ...seq(itsuSuit, 1), open: false },
    { ...seq(itsuSuit, 4), open: openCount >= 1 },
    { ...seq(itsuSuit, 7), open: openCount >= 2 },
  ];

  // 4th mentsu
  const suit4 = randSuit(suits);
  if (Math.random() > 0.5) {
    mentsu.push({ ...randSeq(suit4), open: false });
  } else {
    const t = tile(suit4, randInt(2, 8));
    mentsu.push({ type: 'tri', open: false, tiles: [t, t, t] });
  }

  const pairSuit = randSuit(suits);
  const pair = tile(pairSuit, randInt(1, 9));

  const lastSeq = mentsu[2];
  const winTile = rand([lastSeq.tiles[0], lastSeq.tiles[2]]);
  const waitType = 'ryanmen';

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeSanshokuHand(gameMode, env) {
  const startNum = randInt(1, 7);
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  const openCount = env.riichi ? 0 : randInt(0, 2);

  const mentsu = [
    { ...seq('m', startNum), open: openCount >= 1 && gameMode !== 3 },
    { ...seq('p', startNum), open: openCount >= 2 },
    { ...seq('s', startNum), open: openCount >= 3 },
  ];

  // 4th mentsu
  const suit4 = randSuit(suits);
  if (Math.random() > 0.5) {
    mentsu.push({ ...randSeq(suit4), open: false });
  } else {
    const t = tile(suit4, randInt(2, 8));
    mentsu.push({ type: 'tri', open: false, tiles: [t, t, t] });
  }

  const pairSuit = randSuit(suits);
  const pair = tile(pairSuit, randInt(2, 8));

  const lastSeq = mentsu[3];
  let winTile, waitType;
  if (lastSeq.type === 'seq') {
    winTile = rand([lastSeq.tiles[0], lastSeq.tiles[2]]);
    waitType = 'ryanmen';
  } else {
    winTile = pair; waitType = 'tanki';
  }

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeSuuankouHand(gameMode, env) {
  const suits = gameMode === 3 ? ['p', 's'] : ['m', 'p', 's'];
  env = { ...env, tsumo: true, riichi: false };
  const mentsu = [];

  for (let i = 0; i < 4; i++) {
    const suit = Math.random() > 0.5 ? randSuit(suits) : 'z';
    const t = suit === 'z' ? tile('z', randInt(1, 7)) : tile(suit, randInt(1, 9));
    mentsu.push({ type: 'tri', open: false, tiles: [t, t, t] });
  }

  const pairSuit = randSuit(suits);
  const pair = tile(pairSuit, randInt(1, 9));
  const winTile = pair; // tanki
  const waitType = 'tanki';

  return { mentsu, pair, winTile, waitType, tsumo: true, environment: env };
}

function makeTsuisoHand(env) {
  env = { ...env, riichi: false };
  const tiles7z = [1, 2, 3, 4, 5, 6, 7].map(n => tile('z', n));
  const shuffle = [...tiles7z].sort(() => Math.random() - 0.5);
  const triTiles = shuffle.slice(0, 4);
  const pairTile = shuffle[4];

  const mentsu = triTiles.map(t => ({ type: 'tri', open: false, tiles: [t, t, t] }));
  const pair = pairTile;
  const winTile = pair;
  const waitType = 'tanki';

  return { mentsu, pair, winTile, waitType, tsumo: env.tsumo, environment: env };
}

function makeChinroutouHand(env) {
  env = { ...env, riichi: false };
  const termTiles = [];
  for (const suit of ['m', 'p', 's']) {
    termTiles.push(tile(suit, 1), tile(suit, 9));
  }
  const shuffle = [...termTiles].sort(() => Math.random() - 0.5);

  const mentsu = [
    { type: 'tri', open: false, tiles: [shuffle[0], shuffle[0], shuffle[0]] },
    { type: 'tri', open: false, tiles: [shuffle[1], shuffle[1], shuffle[1]] },
    { type: 'tri', open: false, tiles: [shuffle[2], shuffle[2], shuffle[2]] },
    { type: 'tri', open: false, tiles: [shuffle[3], shuffle[3], shuffle[3]] },
  ];
  const pair = shuffle[4];
  const winTile = pair;

  return { mentsu, pair, winTile, waitType: 'tanki', tsumo: env.tsumo, environment: env };
}

const RECIPES = [
  { name: 'tanyao', fn: makeTanyaoHand, weight: 20, modes: [3, 4] },
  { name: 'yakuhai', fn: makeYakuhaiHand, weight: 15, modes: [3, 4] },
  { name: 'pinfu', fn: makePinfuHand, weight: 15, modes: [3, 4] },
  { name: 'toitoi', fn: makeToitoiHand, weight: 10, modes: [3, 4] },
  { name: 'chiitoitsu', fn: makeChiitoitsuHand, weight: 8, modes: [3, 4] },
  { name: 'honitsu', fn: makeHonitsuHand, weight: 8, modes: [3, 4] },
  { name: 'chiitsu', fn: makeChiitsuHand, weight: 8, modes: [3, 4] },
  { name: 'ittsu', fn: makeIttusuHand, weight: 6, modes: [3, 4] },
  { name: 'sanshoku', fn: makeSanshokuHand, weight: 6, modes: [4] }, // man tiles needed
  { name: 'suuankou', fn: makeSuuankouHand, weight: 2, modes: [3, 4] },
  { name: 'tsuiso', fn: (gm, env) => makeTsuisoHand(env), weight: 1, modes: [3, 4] },
  { name: 'chinroutou', fn: (gm, env) => makeChinroutouHand(env), weight: 1, modes: [3, 4] },
];

function pickRecipe(gameMode) {
  const available = RECIPES.filter(r => r.modes.includes(gameMode));
  const totalWeight = available.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const r of available) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return available[0];
}

export function generateQuestion(gameMode) {
  const env = randEnvironment(gameMode);
  const recipe = pickRecipe(gameMode);

  let hand;
  try {
    hand = recipe.fn(gameMode, { ...env });
  } catch {
    hand = makeTanyaoHand(gameMode, env);
  }

  // Set isChiitoitsu flag in environment
  if (hand.isChiitoitsu) {
    hand.environment = { ...hand.environment, isChiitoitsu: true };
  }

  // Calculate correct answer
  const yakuResult = calculateHan(hand);
  const fuResult = calculateFu({ ...hand, yaku: yakuResult.yaku });
  const fu = fuResult.fu;
  const han = yakuResult.totalHan;
  const isDealer = hand.environment.seatWind === 1;
  const scoreResult = calculateScore(
    fu, han, isDealer, hand.tsumo, gameMode, yakuResult.isYakuman
  );

  return {
    hand,
    answer: {
      fu,
      han,
      fuBreakdown: fuResult.breakdown,
      yaku: yakuResult.yaku,
      isYakuman: yakuResult.isYakuman,
      scoreResult,
      isDealer,
    },
  };
}
