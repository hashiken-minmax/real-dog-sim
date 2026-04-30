// Tile: { suit: 'm'|'p'|'s'|'z', num: 1-9 }
// z-tiles: 1=East, 2=South, 3=West, 4=North, 5=Haku, 6=Hatsu, 7=Chun

export function tile(suit, num) {
  return { suit, num };
}

export function tilesEqual(a, b) {
  return a.suit === b.suit && a.num === b.num;
}

export function tileKey(t) {
  return `${t.suit}${t.num}`;
}

export function isSimple(t) {
  return (t.suit === 'm' || t.suit === 'p' || t.suit === 's') &&
    t.num >= 2 && t.num <= 8;
}

export function isTerminal(t) {
  return (t.suit === 'm' || t.suit === 'p' || t.suit === 's') &&
    (t.num === 1 || t.num === 9);
}

export function isHonor(t) {
  return t.suit === 'z';
}

export function isTerminalOrHonor(t) {
  return isTerminal(t) || isHonor(t);
}

export function isDragon(t) {
  return t.suit === 'z' && t.num >= 5;
}

export function isWind(t) {
  return t.suit === 'z' && t.num <= 4;
}

export function isGreen(t) {
  if (t.suit === 's') return [2, 3, 4, 6, 8].includes(t.num);
  if (t.suit === 'z') return t.num === 6; // Hatsu
  return false;
}

export function tileLabel(t) {
  if (t.suit === 'm') return `${t.num}m`;
  if (t.suit === 'p') return `${t.num}p`;
  if (t.suit === 's') return `${t.num}s`;
  const zLabels = { 1: '東', 2: '南', 3: '西', 4: '北', 5: '白', 6: '發', 7: '中' };
  return zLabels[t.num] || '?';
}

export function tileEmoji(t) {
  if (t.suit === 'm') return String.fromCodePoint(0x1F007 + t.num - 1);
  if (t.suit === 's') return String.fromCodePoint(0x1F010 + t.num - 1);
  if (t.suit === 'p') return String.fromCodePoint(0x1F019 + t.num - 1);
  if (t.suit === 'z') {
    const zMap = { 1: 0x1F000, 2: 0x1F001, 3: 0x1F002, 4: 0x1F003,
                   5: 0x1F006, 6: 0x1F005, 7: 0x1F004 };
    return String.fromCodePoint(zMap[t.num]);
  }
  return '?';
}

export function windLabel(windNum) {
  return ['東', '南', '西', '北'][windNum - 1] || '?';
}

export function roundLabel(roundNum) {
  return roundNum === 1 ? '東場' : '南場';
}

// All tiles for 4-player mahjong
export function allTiles4p() {
  const tiles = [];
  for (const suit of ['m', 'p', 's']) {
    for (let num = 1; num <= 9; num++) {
      tiles.push(tile(suit, num));
    }
  }
  for (let num = 1; num <= 7; num++) {
    tiles.push(tile('z', num));
  }
  return tiles;
}

// All tiles for 3-player mahjong (no 2-8 of man)
export function allTiles3p() {
  const tiles = [];
  for (let num = 1; num <= 9; num++) {
    if (num === 1 || num === 9) tiles.push(tile('m', num));
  }
  for (const suit of ['p', 's']) {
    for (let num = 1; num <= 9; num++) {
      tiles.push(tile(suit, num));
    }
  }
  for (let num = 1; num <= 7; num++) {
    tiles.push(tile('z', num));
  }
  return tiles;
}

export function mentsuLabel(m) {
  const tl = m.tiles.map(tileLabel).join('');
  const openMark = m.open ? '（開）' : '';
  if (m.type === 'seq') return `順子[${tl}]${openMark}`;
  if (m.type === 'tri') return `刻子[${tl}]${openMark}`;
  if (m.type === 'kan') return `槓子[${tl}]${openMark}`;
  return tl;
}

export function mentsuEmoji(m) {
  return m.tiles.map(tileEmoji).join('');
}
