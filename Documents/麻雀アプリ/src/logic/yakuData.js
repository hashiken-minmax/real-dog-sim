// yaku data based on mahjong_yaku.md
export const yakuData = {
  // 1飜役
  menzen_tsumo: { name: '門前清自摸和', han_menzen: 1, han_naki: null, menzen_only: true },
  riichi: { name: '立直', han_menzen: 1, han_naki: null, menzen_only: true },
  ippatsu: { name: '一発', han_menzen: 1, han_naki: null, menzen_only: true },
  tanyao: { name: '断么九', han_menzen: 1, han_naki: 1, menzen_only: false },
  pinfu: { name: '平和', han_menzen: 1, han_naki: null, menzen_only: true },
  iipeiko: { name: '一盃口', han_menzen: 1, han_naki: null, menzen_only: true },
  yakuhai_dragon: { name: '役牌', han_menzen: 1, han_naki: 1, menzen_only: false },
  yakuhai_wind: { name: '役牌', han_menzen: 1, han_naki: 1, menzen_only: false },
  chankan: { name: '槍槓', han_menzen: 1, han_naki: 1, menzen_only: false },
  rinshan: { name: '嶺上開花', han_menzen: 1, han_naki: 1, menzen_only: false },
  haitei: { name: '海底撈月', han_menzen: 1, han_naki: 1, menzen_only: false },
  houtei: { name: '河底撈魚', han_menzen: 1, han_naki: 1, menzen_only: false },

  // 2飜役
  double_riichi: { name: 'ダブル立直', han_menzen: 2, han_naki: null, menzen_only: true },
  toitoi: { name: '対々和', han_menzen: 2, han_naki: 2, menzen_only: false },
  chiitoitsu: { name: '七対子', han_menzen: 2, han_naki: null, menzen_only: true },
  sanankou: { name: '三暗刻', han_menzen: 2, han_naki: 2, menzen_only: false },
  sanshoku_dojun_closed: { name: '三色同順', han_menzen: 2, han_naki: 1, menzen_only: false },
  sanshoku_dokou: { name: '三色同刻', han_menzen: 2, han_naki: 2, menzen_only: false },
  ryanpeikou: { name: '二盃口', han_menzen: 3, han_naki: null, menzen_only: true },

  // 3飜役
  sanshoku_dojun_open: { name: '三色同順', han_menzen: 2, han_naki: 1, menzen_only: false },
  ittsu_closed: { name: '一気通貫', han_menzen: 2, han_naki: 1, menzen_only: false },
  chanta_closed: { name: '混全帯么九', han_menzen: 2, han_naki: 1, menzen_only: false },
  junchan_closed: { name: '純全帯么九', han_menzen: 3, han_naki: 2, menzen_only: false },
  honitsu_closed: { name: '混一色', han_menzen: 3, han_naki: 2, menzen_only: false },

  // 6飜役
  chinitsu_closed: { name: '清一色', han_menzen: 6, han_naki: 5, menzen_only: false },

  // 役満
  tsuiso: { name: '字一色', han_menzen: 13, han_naki: 13, menzen_only: false },
  chinroutou: { name: '清老頭', han_menzen: 13, han_naki: 13, menzen_only: false },
  ryuuiisou: { name: '緑一色', han_menzen: 13, han_naki: 13, menzen_only: false },
  daisangen: { name: '大三元', han_menzen: 13, han_naki: 13, menzen_only: false },
  suuankou: { name: '四暗刻', han_menzen: 13, han_naki: null, menzen_only: true },
  daisuushi: { name: '大四喜', han_menzen: 26, han_naki: 26, menzen_only: false },
  shosuushi: { name: '小四喜', han_menzen: 13, han_naki: 13, menzen_only: false },
};

export function getYakuHan(yakuId, isMenzen) {
  const yaku = yakuData[yakuId];
  if (!yaku) return null;
  return isMenzen ? yaku.han_menzen : yaku.han_naki;
}
