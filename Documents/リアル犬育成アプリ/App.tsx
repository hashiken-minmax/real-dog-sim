/**
 * リアル犬育成シミュレーター v11
 *
 * 変更点 (v10) — 大会実行システム（Contest Execution System）
 *  1. 大会実行ロジック: 30日サイクルの月初（日数 % 30 === 0）にエントリー済み大会を自動実行
 *  2. フィジカルコンテスト: 規律×0.3 + 速度×0.3 + スタミナ×0.2 + バネ×0.2 × 覚醒バフ × 誠実性ボーナス
 *  3. ビューティーコンテスト: 毛並み×6 + 愛嬌×4 + スタイル×5 × 幸運乗数
 *  4. ライバル5頭のスコアを動的生成し順位決定（1位で tournamentWins++）
 *  5. 賞金テーブル: 1位1000 / 2位400 / 3位150 / 4位50 / 5位20 / 6位10 コイン
 *  6. 大会結果カード: 順位表・スコア・賞金・実績ボーナス更新表示
 *
 * 旧変更点 (v8〜v9):
 *  v8: 性別・家族・交流システム（番・子犬・NPC犬ミートアップ）
 *  v9: 設定画面・図鑑（コレクション）画面・大会エントリーUI
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, TextInput, SafeAreaView, Platform, Animated,
  Image, ImageBackground,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// ─────────────────────────────────────────────
// SoundManager (Web Audio Helper)
// ─────────────────────────────────────────────
const SoundManager = {
  _bgm: null as HTMLAudioElement | null,
  _bgmSrc: null as any,

  /** require()の結果(数値/オブジェクト/文字列)をURLに変換する */
  _resolveUri(src: any): string {
    if (typeof src === 'string') return src;
    // Expo web: require()がオブジェクトを返す場合はuriプロパティを使用
    if (src && typeof src === 'object' && src.uri) return src.uri;
    // Metro web: require()が数値を返す場合はAssetシステム経由
    if (typeof src === 'number') {
      try {
        // expo-assetが利用可能な場合
        const Asset = require('expo-asset').Asset;
        const asset = Asset.fromModule(src);
        return asset.uri ?? asset.localUri ?? String(src);
      } catch (_e) {
        return String(src);
      }
    }
    return String(src);
  },

  playBgm(src: any, volume: number): void {
    if (typeof window === 'undefined') return;
    const vol = Math.max(0, Math.min(1, volume / 100));
    if (this._bgmSrc === src && this._bgm && !this._bgm.paused) {
      this._bgm.volume = vol;
      return;
    }
    this.stopBgm();
    try {
      const uri = this._resolveUri(src);
      const a = new (window as any).Audio(uri);
      a.loop = true;
      a.volume = vol;
      a.play().catch(() => {});
      this._bgm = a;
      this._bgmSrc = src;
    } catch(_e) {}
  },

  stopBgm(): void {
    if (this._bgm) {
      this._bgm.pause();
      this._bgm.currentTime = 0;
      this._bgm = null;
    }
    this._bgmSrc = null;
  },

  setBgmVolume(volume: number): void {
    if (this._bgm) this._bgm.volume = Math.max(0, Math.min(1, volume / 100));
  },

  playSfx(src: any, volume: number): void {
    if (typeof window === 'undefined') return;
    try {
      const uri = this._resolveUri(src);
      const a = new (window as any).Audio(uri);
      a.volume = Math.max(0, Math.min(1, volume / 100));
      a.play().catch(() => {});
    } catch(_e) {}
  },
};

// BGM / SFX ファイルパス
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_TOP: any         = require('./Sounds/Top_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_PUPPY: any       = require('./Sounds/Mein_Puppy_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_ADULT: any       = require('./Sounds/Mein_Adult_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_SENIOR: any      = require('./Sounds/Mein_Senior_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_WALK: any        = require('./Sounds/Stroll_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_CONTEST_TOP: any = require('./Sounds/Contest_top_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_PHYSICAL: any    = require('./Sounds/Contest_fisical_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_BEAUTY: any      = require('./Sounds/Contest_beauty_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_NOSEWORK: any    = require('./Sounds/Contest_nosework_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_RESULT: any      = require('./Sounds/Contest_top_bgm_1.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_DEATH1: any      = require('./Sounds/Dog passing away_bgm_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_BGM_DEATH2: any      = require('./Sounds/Dog passing away_bgm_1.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_SFX_BUTTON: any      = require('./Sounds/button_system_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_SFX_BUFF: any        = require('./Sounds/buffs_system_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_SFX_DEBUFF: any      = require('./Sounds/debuffs_system_0.mp3');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SND_SFX_COIN: any        = require('./Sounds/coin_system_0.mp3');

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface BigFive {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

// ─────────────────────────────────────────────
// 能力値インターフェース（v6）
// ─────────────────────────────────────────────

/** フィジカル能力 — すべて 0〜1000 */
interface PhysicalStats {
  discipline: number;   // 規律
  speed:      number;   // スピード
  stamina:    number;   // スタミナ（現在値、上限は DogState.maxStamina）
  spring:     number;   // バネ
  focus:      number;   // 集中力（ミニゲーム判定枠・ノーズワーク）
}

/** ビューティー能力 — 0〜100 */
interface BeautyStats {
  coat:  number;   // 毛並み
  charm: number;   // 愛嬌
}

/** 全能力値セット */
interface AbilityStats {
  physical:     PhysicalStats;
  intelligence: number;   // 知性 0〜1000
  beauty:       BeautyStats;
  luck:         number;   // 幸運 0〜100 (初期値 50)
}

/** 親犬の記録（繁殖計算用） */
interface LineageRecord {
  generation:          number;
  name:                string;
  gender?:             Gender;
  tournamentWins:      number;
  tournamentPlacements?: number;
  abilities:           AbilityStats;
  peakAbilities?:      AbilityStats;
  satoriBonuses?:      string[];
}

/** アイテムのステータス補正型（装備時に合算される） */
type ItemBonuses = Partial<{
  beauty_coat:  number;   // 毛並み
  beauty_charm: number;   // 愛嬌
  luck:         number;   // 幸運
  discipline:   number;   // 規律
  speed:        number;   // スピード
  stamina:      number;   // スタミナ
  spring:       number;   // バネ
  focus:        number;   // 集中力
  intelligence: number;   // 知性
  style:        number;   // 着こなしへの追加貢献
  maxStamina:   number;   // スタミナ最大値（装備・アイテム直接上昇用）
  lifespan:     number;   // 寿命ボーナス（装備中）
  cognition:    number;   // 認知能力ボーナス（装備中）
}>;

/** Legendaryアイテムの特殊効果種別 */
type LegendaryEffect =
  | 'lifespan_decay_0.95'       // 寿命減少速度×0.95
  | 'cognition_decay_0.95'      // 認知低下速度×0.95
  | 'physical_contest_1.05'     // フィジカルコンテスト×1.05
  | 'beauty_contest_1.05'       // ビューティーコンテスト×1.05
  | 'hunger_rate_0.50'          // 空腹増加速度×0.50
  | 'dirt_bladder_rate_0.50';   // 汚れ・排泄増加速度×0.50

/** ショップ商品 */
interface ShopItem {
  id:              string;
  name:            string;
  category:        'food' | 'shampoo' | 'equipment';
  subCategory?:    ItemCategory;   // equipment のみ
  cost:            number;
  sellPrice:       number;
  rarity:          'common' | 'rare' | 'epic' | 'legendary';
  description:     string;
  flavorText:      string;
  // フェーズ制限
  phases?:         { puppy: boolean; adult: boolean; senior: boolean };
  // ショップ購入頻度制限
  shopFreq?:       'daily' | 'monthly' | 'yearly' | 'lifetime' | null;
  // 装備の必要ステータス（フィジカル5項目の合計）
  reqStatValue?:   number;
  // Legendary特殊効果
  legendaryEffect?: LegendaryEffect;
  // 消耗品効果（即時適用）
  hungerRestore?:        number;
  dirtRemove?:           number;
  coatBonus?:            number;
  staminaBonus?:         number;
  staminaRestorePercent?: number;  // v11: maxStaminaの○%回復
  happinessBonus?:       number;
  fatigueRestore?:       number;   // v12: 疲労軽減
  lifespanBonus?:        number;   // v12: 寿命回復
  cognitionBonus?:       number;   // v12: 認知能力回復
  isSurgery?:            boolean;  // v12: 延命手術（生涯1度）
  isEuthanasia?:         boolean;  // v12: 安楽死
  // 消耗品の汎用ステータス変動（Excel K-AD列対応）
  statEffects?:    Partial<{
    hunger: number; dirtiness: number; bladder: number; arousal: number;
    happiness: number; sleepiness: number; fatigue: number; vitality: number;
    discipline: number; speed: number; stamina: number; spring: number;
    focus: number; coat: number; charm: number; style: number;
    intelligence: number; luck: number; lifespan: number; cognition: number;
  }>;
  // 装備ボーナス（equipment のみ、クローゼットで装備時に有効）
  bonuses?:        ItemBonuses;
}

/** アイテムカテゴリ（装備スロットと対応） */
type ItemCategory = 'outfit' | 'shoes' | 'hat' | 'accessory';

/** 装備スロットキー（6枠） */
type EquipSlotKey = 'outfit' | 'shoes' | 'hat' | 'accessory1' | 'accessory2' | 'accessory3';

/** インベントリアイテム */
interface InventoryItem {
  id:              string;
  name:            string;
  category:        ItemCategory;
  rarity:          'common' | 'rare' | 'epic' | 'legendary';
  bonuses:         ItemBonuses;
  flavorText:      string;
  source:          'walk' | 'shop' | 'event';
  acquiredAt:      number;   // totalGameMin
  phases?:         { puppy: boolean; adult: boolean; senior: boolean };
  reqStatValue?:   number;   // フィジカル5項目合計の装備条件
  legendaryEffect?: LegendaryEffect;
}

/** 装備スロット（6枠） */
interface EquipmentSlots {
  outfit:     InventoryItem | null;   // 服 ×1
  shoes:      InventoryItem | null;   // 靴 ×1
  hat:        InventoryItem | null;   // 帽子 ×1
  accessory1: InventoryItem | null;   // 小物 ×3
  accessory2: InventoryItem | null;
  accessory3: InventoryItem | null;
}

type SleepPhase = 'awake' | 'NREM1' | 'NREM2' | 'NREM3' | 'REM';

type ActionLabel =
  | 'eating' | 'sleeping' | 'playing' | 'resting'
  | 'toilet' | 'wandering' | 'barking' | 'exploring' | 'fleeing'
  | 'excessive_barking' | 'destructive' | 'fearful';

type DogPreset = 'random' | 'active' | 'timid';

type WalkDestination = 'city' | 'park' | 'beach' | 'mountain' | 'secret';
type NpcMeetupState = 'aggressive' | 'playbow' | 'explore' | 'anxious';

// ─────────────────────────────────────────────
// 性別・家族・交流システム（v8）
// ─────────────────────────────────────────────

type Gender = 'male' | 'female';

/** 家族メンバー記録（番・子犬・祖先） */
interface FamilyMember {
  id:             string;
  name:           string;
  gender:         Gender;
  generation:     number;
  abilities:      AbilityStats;
  tournamentWins: number;
  preset:         DogPreset;
  personality?:   BigFive;   // 繁殖時に計算・引き継ぎ
  breed?:         string;    // 犬種ID
}

/** 散歩で出会うNPC犬 */
interface NpcDog {
  id:               string;
  name:             string;
  gender:           Gender;
  breed:            string;
  personality:      BigFive;
  abilities:        AbilityStats;
  equipment:        EquipmentSlots;
  intimacy:         number;    // 0-100 親密度
  metCount:         number;    // 遭遇回数
  reencounterBonus: number;    // 「またね」で+5%ずつ積まれる再会ボーナス（%）
}

/** ゲーム設定 */
interface GameSettings {
  tournamentEnabled:         boolean;   // 競技大会 有無
  trainingTournamentEnabled: boolean;   // 訓練大会 有無
  realMinPerDay:             number;    // ゲーム内1日 = 実X分
  volume:                    number;    // 音量 0-100（後方互換用）
  bgmEnabled:                boolean;   // BGM ON/OFF
  bgmVolume:                 number;    // BGM音量 0-100
  sfxEnabled:                boolean;   // システム音 ON/OFF
  sfxVolume:                 number;    // システム音量 0-100
  physicalContestEnabled:    boolean;   // フィジカルコンテスト 有無
  beautyContestEnabled:      boolean;   // ビューティーコンテスト 有無
  noseworkContestEnabled:    boolean;   // ノーズワークコンテスト 有無
}

/** 散歩中のミートアップ状態 */
interface MeetupState {
  npc:          NpcDog;
  phase:        'encounter' | 'react' | 'farewell' | 'done';
  npcState:     NpcMeetupState;
  giftItem:     InventoryItem | null;
  intimacyGain: number;
  rewardLog:    string;
}

/** セーブスロット */
interface SaveSlot {
  slotId:  number;   // 0 | 1 | 2
  savedAt: number;   // Date.now()
  dog:     DogState;
  label:   string;
}

interface DogState {
  age: number;
  hunger: number;           // 0-100: 高いほど空腹
  bladder: number;          // 0-100: 高いほど排泄したい
  sleepiness: number;       // 0-100: 高いほど眠い
  isSleeping: boolean;
  sleepPhase: SleepPhase;
  sleepCycleMin: number;
  stress: number;           // 間接導出 (生理欲求から算出)
  happiness: number;        // 間接導出 (生理欲求から算出)
  dirtiness: number;        // 0-100: 高いほど汚れている
  fatigue: number;          // 0-100: 高いほど疲れている
  arousal: number;          // 0-100: 覚醒度
  trainability: number;     // 0-100: しつけやすさ
  stressFromHunger: number;
  stressFromDirt: number;
  stressFromBladder: number;
  attachment: number;       // 0-100: 愛着度
  walkingTicksLeft: number;
  fearfulTicksLeft: number;
  statsActionCount: number;
  statsBarkCount: number;
  statsDestroyCount: number;
  statsScoldSuccess: number;
  statsScoldFear: number;
  personality: BigFive;
  presetName: DogPreset;
  currentAction: ActionLabel;
  log: string[];
  totalGameMin: number;
  // ── 能力値（v6）
  abilities:      AbilityStats;
  lineage:        LineageRecord[];
  tournamentWins: number;
  // ── 散歩報酬・装備（v6 Step2/3）
  coins:     number;
  inventory: InventoryItem[];    // 所持アイテム全一覧
  equipment: EquipmentSlots;     // 現在装備中（6スロット）
  style:     number;             // 着こなしスコア 0-100（装備から動的算出）
  // ── 時間・イベント（v7）
  dayTimeMin:          number;   // 0-1439: 1日の経過分（アクション起点）
  poopDebuff:          boolean;  // うんちデバフ発動中
  poopDebuffWalksLeft: number;   // デバフ解除に必要な残り散歩回数
  walkEventLog:        string[]; // 散歩画面向けイベントログ
  // ── 個体識別・家族（v8）
  dogId:         string;
  dogName:       string;
  breed:         string;   // 犬種ID (例: 'shibainu', 'chihuahua' など)
  gender:        Gender;
  generation:    number;
  mate:          FamilyMember | null;
  children:      FamilyMember[];
  knownDogs:     NpcDog[];
  walkLoopCount: number;
  puppies:       FamilyMember[];
  walkMeetup:    MeetupState | null;  // 散歩中ミートアップ状態
  lastWalkDayMin: number;            // 最後に散歩した totalGameMin（放置検知用）
  walkDestination:     WalkDestination | null;   // 現在の散歩目的地
  hasSecretInfo:       boolean;                   // 秘密の集いの情報取得済み
  lastUniqueEventDay:  number;                    // 固有イベントを最後に発生させたゲーム日
  isRetired: boolean;   // 引退済みフラグ（Trueになると子犬選択が解放）
  walkPoopFired: boolean;   // 現在の散歩ループでうんちイベント発生済み
  walkItemFired: boolean;   // 現在の散歩ループでアイテムドロップ済み
  actionHoldTicks: number;  // 行動安定化: 残り保持ティック数
  contestEntryMonth: number;   // エントリー対応済み月（-1: 未対応）
  contestEntered:    boolean;  // エントリー済み
  // ── 大会結果（v10）
  lastContestRunMonth: number;   // 直近に大会を実行したゲーム月（重複実行防止）
  contestPendingResult: ContestResult | null;  // 未読の大会結果
  // ── スタミナ成長（v11）
  maxStamina: number;   // スタミナ最大値（初期値250-300, 上限1000）
  // ── 血統タイプ
  lineageType: 'show' | 'working';
  // ── ライフサイクル（v12）
  socialExp:          number;   // 社会化経験値 0-100（子犬期）
  lifespan:           number;   // 寿命 0-1000（老犬期）
  cognition:          number;   // 認知能力 0-1000
  satoriBonuses:      string[]; // 悟りスキル一覧
  peakAbilities:      AbilityStats; // 生涯ピーク能力値（遺伝計算用）
  consecutiveTopFinish: number; // 連続入賞カウンター
  surgeryUsed:        boolean;  // 手術使用済み（生涯1度）
  seTransitioned:     boolean;  // week13 社会化移行処理済み
  socialMultiplier:   number;   // 社会化結果成長係数 0.95/1.0/1.1
  seLearned: {                  // SE取得済み要素
    care:  string[];
    play:  string[];
    areas: string[];
    equippedSlots: number;
  };
  satoriSlotsUnlocked: number;  // 悟りスロット解放数
  puppyClassEventFired: boolean; // 子犬教室イベント発火済み
  // ── 終焉・継承（v13）
  walkStats:      Partial<Record<WalkDestination, number>>; // 目的地別散歩回数
  heirloomItemId: string | null; // 先祖から受け継いだ形見アイテム名
  pendingDeath:   boolean;       // 寿命0→終焉シーケンス待ち
  // ── 老衰ステータス管理
  seniorFeedingDays:  number;  // 老犬期の適正給餌日数（k_aging軽減用）
  seniorExerciseDays: number;  // 老犬期の運動継続日数（k_aging軽減用）
  seniorLastDecayDay: number;  // 老衰計算を最後に適用したゲーム日
  seniorDailyFeedOK:  boolean; // 本日の適正給餌達成フラグ（腹八分目）
  seniorDailyExerOK:  boolean; // 本日の運動達成フラグ
  walkStrollEventFired:   boolean; // 現在の散歩ループでExcelイベント発生済み
  walkStrollEventMsg:     string;  // 発生したイベントのテキスト（散歩画面表示用）
  walkStrollEventPending: boolean; // イベント確認待ち（散歩進捗を一時停止）
  walkStrollEventStats:   string;  // イベントによるステータス変化テキスト
}

// ─────────────────────────────────────────────
// 大会結果型（v10）
// ─────────────────────────────────────────────

/** 大会参加者1頭の情報 */
interface ContestParticipant {
  name:    string;
  score:   number;
  type:    'pvp'   // PvP: スコア±20%圏内の他ユーザー（歴代犬データから）
         | 'cpu'   // CPU: 圏外だが参加扱いの他ユーザー
         | 'npc';  // NPC: 補充枠
  npcTier?: 1 | 2 | 3 | 4;   // NPC専用: ①+10% ②equal ③-20% ④-30%
  successRate?: number;        // NPC専用: アクション成功率 0.60〜1.00
}

/** 副賞アイテム（1・2位のみ） */
interface ContestBonusItem {
  name:      string;
  rarity:    'epic' | 'rare' | 'legendary';
  bonuses:   ItemBonuses;
  flavorText: string;
}

/** リザルト画面1行分 */
interface ContestResultEntry {
  rank:     number;
  dogBreed: string;
  dogName:  string;
  score:    number;
  isPlayer: boolean;
}

interface ContestResult {
  type:         'physical' | 'beauty' | 'nosework';
  rank:         number;         // 1〜6 位
  score:        number;         // 自犬スコア
  coins:        number;         // 賞金コイン
  won:          boolean;        // 優勝フラグ
  participants: ContestParticipant[];   // 対戦相手リスト（自犬除く5頭以内）
  bonusItem:    ContestBonusItem | null;  // 副賞アイテム（1・2位のみ）
}

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

const CALENDAR_START_MONTH = 4;   // April
const DAYS_PER_MONTH       = 30;
const MONTHS_PER_YEAR      = 12;

const GAME_MINUTES_PER_DAY      = 24 * 60;
const MIN_REAL_MINUTES          = 15;
const TICK_REAL_MS              = 500;
const ULTRADIAN_CYCLE_MIN       = 20;
const ATTACHMENT_DISCOUNT_ALPHA = 0.5;
const STRESS_BARK_THRESHOLD     = 75;
const STRESS_DESTROY_THRESHOLD  = 90;
const WALK_DIRT_TICKS           = 40;
const FEARFUL_TICKS             = 20;
const ACTION_MIN_HOLD_TICKS     = 8;   // 行動安定化: 最低 8tick 同じ行動を維持

// ── 能力システム定数（v6）
const ABILITY_MIN = 0;
const ABILITY_MAX = 1000;
/** 狭義の遺伝率 h² (規律のみ 0.30、その他 0.20) */
const H2: Record<string, number> = {
  discipline:   0.30,
  speed:        0.20,
  stamina:      0.20,
  spring:       0.20,
  intelligence: 0.20,
};
const LEGACY_BONUS_PER_WIN  = 0.03;   // 大会優勝1回あたりの実績ボーナス
const LEGACY_BONUS_MAX      = 0.15;   // 実績ボーナス上限
const AUTO_DISCIPLINE_THRESHOLD = 700; // 自律行動モード解放閾値（規律実効値）
const INTEL_WINDOW_MAX_BOOST     = 0.20; // 知性による判定ウィンドウ最大延長率
const AROUSAL_GREEN_MIN    = 40;
const AROUSAL_GREEN_MAX    = 70;
const AROUSAL_RED_THRESHOLD = 80;
const AROUSAL_GREEN_BUFF   = 1.10;  // 能力×1.1
const AROUSAL_RED_PENALTY  = 0.20;  // 規律成功率−20%
const AROUSAL_CONVERGENCE_RATE = 0.04; // /game-min: 50へ収束速度
const AROUSAL_NEUTRAL      = 50;

// ─────────────────────────────────────────────
// トロフィー型定義 & TROPHY_LIST
// ─────────────────────────────────────────────

interface GlobalStats {
  earnedTrophyIds: string[];
  playCount: Partial<Record<string, number>>;
  careCount: Partial<Record<string, number>>;
  totalShopSpend: number;
  dailyShopSpend: number;
  contestParticipation: { physical: number; beauty: number; nosework: number };
  contestPlacements: { physical: number; beauty: number; nosework: number };
  itemsPickedUp: number;
  totalDogs: number;
  currentDogContestAllPlacements: { physical: boolean; beauty: boolean; nosework: boolean };
  currentDogContestMinAppearances: { physical: number; beauty: number; nosework: number };
}

interface TrophyDef {
  id: string;
  category: string;
  label: string;
  desc: string;
  check: (dog: DogState, global: GlobalStats) => boolean;
}

const TROPHY_LIST: TrophyDef[] = [
  // ── 子犬・社会化
  { id:'puppy_social_100', category:'子犬・社会化', label:'黄金の幼少期', desc:'子犬期に社会化スコア100を達成する',
    check:(dog)=> (dog.socialExp ?? 0) >= 100 },
  { id:'puppy_social_80', category:'子犬・社会化', label:'充実の幼少期', desc:'社会化スコア80以上で成犬になる',
    check:(dog)=> (dog.socialMultiplier ?? 1.0) >= 1.1 },

  // ── フィジカル
  { id:'physical_speed_1000', category:'フィジカル', label:'弾丸ボーイ/ガール', desc:'速度1000',
    check:(dog)=> dog.abilities.physical.speed >= 1000 },
  { id:'physical_stamina_1000', category:'フィジカル', label:'鉄人の心臓', desc:'スタミナ1000',
    check:(dog)=> dog.abilities.physical.stamina >= 1000 },
  { id:'physical_spring_1000', category:'フィジカル', label:'無重力の跳躍者', desc:'バネ1000',
    check:(dog)=> dog.abilities.physical.spring >= 1000 },
  { id:'physical_discipline_1000', category:'フィジカル', label:'規律の鬼', desc:'規律1000',
    check:(dog)=> dog.abilities.physical.discipline >= 1000 },
  { id:'physical_focus_1000', category:'フィジカル', label:'全集中の呼吸', desc:'集中力1000',
    check:(dog)=> dog.abilities.physical.focus >= 1000 },
  { id:'physical_all_1000', category:'フィジカル', label:'限界突破', desc:'全フィジカル1000以上',
    check:(dog)=> dog.abilities.physical.speed >= 1000 && dog.abilities.physical.stamina >= 1000 &&
      dog.abilities.physical.spring >= 1000 && dog.abilities.physical.discipline >= 1000 &&
      dog.abilities.physical.focus >= 1000 },
  { id:'physical_speed_10000', category:'フィジカル', label:'神風', desc:'速度10000',
    check:(dog)=> dog.abilities.physical.speed >= 10000 },
  { id:'physical_stamina_10000', category:'フィジカル', label:'不倒', desc:'スタミナ10000',
    check:(dog)=> dog.abilities.physical.stamina >= 10000 },
  { id:'physical_spring_10000', category:'フィジカル', label:'飛犬', desc:'バネ10000',
    check:(dog)=> dog.abilities.physical.spring >= 10000 },
  { id:'physical_discipline_10000', category:'フィジカル', label:'規律の神', desc:'規律10000',
    check:(dog)=> dog.abilities.physical.discipline >= 10000 },
  { id:'physical_focus_10000', category:'フィジカル', label:'透き通る世界', desc:'集中力10000',
    check:(dog)=> dog.abilities.physical.focus >= 10000 },
  { id:'physical_all_10000', category:'フィジカル', label:'犬神', desc:'全フィジカル10000以上',
    check:(dog)=> dog.abilities.physical.speed >= 10000 && dog.abilities.physical.stamina >= 10000 &&
      dog.abilities.physical.spring >= 10000 && dog.abilities.physical.discipline >= 10000 &&
      dog.abilities.physical.focus >= 10000 },
  { id:'play_wait_100', category:'フィジカル', label:'静止した芸術', desc:'まて！ゲーム100回',
    check:(_dog, global)=> (global.playCount['waitGame'] ?? 0) >= 100 },
  { id:'play_frisbee_100', category:'フィジカル', label:'フリスビーマスター', desc:'フリスビー100回',
    check:(_dog, global)=> (global.playCount['frisbee'] ?? 0) >= 100 },
  { id:'play_rope_100', category:'フィジカル', label:'綱引きの鬼', desc:'ひっぱりっこ100回',
    check:(_dog, global)=> (global.playCount['ropePull'] ?? 0) >= 100 },
  { id:'play_treasure_100', category:'フィジカル', label:'見習いトレジャー', desc:'たからさがし100回',
    check:(_dog, global)=> (global.playCount['treasureHunt'] ?? 0) >= 100 },
  { id:'play_wait_1000', category:'フィジカル', label:'不動', desc:'まて！ゲーム1000回',
    check:(_dog, global)=> (global.playCount['waitGame'] ?? 0) >= 1000 },
  { id:'play_frisbee_1000', category:'フィジカル', label:'狩人', desc:'フリスビー1000回',
    check:(_dog, global)=> (global.playCount['frisbee'] ?? 0) >= 1000 },
  { id:'play_rope_1000', category:'フィジカル', label:'綱引きの達人', desc:'ひっぱりっこ1000回',
    check:(_dog, global)=> (global.playCount['ropePull'] ?? 0) >= 1000 },
  { id:'play_treasure_1000', category:'フィジカル', label:'一流のトレジャーハンター', desc:'たからさがし1000回',
    check:(_dog, global)=> (global.playCount['treasureHunt'] ?? 0) >= 1000 },

  // ── ビューティー
  { id:'beauty_coat_100', category:'ビューティー', label:'至高の手触り', desc:'毛並み100',
    check:(dog)=> dog.abilities.beauty.coat >= 100 },
  { id:'beauty_charm_100', category:'ビューティー', label:'モテモテの風格', desc:'愛嬌100',
    check:(dog)=> dog.abilities.beauty.charm >= 100 },
  { id:'beauty_style_100', category:'ビューティー', label:'究極のモデル', desc:'スタイル100',
    check:(dog)=> (dog.style ?? 0) >= 100 },
  { id:'beauty_all_100', category:'ビューティー', label:'歩く宝石', desc:'毛並み・愛嬌・スタイル全100',
    check:(dog)=> dog.abilities.beauty.coat >= 100 && dog.abilities.beauty.charm >= 100 && (dog.style ?? 0) >= 100 },
  { id:'care_brush_100', category:'ビューティー', label:'毛並みの貴公子', desc:'ブラッシング100回',
    check:(_dog, global)=> (global.careCount['brushing'] ?? 0) >= 100 },
  { id:'care_bath_100', category:'ビューティー', label:'お風呂の常連', desc:'お風呂100回',
    check:(_dog, global)=> (global.careCount['bath'] ?? 0) >= 100 },
  { id:'care_pet_100', category:'ビューティー', label:'ぬくもりの伝道師', desc:'撫でる100回',
    check:(_dog, global)=> (global.careCount['pet'] ?? 0) >= 100 },
  { id:'care_massage_100', category:'ビューティー', label:'癒しのスペシャリスト', desc:'マッサージ100回',
    check:(_dog, global)=> (global.careCount['massage'] ?? 0) >= 100 },

  // ── その他ステータス
  { id:'stat_intelligence_1000', category:'その他ステータス', label:'賢者の血統', desc:'知性1000',
    check:(dog)=> dog.abilities.intelligence >= 1000 },
  { id:'stat_intelligence_10000', category:'その他ステータス', label:'神の叡智', desc:'知性10000',
    check:(dog)=> dog.abilities.intelligence >= 10000 },
  { id:'stat_luck_100', category:'その他ステータス', label:'天に愛されし者', desc:'幸運100',
    check:(dog)=> dog.abilities.luck >= 100 },
  { id:'stat_attachment_100', category:'その他ステータス', label:'相思相愛', desc:'愛着100',
    check:(dog)=> dog.attachment >= 100 },
  { id:'stat_satori_5', category:'その他ステータス', label:'悟りを開きし者', desc:'悟りスキル5つ以上',
    check:(dog)=> (dog.satoriBonuses?.length ?? 0) >= 5 },
  { id:'stat_arousal_zen', category:'その他ステータス', label:'禅の境地', desc:'興奮40-70を100日維持',
    check:()=> false },
  { id:'item_epic_20', category:'その他ステータス', label:'トレジャーハンター', desc:'Epicアイテム20個以上',
    check:(dog)=> dog.inventory.filter(i=>i.rarity==='epic'||i.rarity==='legendary').length >= 20 },
  { id:'item_legendary_10', category:'その他ステータス', label:'伝説のコレクター', desc:'Legendaryアイテム10個以上',
    check:(dog)=> dog.inventory.filter(i=>i.rarity==='legendary').length >= 10 },

  // ── 散歩・探索
  { id:'walk_city_100', category:'散歩・探索', label:'街の顔役', desc:'市街地で100回他の犬と出会う',
    check:()=> false },
  { id:'walk_park_100', category:'散歩・探索', label:'公園の主', desc:'公園で100回他の犬と出会う',
    check:()=> false },
  { id:'walk_beach_100', category:'散歩・探索', label:'渚のハンター', desc:'浜辺で100回他の犬と出会う',
    check:()=> false },
  { id:'walk_mountain_100', category:'散歩・探索', label:'山の翁', desc:'山道で100回他の犬と出会う',
    check:()=> false },
  { id:'walk_secret_100', category:'散歩・探索', label:'高みを知る者', desc:'名犬の集いで100回散歩',
    check:(dog)=> (dog.walkStats?.['secret'] ?? 0) >= 100 },
  { id:'walk_city_events', category:'散歩・探索', label:'番長', desc:'市街地の全イベント',
    check:()=> false },
  { id:'walk_park_events', category:'散歩・探索', label:'裏番長', desc:'公園の全イベント',
    check:()=> false },
  { id:'walk_beach_events', category:'散歩・探索', label:'渚の支配者', desc:'浜辺の全イベント',
    check:()=> false },
  { id:'walk_mountain_events', category:'散歩・探索', label:'山道の踏破者', desc:'山道の全イベント',
    check:()=> false },
  { id:'walk_all_events', category:'散歩・探索', label:'全てを知る者', desc:'全エリアの全イベント',
    check:()=> false },
  { id:'walk_pickup_100', category:'散歩・探索', label:'拾い物上手', desc:'アイテム累計100個',
    check:(_dog, global)=> global.itemsPickedUp >= 100 },
  { id:'walk_pickup_500', category:'散歩・探索', label:'拾う神あれば', desc:'アイテム累計500個',
    check:(_dog, global)=> global.itemsPickedUp >= 500 },

  // ── コンテスト
  { id:'contest_physical_all', category:'コンテスト', label:'伝説の競争犬', desc:'フィジカルで全連帯(60回以上)',
    check:(_dog, global)=> global.contestParticipation.physical >= 60 && global.currentDogContestAllPlacements.physical },
  { id:'contest_beauty_all', category:'コンテスト', label:'至高の美', desc:'ビューティーで全連帯(60回以上)',
    check:(_dog, global)=> global.contestParticipation.beauty >= 60 && global.currentDogContestAllPlacements.beauty },
  { id:'contest_nosework_all', category:'コンテスト', label:'神の鼻', desc:'ノーズワークで全連帯(60回以上)',
    check:(_dog, global)=> global.contestParticipation.nosework >= 60 && global.currentDogContestAllPlacements.nosework },
  { id:'contest_all_three', category:'コンテスト', label:'戦神', desc:'同一犬で3種全連帯',
    check:(_dog, global)=> global.earnedTrophyIds.includes('contest_physical_all') &&
      global.earnedTrophyIds.includes('contest_beauty_all') && global.earnedTrophyIds.includes('contest_nosework_all') },

  // ── クローゼット
  { id:'closet_all_slots', category:'クローゼット', label:'ファッショニスタ', desc:'全6スロット装備',
    check:(dog)=> Object.values(dog.equipment).filter(v=>v!==null).length >= 6 },
  { id:'closet_hat_30', category:'クローゼット', label:'帽子コレクター', desc:'帽子30種',
    check:(dog)=> dog.inventory.filter(i=>i.category==='hat').length >= 30 },
  { id:'closet_clothes_30', category:'クローゼット', label:'服コレクター', desc:'服30種',
    check:(dog)=> dog.inventory.filter(i=>i.category==='outfit').length >= 30 },
  { id:'closet_shoes_30', category:'クローゼット', label:'靴コレクター', desc:'靴30種',
    check:(dog)=> dog.inventory.filter(i=>i.category==='shoes').length >= 30 },
  { id:'closet_accessory_30', category:'クローゼット', label:'小物コレクター', desc:'小物30種',
    check:(dog)=> dog.inventory.filter(i=>i.category==='accessory').length >= 30 },
  { id:'closet_hat_all', category:'クローゼット', label:'帽子の流行を創る者', desc:'帽子全種',
    check:()=> false },
  { id:'closet_clothes_all', category:'クローゼット', label:'服の流行を創る者', desc:'服全種',
    check:()=> false },
  { id:'closet_shoes_all', category:'クローゼット', label:'靴の流行を創る者', desc:'靴全種',
    check:()=> false },
  { id:'closet_accessory_all', category:'クローゼット', label:'アクセサリーの流行を創る者', desc:'小物全種',
    check:()=> false },
  { id:'shop_spend_1000', category:'クローゼット', label:'爆買い飼い主', desc:'1日1000コイン以上',
    check:(_dog, global)=> global.dailyShopSpend >= 1000 },
  { id:'shop_spend_100000', category:'クローゼット', label:'お得意様', desc:'総額100000コイン以上',
    check:(_dog, global)=> global.totalShopSpend >= 100000 },
  { id:'closet_contest_win', category:'クローゼット', label:'親孝行', desc:'形見装備してコンテスト優勝',
    check:()=> false },

  // ── 次世代・継承
  { id:'lineage_next', category:'次世代・継承', label:'命のバトン', desc:'初めて次世代へ',
    check:(dog)=> (dog.generation ?? 1) >= 2 },
  { id:'lineage_legend_3gen', category:'次世代・継承', label:'名門の家系', desc:'3代連続連帯コンテスト達成',
    check:()=> false },
  { id:'lineage_wargod_3gen', category:'次世代・継承', label:'神話の紡ぎ手', desc:'戦神3代連続',
    check:()=> false },

  // ── 特殊・やり込み
  { id:'special_age_20', category:'特殊・やり込み', label:'不死鳥', desc:'20歳まで生きる',
    check:()=> false },
  { id:'special_no_shop', category:'特殊・やり込み', label:'倹約家', desc:'ショップ使わず成犬期終える',
    check:()=> false },
  { id:'special_surgery', category:'特殊・やり込み', label:'奇跡の生還', desc:'延命手術使用',
    check:(dog)=> dog.surgeryUsed === true },
  { id:'special_max_attachment', category:'特殊・やり込み', label:'幸福な生涯', desc:'愛着MAXで一生終える',
    check:()=> false },
  { id:'special_play_4types', category:'特殊・やり込み', label:'遊び人', desc:'4種類の遊びを毎日1週間',
    check:()=> false },
  { id:'special_care_all', category:'特殊・やり込み', label:'ケアのスペシャリスト', desc:'全種類ケアを毎日1週間',
    check:()=> false },
  { id:'special_no_toilet_overflow', category:'特殊・やり込み', label:'トイレの神様', desc:'排泄ゲージMAXにせず一生終える',
    check:()=> false },
  { id:'special_early_bird', category:'特殊・やり込み', label:'早起きトレーナー', desc:'午前7時前に起動3日連続',
    check:()=> false },
  { id:'special_night_owl', category:'特殊・やり込み', label:'徹夜トレーナー', desc:'午前0〜5時にプレイ3日連続',
    check:()=> false },
  { id:'special_walk_4dest', category:'特殊・やり込み', label:'散歩の達人', desc:'1日4箇所散歩',
    check:()=> false },
  { id:'special_beauty_slots', category:'特殊・やり込み', label:'美の求道者', desc:'全スロットビューティー上昇装備',
    check:()=> false },
  { id:'special_physical_slots', category:'特殊・やり込み', label:'フィジカルモンスター', desc:'全スロットフィジカル上昇装備',
    check:()=> false },
  { id:'special_change_outfit', category:'特殊・やり込み', label:'おしゃれ番長', desc:'クローゼット毎日変更1週間',
    check:()=> false },
  { id:'special_contest_12months', category:'特殊・やり込み', label:'コンテストの常連', desc:'12ヶ月連続コンテスト申し込み',
    check:()=> false },
  { id:'special_50trophies', category:'特殊・やり込み', label:'ワンダフル・ライフ', desc:'称号50個獲得',
    check:(_dog, global)=> global.earnedTrophyIds.length >= 50 },
];

// ── 時間システム (v7)
const DAY_START_MIN        = 420;   // 07:00 開始
const NIGHT_START_MIN      = 1320;  // 22:00 夜間制限
const MORNING_SKIP_MIN     = 360;   // 06:00 スキップ先
const TIME_CARE            = 60;    // ケア系: 60分
const TIME_PLAY            = 180;   // 遊び系: 180分
const TIME_TRAIN           = 300;   // 訓練系: 300分
const TIME_WALK            = 300;   // 散歩: 300分

// ── 散歩うんちイベント (v7)
const POOP_EVENT_CHANCE    = 0.05;  // 5% / 散歩
const POOP_DIRTY_HIT       = 50;
const POOP_DEBUFF_WALKS    = 3;     // 解除に必要な散歩回数
const POOP_LUCK_PENALTY    = 10;    // 表示時のみ適用（abilities を変更しない）

// ── 散歩Excelイベントデータ (evevts_stroll.xlsx から生成)
interface StrollEventData { area:string; stat1:string|null; amt1:number; stat2:string|null; amt2:number; puppy:string|null; adult:string|null; senior:string|null; }
const STROLL_EVENTS: StrollEventData[] = [
  {area:"park",stat1:"hunger",amt1:20,stat2:"hunger",amt2:0,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。お腹の音が鳴り、誰かが食べているお弁当の匂いを必死に嗅いでいる。足元に落ちている木の実を、食べ物だと思って口に入れようとした。周囲の空気までもが華やぐようだ。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。足元に落ちている木の実を、食べ物だと思って口に入れようとした。足元に落ちている木の実を、食べ物だと思って口に入れようとした。周囲の空気までもが華やぐようだ。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。足元に落ちている木の実を、食べ物だと思って口に入れようとした。お腹の音が鳴り、誰かが食べているお弁当の匂いを必死に嗅いでいる。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"dirtiness",amt1:20,stat2:"dirtiness",amt2:0,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。道行く人が思わず笑顔をこぼしている。",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。道行く人が思わず笑顔をこぼしている。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"bladder",amt1:20,stat2:"bladder",amt2:0,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。あなたは誇らしい気持ちでリードを握った。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。あなたは誇らしい気持ちでリードを握った。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。あなたは誇らしい気持ちでリードを握った。"},
  {area:"mountain",stat1:"arousal",amt1:20,stat2:"arousal",amt2:0,puppy:"茂みの中で動くトカゲを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。これからのコンテストに向けた自信に繋がる。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。これからのコンテストに向けた自信に繋がる。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"happiness",amt1:20,stat2:"happiness",amt2:0,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。静かな時間が、二人の間に流れていく。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。静かな時間が、二人の間に流れていく。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。静かな時間が、二人の間に流れていく。"},
  {area:"city",stat1:"sleepiness",amt1:20,stat2:"sleepiness",amt2:0,puppy:"お洒落なカフェの店員さんを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。賑やかな話し声が、遠くで聞こえている。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。賑やかな話し声が、遠くで聞こえている。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。賑やかな話し声が、遠くで聞こえている。"},
  {area:"city",stat1:"fatigue",amt1:20,stat2:"fatigue",amt2:0,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。舌を出し、いつもより歩調を落としてゆっくりと歩いている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元のアスファルトが、少しだけ温かい。",adult:"お洒落なカフェの店員さんに対しても、●●は堂々と振る舞っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元のアスファルトが、少しだけ温かい。",senior:"登校中の小学生たちを優しく見守るように、●●は足を止めた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。足元のアスファルトが、少しだけ温かい。"},
  {area:"park",stat1:null,amt1:20,stat2:null,amt2:0,puppy:"木の上から見下ろすカラスを見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。道行く人を次々と誘うように、活発に動き回っている。風が心地よく、耳元を通り抜けていった。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。道行く人を次々と誘うように、活発に動き回っている。風が心地よく、耳元を通り抜けていった。",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"discipline",amt1:5,stat2:"discipline",amt2:0,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。横断歩道の前で、指示される前にぴたっとお座りをして待機した。周囲の空気までもが華やぐようだ。",adult:"流木に対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。周囲の空気までもが華やぐようだ。",senior:"釣りをしているお兄さんを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。周囲の空気までもが華やぐようだ。"},
  {area:"mountain",stat1:"speed",amt1:5,stat2:"speed",amt2:0,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。道行く人が思わず笑顔をこぼしている。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。風を切るような足取りで、あっという間に目的の角まで辿り着いた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。道行く人が思わず笑顔をこぼしている。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。道行く人が思わず笑顔をこぼしている。"},
  {area:"beach",stat1:"stamina",amt1:5,stat2:"stamina",amt2:0,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。何キロも歩いた後でも、力強い足取りであなたをリードしている。あなたは誇らしい気持ちでリードを握った。",adult:"空を旋回するカモメに対しても、●●は堂々と振る舞っている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。あなたは誇らしい気持ちでリードを握った。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。あなたは誇らしい気持ちでリードを握った。"},
  {area:"mountain",stat1:"spring",amt1:5,stat2:"spring",amt2:0,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。これからのコンテストに向けた自信に繋がる。",adult:"茂みの中で動くトカゲに対しても、●●は堂々と振る舞っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。これからのコンテストに向けた自信に繋がる。",senior:"鳴いているセミを優しく見守るように、●●は足を止めた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。これからのコンテストに向けた自信に繋がる。"},
  {area:"beach",stat1:"focus",amt1:5,stat2:"focus",amt2:0,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。静かな時間が、二人の間に流れていく。",adult:"流木に対しても、●●は堂々と振る舞っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。静かな時間が、二人の間に流れていく。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。静かな時間が、二人の間に流れていく。"},
  {area:"park",stat1:"coat",amt1:1,stat2:"coat",amt2:0,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。賑やかな話し声が、遠くで聞こえている。",adult:"芝生でヨガをするグループに対しても、●●は堂々と振る舞っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。賑やかな話し声が、遠くで聞こえている。",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"charm",amt1:1,stat2:"charm",amt2:0,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。足元のアスファルトが、少しだけ温かい。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。足元のアスファルトが、少しだけ温かい。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。足元のアスファルトが、少しだけ温かい。"},
  {area:"mountain",stat1:"style",amt1:1,stat2:"style",amt2:0,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。風が心地よく、耳元を通り抜けていった。",adult:"茂みの中で動くトカゲに対しても、●●は堂々と振る舞っている。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。風が心地よく、耳元を通り抜けていった。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。風が心地よく、耳元を通り抜けていった。"},
  {area:"park",stat1:"intelligence",amt1:1,stat2:"intelligence",amt2:0,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。周囲の空気までもが華やぐようだ。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。周囲の空気までもが華やぐようだ。",senior:"散歩仲間のゴールデンレトリバーを優しく見守るように、●●は足を止めた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。周囲の空気までもが華やぐようだ。"},
  {area:"city",stat1:"luck",amt1:1,stat2:"luck",amt2:0,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。道行く人が思わず笑顔をこぼしている。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"dirtiness",amt1:10,stat2:"bladder",amt2:10,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。あなたは誇らしい気持ちでリードを握った。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。あなたは誇らしい気持ちでリードを握った。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。あなたは誇らしい気持ちでリードを握った。"},
  {area:"park",stat1:"dirtiness",amt1:10,stat2:"arousal",amt2:10,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。これからのコンテストに向けた自信に繋がる。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。これからのコンテストに向けた自信に繋がる。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。これからのコンテストに向けた自信に繋がる。"},
  {area:"city",stat1:"dirtiness",amt1:10,stat2:"happiness",amt2:-10,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。撫でられて満足そうに目を細め、幸せそうな吐息をついた。静かな時間が、二人の間に流れていく。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。撫でられて満足そうに目を細め、幸せそうな吐息をついた。静かな時間が、二人の間に流れていく。",senior:"信号待ちのジョギング中の女性を優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"sleepiness",amt2:10,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。賑やかな話し声が、遠くで聞こえている。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。賑やかな話し声が、遠くで聞こえている。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"dirtiness",amt1:10,stat2:"fatigue",amt2:10,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元のアスファルトが、少しだけ温かい。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元のアスファルトが、少しだけ温かい。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元のアスファルトが、少しだけ温かい。"},
  {area:"mountain",stat1:"dirtiness",amt1:10,stat2:null,amt2:-10,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風が心地よく、耳元を通り抜けていった。",adult:"茂みの中で動くトカゲに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風が心地よく、耳元を通り抜けていった。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"discipline",amt2:5,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。横断歩道の前で、指示される前にぴたっとお座りをして待機した。周囲の空気までもが華やぐようだ。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。横断歩道の前で、指示される前にぴたっとお座りをして待機した。周囲の空気までもが華やぐようだ。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"dirtiness",amt1:10,stat2:"speed",amt2:5,puppy:"木の上から見下ろすカラスを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。風を切るような足取りで、あっという間に目的の角まで辿り着いた。道行く人が思わず笑顔をこぼしている。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。道行く人が思わず笑顔をこぼしている。",senior:"噴水で遊ぶ子供たちを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。風を切るような足取りで、あっという間に目的の角まで辿り着いた。道行く人が思わず笑顔をこぼしている。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"stamina",amt2:5,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。何キロも歩いた後でも、力強い足取りであなたをリードしている。あなたは誇らしい気持ちでリードを握った。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。あなたは誇らしい気持ちでリードを握った。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。何キロも歩いた後でも、力強い足取りであなたをリードしている。あなたは誇らしい気持ちでリードを握った。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"spring",amt2:5,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。これからのコンテストに向けた自信に繋がる。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。これからのコンテストに向けた自信に繋がる。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"dirtiness",amt1:10,stat2:"focus",amt2:5,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。静かな時間が、二人の間に流れていく。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。静かな時間が、二人の間に流れていく。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"coat",amt2:-1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。賑やかな話し声が、遠くで聞こえている。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。賑やかな話し声が、遠くで聞こえている。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。水たまりにダイブして、お腹まで泥だらけになってしまった。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。賑やかな話し声が、遠くで聞こえている。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"charm",amt2:-1,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。足元のアスファルトが、少しだけ温かい。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。足元のアスファルトが、少しだけ温かい。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"dirtiness",amt1:10,stat2:"style",amt2:-1,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。風が心地よく、耳元を通り抜けていった。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。風が心地よく、耳元を通り抜けていった。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。風が心地よく、耳元を通り抜けていった。"},
  {area:"park",stat1:"dirtiness",amt1:10,stat2:"intelligence",amt2:-1,puppy:"鳩の群れを見つけると、●●は夢中で駆け寄った。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。周囲の空気までもが華やぐようだ。",adult:"噴水で遊ぶ子供たちに対しても、●●は堂々と振る舞っている。水たまりにダイブして、お腹まで泥だらけになってしまった。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。周囲の空気までもが華やぐようだ。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"dirtiness",amt1:10,stat2:"luck",amt2:-1,puppy:"鳩の群れを見つけると、●●は夢中で駆け寄った。水たまりにダイブして、お腹まで泥だらけになってしまった。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。道行く人が思わず笑顔をこぼしている。",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。工事現場の砂埃を浴びて、全身が白っぽくなってしまった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"arousal",amt2:10,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。あなたは誇らしい気持ちでリードを握った。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。あなたは誇らしい気持ちでリードを握った。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現れてい",senior:"信号待ちのジョギング中の女性を優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。あなたは誇らしい気持ちでリードを握った。"},
  {area:"mountain",stat1:"bladder",amt1:10,stat2:"happiness",amt2:-10,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。これからのコンテストに向けた自信に繋がる。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。これからのコンテストに向けた自信に繋がる。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。これからのコンテストに向けた自信に繋がる。"},
  {area:"beach",stat1:"bladder",amt1:10,stat2:"sleepiness",amt2:10,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。静かな時間が、二人の間に流れていく。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。静かな時間が、二人の間に流れていく。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。静かな時間が、二人の間に流れていく。"},
  {area:"park",stat1:"bladder",amt1:10,stat2:"fatigue",amt2:10,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。賑やかな話し声が、遠くで聞こえている。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。賑やかな話し声が、遠くで聞こえている。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:"bladder",amt1:10,stat2:null,amt2:-10,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。道行く人を次々と誘うように、活発に動き回っている。足元のアスファルトが、少しだけ温かい。",adult:"ベンチで新聞を読むおじいさんに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。道行く人を次々と誘うように、活発に動き回っている。足元のアスファルトが、少しだけ温かい。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。道行く人を次々と誘うように、活発に動き回っている。足元のアスファルトが、少しだけ温かい。"},
  {area:"park",stat1:"bladder",amt1:10,stat2:"discipline",amt2:-5,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。横断歩道の前で、指示される前にぴたっとお座りをして待機した。風が心地よく、耳元を通り抜けていった。好奇心に満ちた瞳を輝かせ、あなたのあとを一生懸命に追いか",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。風が心地よく、耳元を通り抜けていった。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。風が心地よく、耳元を通り抜けていった。"},
  {area:"mountain",stat1:"bladder",amt1:10,stat2:"speed",amt2:-5,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の空気までもが華やぐようだ。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の空気までもが華やぐようだ。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の空気までもが華やぐようだ。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"stamina",amt2:-5,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。何キロも歩いた後でも、力強い足取りであなたをリードしている。道行く人が思わず笑顔をこぼしている。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。何キロも歩いた後でも、力強い足取りであなたをリードしている。道行く人が思わず笑顔をこぼしている。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"spring",amt2:-5,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。あなたは誇らしい気持ちでリードを握った。",adult:"自転車に乗ったおじさんに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。あなたは誇らしい気持ちでリードを握った。",senior:"登校中の小学生たちを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"focus",amt2:-5,puppy:"お洒落なカフェの店員さんを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。これからのコンテストに向けた自信に繋がる。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。これからのコンテストに向けた自信に繋がる。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"bladder",amt1:10,stat2:"coat",amt2:-1,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。静かな時間が、二人の間に流れていく。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。静かな時間が、二人の間に流れていく。",senior:"鳴いているセミを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。静かな時間が、二人の間に流れていく。"},
  {area:"park",stat1:"bladder",amt1:10,stat2:"charm",amt2:-1,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。賑やかな話し声が、遠くで聞こえている。",adult:"芝生でヨガをするグループに対しても、●●は堂々と振る舞っている。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。賑やかな話し声が、遠くで聞こえている。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。賑やかな話し声が、遠くで聞こえている。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"style",amt2:-1,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。足元のアスファルトが、少しだけ温かい。",adult:"自転車に乗ったおじさんに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。足元のアスファルトが、少しだけ温かい。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。足元のアスファルトが、少しだけ温かい。"},
  {area:"city",stat1:"bladder",amt1:10,stat2:"intelligence",amt2:-1,puppy:"店先の招き猫を見つけると、●●は夢中で駆け寄った。電柱の匂いを熱心に嗅いで、そわそわと周囲を回り始めた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。風が心地よく、耳元を通り抜けていった。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。風が心地よく、耳元を通り抜けていった。",senior:"登校中の小学生たちを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"bladder",amt1:10,stat2:"luck",amt2:-1,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。周囲の空気までもが華やぐようだ。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。周囲の空気までもが華やぐようだ。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。茂みの奥深くに入り込み、じっと一点を見つめて動かなくなった。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。周囲の空気までもが華やぐようだ。"},
  {area:"mountain",stat1:"arousal",amt1:10,stat2:"happiness",amt2:-10,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人が思わず笑顔をこぼしている。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人が思わず笑顔をこぼしている。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:"sleepiness",amt2:-10,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。あなたは誇らしい気持ちでリードを握った。",adult:"自転車に乗ったおじさんに対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。あなたは誇らしい気持ちでリードを握った。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。あなたは誇らしい気持ちでリードを握った。"},
  {area:"park",stat1:"arousal",amt1:10,stat2:"fatigue",amt2:-10,puppy:"木の上から見下ろすカラスを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。これからのコンテストに向けた自信に繋がる。",adult:"芝生でヨガをするグループに対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。これからのコンテストに向けた自信に繋がる。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。これからのコンテストに向けた自信に繋がる。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:null,amt2:10,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。静かな時間が、二人の間に流れていく。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。道行く人を次々と誘うように、活発に動き回っている。静かな時間が、二人の間に流れていく。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"arousal",amt1:10,stat2:"discipline",amt2:-5,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。賑やかな話し声が、遠くで聞こえている。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。賑やかな話し声が、遠くで聞こえている。",senior:"流木を優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。賑やかな話し声が、遠くで聞こえている。"},
  {area:"beach",stat1:"arousal",amt1:10,stat2:"speed",amt2:5,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。足元のアスファルトが、少しだけ温かい。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。足元のアスファルトが、少しだけ温かい。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。足元のアスファルトが、少しだけ温かい。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:"stamina",amt2:5,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。風が心地よく、耳元を通り抜けていった。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。風が心地よく、耳元を通り抜けていった。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。風が心地よく、耳元を通り抜けていった。"},
  {area:"mountain",stat1:"arousal",amt1:10,stat2:"spring",amt2:5,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。周囲の空気までもが華やぐようだ。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。周囲の空気までもが華やぐようだ。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"arousal",amt1:10,stat2:"focus",amt2:-5,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。道行く人が思わず笑顔をこぼしている。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。道行く人が思わず笑顔をこぼしている。",senior:"噴水で遊ぶ子供たちを優しく見守るように、●●は足を止めた。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:"coat",amt2:-1,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。あなたは誇らしい気持ちでリードを握った。",adult:"自転車に乗ったおじさんに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。あなたは誇らしい気持ちでリードを握った。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。あなたは誇らしい気持ちでリードを握った。"},
  {area:"park",stat1:"arousal",amt1:10,stat2:"charm",amt2:1,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。これからのコンテストに向けた自信に繋がる。",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。これからのコンテストに向けた自信に繋がる。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現れて",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。これからのコンテストに向けた自信に繋がる。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:"style",amt2:1,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。静かな時間が、二人の間に流れていく。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。静かな時間が、二人の間に流れていく。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"arousal",amt1:10,stat2:"intelligence",amt2:-1,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。賑やかな話し声が、遠くで聞こえている。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。賑やかな話し声が、遠くで聞こえている。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。動くものすべてに反応して、尻尾をちぎれんばかりに振っている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。賑やかな話し声が、遠くで聞こえている。"},
  {area:"city",stat1:"arousal",amt1:10,stat2:"luck",amt2:-1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。足元のアスファルトが、少しだけ温かい。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。足元のアスファルトが、少しだけ温かい。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。大きな音に驚いて、鼻を鳴らしながらあなたの周りを飛び跳ねた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。足元のアスファルトが、少しだけ温かい。"},
  {area:"mountain",stat1:"happiness",amt1:10,stat2:"sleepiness",amt2:10,puppy:"休憩中の登山グループを見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。風が心地よく、耳元を通り抜けていった。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。風が心地よく、耳元を通り抜けていった。",senior:"鳴いているセミを優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"happiness",amt1:10,stat2:"fatigue",amt2:-10,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。周囲の空気までもが華やぐようだ。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。周囲の空気までもが華やぐようだ。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。周囲の空気までもが華やぐようだ。"},
  {area:"city",stat1:"happiness",amt1:10,stat2:null,amt2:10,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人を次々と誘うように、活発に動き回っている。道行く人が思わず笑顔をこぼしている。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人を次々と誘うように、活発に動き回っている。道行く人が思わず笑顔をこぼしている。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。道行く人を次々と誘うように、活発に動き回っている。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"happiness",amt1:10,stat2:"discipline",amt2:5,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。あなたは誇らしい気持ちでリードを握った。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。あなたは誇らしい気持ちでリードを握った。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。あなたは誇らしい気持ちでリードを握った。"},
  {area:"beach",stat1:"happiness",amt1:10,stat2:"speed",amt2:5,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。これからのコンテストに向けた自信に繋がる。",adult:"流木に対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。これからのコンテストに向けた自信に繋がる。",senior:"釣りをしているお兄さんを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。風を切るような足取りで、あっという間に目的の角まで辿り着いた。これからのコンテストに向けた自信に繋がる。"},
  {area:"beach",stat1:"happiness",amt1:10,stat2:"stamina",amt2:5,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。静かな時間が、二人の間に流れていく。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。静かな時間が、二人の間に流れていく。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"happiness",amt1:10,stat2:"spring",amt2:5,puppy:"砂浜で穴を掘る小さなカニを見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。賑やかな話し声が、遠くで聞こえている。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。賑やかな話し声が、遠くで聞こえている。",senior:"流木を優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。賑やかな話し声が、遠くで聞こえている。"},
  {area:"beach",stat1:"happiness",amt1:10,stat2:"focus",amt2:5,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。足元のアスファルトが、少しだけ温かい。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。足元のアスファルトが、少しだけ温かい。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。足元のアスファルトが、少しだけ温かい。"},
  {area:"mountain",stat1:"happiness",amt1:10,stat2:"coat",amt2:1,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。風が心地よく、耳元を通り抜けていった。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。風が心地よく、耳元を通り抜けていった。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。風が心地よく、耳元を通り抜けていった。"},
  {area:"mountain",stat1:"happiness",amt1:10,stat2:"charm",amt2:1,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。周囲の空気までもが華やぐようだ。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。周囲の空気までもが華やぐようだ。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。周囲の空気までもが華やぐようだ。"},
  {area:"mountain",stat1:"happiness",amt1:10,stat2:"style",amt2:1,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。道行く人が思わず笑顔をこぼしている。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。道行く人が思わず笑顔をこぼしている。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。道行く人が思わず笑顔をこぼしている。"},
  {area:"mountain",stat1:"happiness",amt1:10,stat2:"intelligence",amt2:1,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。あなたは誇らしい気持ちでリードを握った。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。あなたは誇らしい気持ちでリードを握った。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。撫でられて満足そうに目を細め、幸せそうな吐息をついた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。あなたは誇らしい気持ちでリードを握った。"},
  {area:"park",stat1:"happiness",amt1:10,stat2:"luck",amt2:1,puppy:"木の上から見下ろすカラスを見つけると、●●は夢中で駆け寄った。撫でられて満足そうに目を細め、幸せそうな吐息をついた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。これからのコンテストに向けた自信に繋がる。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。撫でられて満足そうに目を細め、幸せそうな吐息をついた。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。これからのコンテストに向けた自信に繋がる。",senior:"散歩仲間のゴールデンレトリバーを優しく見守るように、●●は足を止めた。あなたの顔を何度も見上げ、足取り軽く並んで歩いている。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。これからのコンテストに向けた自信に繋がる。"},
  {area:"park",stat1:"sleepiness",amt1:10,stat2:"fatigue",amt2:10,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。静かな時間が、二人の間に流れていく。",adult:"ベンチで新聞を読むおじいさんに対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。静かな時間が、二人の間に流れていく。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。舌を出し、いつもより歩調を落としてゆっくりと歩いている。静かな時間が、二人の間に流れていく。"},
  {area:"city",stat1:"sleepiness",amt1:10,stat2:null,amt2:-10,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。賑やかな話し声が、遠くで聞こえている。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。道行く人を次々と誘うように、活発に動き回っている。賑やかな話し声が、遠くで聞こえている。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:"sleepiness",amt1:10,stat2:"discipline",amt2:-5,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。足元のアスファルトが、少しだけ温かい。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。横断歩道の前で、指示される前にぴたっとお座りをして待機した。足元のアスファルトが、少しだけ温かい。",senior:"散歩仲間のゴールデンレトリバーを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。横断歩道の前で、指示される前にぴたっとお座りをして待機した。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"sleepiness",amt1:10,stat2:"speed",amt2:-5,puppy:"流木を見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風が心地よく、耳元を通り抜けていった。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風が心地よく、耳元を通り抜けていった。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風が心地よく、耳元を通り抜けていった。"},
  {area:"city",stat1:"sleepiness",amt1:10,stat2:"stamina",amt2:-5,puppy:"店先の招き猫を見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。周囲の空気までもが華やぐようだ。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。周囲の空気までもが華やぐようだ。",senior:"登校中の小学生たちを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"sleepiness",amt1:10,stat2:"spring",amt2:-5,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。道行く人が思わず笑顔をこぼしている。",adult:"芝生でヨガをするグループに対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。道行く人が思わず笑顔をこぼしている。",senior:"芝生でヨガをするグループを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。道行く人が思わず笑顔をこぼしている。"},
  {area:"mountain",stat1:"sleepiness",amt1:10,stat2:"focus",amt2:-5,puppy:"休憩中の登山グループを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。あなたは誇らしい気持ちでリードを握った。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。あなたは誇らしい気持ちでリードを握った。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"sleepiness",amt1:10,stat2:"coat",amt2:-1,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。これからのコンテストに向けた自信に繋がる。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。これからのコンテストに向けた自信に繋がる。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。これからのコンテストに向けた自信に繋がる。"},
  {area:"city",stat1:"sleepiness",amt1:10,stat2:"charm",amt2:-1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。静かな時間が、二人の間に流れていく。",adult:"お洒落なカフェの店員さんに対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。静かな時間が、二人の間に流れていく。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"sleepiness",amt1:10,stat2:"style",amt2:-1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。賑やかな話し声が、遠くで聞こえている。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。賑やかな話し声が、遠くで聞こえている。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"sleepiness",amt1:10,stat2:"intelligence",amt2:-1,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。足元のアスファルトが、少しだけ温かい。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。足元のアスファルトが、少しだけ温かい。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。歩きながら大きなあくびをして、今にもその場で寝落ちしそうだ。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"sleepiness",amt1:10,stat2:"luck",amt2:-1,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。風が心地よく、耳元を通り抜けていった。",adult:"流木に対しても、●●は堂々と振る舞っている。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。風が心地よく、耳元を通り抜けていった。",senior:"釣りをしているお兄さんを優しく見守るように、●●は足を止めた。ベンチの横で座り込み、まどろみながらあなたの指示を待っている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。風が心地よく、耳元を通り抜けていった。"},
  {area:"mountain",stat1:"fatigue",amt1:10,stat2:null,amt2:-10,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。舌を出し、いつもより歩調を落としてゆっくりと歩いている。道行く人を次々と誘うように、活発に動き回っている。周囲の空気までもが華やぐようだ。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。周囲の空気までもが華やぐようだ。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。周囲の空気までもが華やぐようだ。"},
  {area:"city",stat1:"fatigue",amt1:10,stat2:"discipline",amt2:5,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。道行く人が思わず笑顔をこぼしている。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。道行く人が思わず笑顔をこぼしている。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。道行く人が思わず笑顔をこぼしている。"},
  {area:"beach",stat1:"fatigue",amt1:10,stat2:"speed",amt2:5,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。あなたは誇らしい気持ちでリードを握った。",adult:"空を旋回するカモメに対しても、●●は堂々と振る舞っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。あなたは誇らしい気持ちでリードを握った。",senior:"流木を優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。風を切るような足取りで、あっという間に目的の角まで辿り着いた。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"fatigue",amt1:10,stat2:"stamina",amt2:5,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。これからのコンテストに向けた自信に繋がる。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。何キロも歩いた後でも、力強い足取りであなたをリードしている。これからのコンテストに向けた自信に繋がる。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。これからのコンテストに向けた自信に繋がる。"},
  {area:"beach",stat1:"fatigue",amt1:10,stat2:"spring",amt2:5,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。静かな時間が、二人の間に流れていく。",adult:"空を旋回するカモメに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。静かな時間が、二人の間に流れていく。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。静かな時間が、二人の間に流れていく。"},
  {area:"mountain",stat1:"fatigue",amt1:10,stat2:"focus",amt2:5,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。賑やかな話し声が、遠くで聞こえている。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。賑やかな話し声が、遠くで聞こえている。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:"fatigue",amt1:10,stat2:"coat",amt2:-1,puppy:"鳩の群れを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。足元のアスファルトが、少しだけ温かい。",adult:"噴水で遊ぶ子供たちに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。足元のアスファルトが、少しだけ温かい。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"fatigue",amt1:10,stat2:"charm",amt2:-1,puppy:"砂浜で穴を掘る小さなカニを見つけると、●●は夢中で駆け寄った。舌を出し、いつもより歩調を落としてゆっくりと歩いている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。風が心地よく、耳元を通り抜けていった。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。風が心地よく、耳元を通り抜けていった。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。風が心地よく、耳元を通り抜けていった。"},
  {area:"mountain",stat1:"fatigue",amt1:10,stat2:"style",amt2:-1,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。舌を出し、いつもより歩調を落としてゆっくりと歩いている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。周囲の空気までもが華やぐようだ。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。周囲の空気までもが華やぐようだ。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"fatigue",amt1:10,stat2:"intelligence",amt2:1,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。道行く人が思わず笑顔をこぼしている。",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。道行く人が思わず笑顔をこぼしている。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現れて",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。舌を出し、いつもより歩調を落としてゆっくりと歩いている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。道行く人が思わず笑顔をこぼしている。"},
  {area:"park",stat1:"fatigue",amt1:10,stat2:"luck",amt2:1,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。舌を出し、いつもより歩調を落としてゆっくりと歩いている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。あなたは誇らしい気持ちでリードを握った。",adult:"噴水で遊ぶ子供たちに対しても、●●は堂々と振る舞っている。舌を出し、いつもより歩調を落としてゆっくりと歩いている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。あなたは誇らしい気持ちでリードを握った。",senior:"散歩仲間のゴールデンレトリバーを優しく見守るように、●●は足を止めた。段差の前で立ち止まり、少しだけ休憩したそうな目で見つめてきた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。あなたは誇らしい気持ちでリードを握った。"},
  {area:"beach",stat1:null,amt1:10,stat2:"discipline",amt2:5,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。横断歩道の前で、指示される前にぴたっとお座りをして待機した。これからのコンテストに向けた自信に繋がる。",adult:"流木に対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。これからのコンテストに向けた自信に繋がる。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。これからのコンテストに向けた自信に繋がる。"},
  {area:"city",stat1:null,amt1:10,stat2:"speed",amt2:5,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。静かな時間が、二人の間に流れていく。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風を切るような足取りで、あっという間に目的の角まで辿り着いた。静かな時間が、二人の間に流れていく。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現れてい",senior:"信号待ちのジョギング中の女性を優しく見守るように、●●は足を止めた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。風を切るような足取りで、あっという間に目的の角まで辿り着いた。静かな時間が、二人の間に流れていく。"},
  {area:"park",stat1:null,amt1:10,stat2:"stamina",amt2:5,puppy:"鳩の群れを見つけると、●●は夢中で駆け寄った。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。何キロも歩いた後でも、力強い足取りであなたをリードしている。賑やかな話し声が、遠くで聞こえている。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。賑やかな話し声が、遠くで聞こえている。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:null,amt1:10,stat2:"spring",amt2:5,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。足元のアスファルトが、少しだけ温かい。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。足元のアスファルトが、少しだけ温かい。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。足元のアスファルトが、少しだけ温かい。"},
  {area:"park",stat1:null,amt1:10,stat2:"focus",amt2:5,puppy:"鳩の群れを見つけると、●●は夢中で駆け寄った。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。風が心地よく、耳元を通り抜けていった。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。風が心地よく、耳元を通り抜けていった。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。風が心地よく、耳元を通り抜けていった。"},
  {area:"city",stat1:null,amt1:10,stat2:"coat",amt2:1,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。周囲の空気までもが華やぐようだ。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。周囲の空気までもが華やぐようだ。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。周囲の空気までもが華やぐようだ。"},
  {area:"city",stat1:null,amt1:10,stat2:"charm",amt2:1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。道行く人が思わず笑顔をこぼしている。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。道行く人が思わず笑顔をこぼしている。",senior:"店先の招き猫を優しく見守るように、●●は足を止めた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:null,amt1:10,stat2:"style",amt2:1,puppy:"宅配便のトラックを見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。あなたは誇らしい気持ちでリードを握った。",adult:"お洒落なカフェの店員さんに対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。あなたは誇らしい気持ちでリードを握った。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。あなたは誇らしい気持ちでリードを握った。"},
  {area:"mountain",stat1:null,amt1:10,stat2:"intelligence",amt2:1,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。これからのコンテストに向けた自信に繋がる。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。これからのコンテストに向けた自信に繋がる。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。道行く人を次々と誘うように、活発に動き回っている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:null,amt1:10,stat2:"luck",amt2:1,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。道行く人を次々と誘うように、活発に動き回っている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。静かな時間が、二人の間に流れていく。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。道行く人を次々と誘うように、活発に動き回っている。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。静かな時間が、二人の間に流れていく。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。全身からエネルギーが溢れ、どんな障害物も軽々と乗り越えていく。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。静かな時間が、二人の間に流れていく。"},
  {area:"mountain",stat1:"discipline",amt1:5,stat2:"speed",amt2:5,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。風を切るような足取りで、あっという間に目的の角まで辿り着いた。賑やかな話し声が、遠くで聞こえている。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。賑やかな話し声が、遠くで聞こえている。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。賑やかな話し声が、遠くで聞こえている。"},
  {area:"beach",stat1:"discipline",amt1:5,stat2:"stamina",amt2:5,puppy:"流木を見つけると、●●は夢中で駆け寄った。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。何キロも歩いた後でも、力強い足取りであなたをリードしている。足元のアスファルトが、少しだけ温かい。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。何キロも歩いた後でも、力強い足取りであなたをリードしている。足元のアスファルトが、少しだけ温かい。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。何キロも歩いた後でも、力強い足取りであなたをリードしている。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"discipline",amt1:5,stat2:"spring",amt2:5,puppy:"散歩中のチワワを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。風が心地よく、耳元を通り抜けていった。",adult:"流木に対しても、●●は堂々と振る舞っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。風が心地よく、耳元を通り抜けていった。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。風が心地よく、耳元を通り抜けていった。"},
  {area:"city",stat1:"discipline",amt1:5,stat2:"focus",amt2:5,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。周囲の空気までもが華やぐようだ。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。周囲の空気までもが華やぐようだ。",senior:"宅配便のトラックを優しく見守るように、●●は足を止めた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"discipline",amt1:5,stat2:"coat",amt2:-1,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。道行く人が思わず笑顔をこぼしている。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。道行く人が思わず笑顔をこぼしている。",senior:"噴水で遊ぶ子供たちを優しく見守るように、●●は足を止めた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。道行く人が思わず笑顔をこぼしている。"},
  {area:"mountain",stat1:"discipline",amt1:5,stat2:"charm",amt2:-1,puppy:"道端の野イチゴを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。あなたは誇らしい気持ちでリードを握った。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。あなたは誇らしい気持ちでリードを握った。",senior:"休憩中の登山グループを優しく見守るように、●●は足を止めた。横断歩道の前で、指示される前にぴたっとお座りをして待機した。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。あなたは誇らしい気持ちでリードを握った。"},
  {area:"mountain",stat1:"discipline",amt1:5,stat2:"style",amt2:-1,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。これからのコンテストに向けた自信に繋がる。",adult:"茂みの中で動くトカゲに対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。これからのコンテストに向けた自信に繋がる。",senior:"鳴いているセミを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"discipline",amt1:5,stat2:"intelligence",amt2:1,puppy:"茂みの中で動くトカゲを見つけると、●●は夢中で駆け寄った。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。静かな時間が、二人の間に流れていく。",adult:"茂みの中で動くトカゲに対しても、●●は堂々と振る舞っている。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。静かな時間が、二人の間に流れていく。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。静かな時間が、二人の間に流れていく。"},
  {area:"mountain",stat1:"discipline",amt1:5,stat2:"luck",amt2:1,puppy:"茂みの中で動くトカゲを見つけると、●●は夢中で駆け寄った。横断歩道の前で、指示される前にぴたっとお座りをして待機した。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。賑やかな話し声が、遠くで聞こえている。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。横断歩道の前で、指示される前にぴたっとお座りをして待機した。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。賑やかな話し声が、遠くで聞こえている。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。誘惑の多い場所でも、あなたの歩幅に合わせて静かに歩き続けた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"speed",amt1:5,stat2:"stamina",amt2:5,puppy:"すれ違う本格的なハイカーを見つけると、●●は夢中で駆け寄った。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。何キロも歩いた後でも、力強い足取りであなたをリードしている。足元のアスファルトが、少しだけ温かい。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。足元のアスファルトが、少しだけ温かい。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。足元のアスファルトが、少しだけ温かい。"},
  {area:"park",stat1:"speed",amt1:5,stat2:"spring",amt2:5,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。風が心地よく、耳元を通り抜けていった。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。風が心地よく、耳元を通り抜けていった。",senior:"ベンチで新聞を読むおじいさんを優しく見守るように、●●は足を止めた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"speed",amt1:5,stat2:"focus",amt2:5,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。周囲の空気までもが華やぐようだ。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。周囲の空気までもが華やぐようだ。",senior:"流木を優しく見守るように、●●は足を止めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。周囲の空気までもが華やぐようだ。"},
  {area:"mountain",stat1:"speed",amt1:5,stat2:"coat",amt2:-1,puppy:"茂みの中で動くトカゲを見つけると、●●は夢中で駆け寄った。風を切るような足取りで、あっという間に目的の角まで辿り着いた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。道行く人が思わず笑顔をこぼしている。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。道行く人が思わず笑顔をこぼしている。",senior:"鳴いているセミを優しく見守るように、●●は足を止めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。道行く人が思わず笑顔をこぼしている。"},
  {area:"mountain",stat1:"speed",amt1:5,stat2:"charm",amt2:-1,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。あなたは誇らしい気持ちでリードを握った。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。あなたは誇らしい気持ちでリードを握った。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"speed",amt1:5,stat2:"style",amt2:-1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。風を切るような足取りで、あっという間に目的の角まで辿り着いた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。これからのコンテストに向けた自信に繋がる。",adult:"お洒落なカフェの店員さんに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。これからのコンテストに向けた自信に繋がる。",senior:"信号待ちのジョギング中の女性を優しく見守るように、●●は足を止めた。風を切るような足取りで、あっという間に目的の角まで辿り着いた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"speed",amt1:5,stat2:"intelligence",amt2:-1,puppy:"木陰から顔を出すリスを見つけると、●●は夢中で駆け寄った。風を切るような足取りで、あっという間に目的の角まで辿り着いた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。静かな時間が、二人の間に流れていく。",adult:"道端の野イチゴに対しても、●●は堂々と振る舞っている。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。静かな時間が、二人の間に流れていく。",senior:"道端の野イチゴを優しく見守るように、●●は足を止めた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"speed",amt1:5,stat2:"luck",amt2:-1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。賑やかな話し声が、遠くで聞こえている。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。風を切るような足取りで、あっという間に目的の角まで辿り着いた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。賑やかな話し声が、遠くで聞こえている。",senior:"波打ち際を走るサーファーを優しく見守るように、●●は足を止めた。一瞬の隙も見せず、素早い身のこなしで周囲を驚かせた。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"stamina",amt1:5,stat2:"spring",amt2:5,puppy:"休憩中の登山グループを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。足元のアスファルトが、少しだけ温かい。",adult:"休憩中の登山グループに対しても、●●は堂々と振る舞っている。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。足元のアスファルトが、少しだけ温かい。",senior:"木陰から顔を出すリスを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"stamina",amt1:5,stat2:"focus",amt2:5,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。風が心地よく、耳元を通り抜けていった。",adult:"流木に対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。風が心地よく、耳元を通り抜けていった。",senior:"流木を優しく見守るように、●●は足を止めた。何キロも歩いた後でも、力強い足取りであなたをリードしている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。風が心地よく、耳元を通り抜けていった。"},
  {area:"park",stat1:"stamina",amt1:5,stat2:"coat",amt2:-1,puppy:"噴水で遊ぶ子供たちを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。周囲の空気までもが華やぐようだ。",adult:"鳩の群れに対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。周囲の空気までもが華やぐようだ。",senior:"噴水で遊ぶ子供たちを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。周囲の空気までもが華やぐようだ。"},
  {area:"mountain",stat1:"stamina",amt1:5,stat2:"charm",amt2:-1,puppy:"茂みの中で動くトカゲを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。道行く人が思わず笑顔をこぼしている。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。道行く人が思わず笑顔をこぼしている。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。道行く人が思わず笑顔をこぼしている。"},
  {area:"park",stat1:"stamina",amt1:5,stat2:"style",amt2:-1,puppy:"ベンチで新聞を読むおじいさんを見つけると、●●は夢中で駆け寄った。何キロも歩いた後でも、力強い足取りであなたをリードしている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。あなたは誇らしい気持ちでリードを握った。",adult:"木の上から見下ろすカラスに対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。あなたは誇らしい気持ちでリードを握った。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。何キロも歩いた後でも、力強い足取りであなたをリードしている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"stamina",amt1:5,stat2:"intelligence",amt2:-1,puppy:"登校中の小学生たちを見つけると、●●は夢中で駆け寄った。何キロも歩いた後でも、力強い足取りであなたをリードしている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。これからのコンテストに向けた自信に繋がる。",adult:"信号待ちのジョギング中の女性に対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。これからのコンテストに向けた自信に繋がる。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現れ",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。これからのコンテストに向けた自信に繋がる。"},
  {area:"park",stat1:"stamina",amt1:5,stat2:"luck",amt2:-1,puppy:"木の上から見下ろすカラスを見つけると、●●は夢中で駆け寄った。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。静かな時間が、二人の間に流れていく。",adult:"ベンチで新聞を読むおじいさんに対しても、●●は堂々と振る舞っている。何キロも歩いた後でも、力強い足取りであなたをリードしている。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。静かな時間が、二人の間に流れていく。",senior:"芝生でヨガをするグループを優しく見守るように、●●は足を止めた。長い階段を上りきっても、呼吸を乱すことなく余裕の表情だ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。静かな時間が、二人の間に流れていく。"},
  {area:"city",stat1:"spring",amt1:5,stat2:"focus",amt2:5,puppy:"店先の招き猫を見つけると、●●は夢中で駆け寄った。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。賑やかな話し声が、遠くで聞こえている。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。賑やかな話し声が、遠くで聞こえている。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:"spring",amt1:5,stat2:"coat",amt2:-1,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。足元のアスファルトが、少しだけ温かい。",adult:"ベンチで新聞を読むおじいさんに対しても、●●は堂々と振る舞っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。足元のアスファルトが、少しだけ温かい。",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。足元のアスファルトが、少しだけ温かい。"},
  {area:"beach",stat1:"spring",amt1:5,stat2:"charm",amt2:-1,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。風が心地よく、耳元を通り抜けていった。",adult:"流木に対しても、●●は堂々と振る舞っている。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。風が心地よく、耳元を通り抜けていった。",senior:"釣りをしているお兄さんを優しく見守るように、●●は足を止めた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"spring",amt1:5,stat2:"style",amt2:-1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。周囲の空気までもが華やぐようだ。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。周囲の空気までもが華やぐようだ。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。周囲の空気までもが華やぐようだ。"},
  {area:"park",stat1:"spring",amt1:5,stat2:"intelligence",amt2:-1,puppy:"芝生でヨガをするグループを見つけると、●●は夢中で駆け寄った。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。道行く人が思わず笑顔をこぼしている。",adult:"ベンチで新聞を読むおじいさんに対しても、●●は堂々と振る舞っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。道行く人が思わず笑顔をこぼしている。",senior:"鳩の群れを優しく見守るように、●●は足を止めた。足元の溝を驚異的な跳躍で飛び越え、着地も見事に決めた。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。道行く人が思わず笑顔をこぼしている。"},
  {area:"mountain",stat1:"spring",amt1:5,stat2:"luck",amt2:-1,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。あなたは誇らしい気持ちでリードを握った。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。あなたは誇らしい気持ちでリードを握った。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。高い縁石にひらりと飛び乗り、抜群の身体能力を見せつけた。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。あなたは誇らしい気持ちでリードを握った。"},
  {area:"beach",stat1:"focus",amt1:5,stat2:"coat",amt2:1,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。これからのコンテストに向けた自信に繋がる。",adult:"波打ち際を走るサーファーに対しても、●●は堂々と振る舞っている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。これからのコンテストに向けた自信に繋がる。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。これからのコンテストに向けた自信に繋がる。"},
  {area:"mountain",stat1:"focus",amt1:5,stat2:"charm",amt2:1,puppy:"休憩中の登山グループを見つけると、●●は夢中で駆け寄った。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。静かな時間が、二人の間に流れていく。",adult:"鳴いているセミに対しても、●●は堂々と振る舞っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。静かな時間が、二人の間に流れていく。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。静かな時間が、二人の間に流れていく。"},
  {area:"beach",stat1:"focus",amt1:5,stat2:"style",amt2:1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。賑やかな話し声が、遠くで聞こえている。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。賑やかな話し声が、遠くで聞こえている。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。賑やかな話し声が、遠くで聞こえている。"},
  {area:"park",stat1:"focus",amt1:5,stat2:"intelligence",amt2:1,puppy:"散歩仲間のゴールデンレトリバーを見つけると、●●は夢中で駆け寄った。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。足元のアスファルトが、少しだけ温かい。",adult:"散歩仲間のゴールデンレトリバーに対しても、●●は堂々と振る舞っている。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。足元のアスファルトが、少しだけ温かい。日頃の鍛錬の成果が、一歩一歩の力強い足取りに現",senior:"木の上から見下ろすカラスを優しく見守るように、●●は足を止めた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。足元のアスファルトが、少しだけ温かい。"},
  {area:"city",stat1:"focus",amt1:5,stat2:"luck",amt2:1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。風が心地よく、耳元を通り抜けていった。",adult:"宅配便のトラックに対しても、●●は堂々と振る舞っている。周囲の喧騒を一切無視し、あなたの合図だけに全神経を注いでいる。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。風が心地よく、耳元を通り抜けていった。",senior:"自転車に乗ったおじさんを優しく見守るように、●●は足を止めた。獲物を狙うように一点を見つめ、微動だにせず状況を観察している。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。風が心地よく、耳元を通り抜けていった。"},
  {area:"beach",stat1:"coat",amt1:1,stat2:"charm",amt2:1,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。周囲の空気までもが華やぐようだ。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。周囲の空気までもが華やぐようだ。",senior:"砂浜で穴を掘る小さなカニを優しく見守るように、●●は足を止めた。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。周囲の空気までもが華やぐようだ。"},
  {area:"beach",stat1:"coat",amt1:1,stat2:"style",amt2:1,puppy:"波打ち際を走るサーファーを見つけると、●●は夢中で駆け寄った。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。道行く人が思わず笑顔をこぼしている。",adult:"散歩中のチワワに対しても、●●は堂々と振る舞っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。道行く人が思わず笑顔をこぼしている。",senior:"流木を優しく見守るように、●●は足を止めた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。道行く人が思わず笑顔をこぼしている。"},
  {area:"city",stat1:"coat",amt1:1,stat2:"intelligence",amt2:1,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。あなたは誇らしい気持ちでリードを握った。",adult:"登校中の小学生たちに対しても、●●は堂々と振る舞っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。あなたは誇らしい気持ちでリードを握った。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。あなたは誇らしい気持ちでリードを握った。"},
  {area:"city",stat1:"coat",amt1:1,stat2:"luck",amt2:1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。これからのコンテストに向けた自信に繋がる。",adult:"店先の招き猫に対しても、●●は堂々と振る舞っている。風に吹かれて毛が美しく流れ、周囲の目を釘付けにした。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。これからのコンテストに向けた自信に繋がる。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。ブラッシングしたての被毛が太陽を反射し、通行人が見惚れている。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。これからのコンテストに向けた自信に繋がる。"},
  {area:"beach",stat1:"charm",amt1:1,stat2:"style",amt2:1,puppy:"空を旋回するカモメを見つけると、●●は夢中で駆け寄った。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。静かな時間が、二人の間に流れていく。",adult:"砂浜で穴を掘る小さなカニに対しても、●●は堂々と振る舞っている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。静かな時間が、二人の間に流れていく。",senior:"空を旋回するカモメを優しく見守るように、●●は足を止めた。誰にでも尻尾を振って近づき、すぐにその場の人気者になった。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。静かな時間が、二人の間に流れていく。"},
  {area:"city",stat1:"charm",amt1:1,stat2:"intelligence",amt2:1,puppy:"信号待ちのジョギング中の女性を見つけると、●●は夢中で駆け寄った。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。賑やかな話し声が、遠くで聞こえている。",adult:"自転車に乗ったおじさんに対しても、●●は堂々と振る舞っている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。賑やかな話し声が、遠くで聞こえている。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。賑やかな話し声が、遠くで聞こえている。"},
  {area:"mountain",stat1:"charm",amt1:1,stat2:"luck",amt2:1,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。足元のアスファルトが、少しだけ温かい。",adult:"木陰から顔を出すリスに対しても、●●は堂々と振る舞っている。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。足元のアスファルトが、少しだけ温かい。",senior:"すれ違う本格的なハイカーを優しく見守るように、●●は足を止めた。通行人の足元に顔を寄せ、愛くるしい仕草で撫でてとせがんだ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。足元のアスファルトが、少しだけ温かい。"},
  {area:"mountain",stat1:"style",amt1:1,stat2:"intelligence",amt2:1,puppy:"鳴いているセミを見つけると、●●は夢中で駆け寄った。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。風が心地よく、耳元を通り抜けていった。",adult:"すれ違う本格的なハイカーに対しても、●●は堂々と振る舞っている。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。風が心地よく、耳元を通り抜けていった。",senior:"茂みの中で動くトカゲを優しく見守るように、●●は足を止めた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。風が心地よく、耳元を通り抜けていった。"},
  {area:"city",stat1:"style",amt1:1,stat2:"luck",amt2:1,puppy:"自転車に乗ったおじさんを見つけると、●●は夢中で駆け寄った。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。周囲の空気までもが華やぐようだ。",adult:"お洒落なカフェの店員さんに対しても、●●は堂々と振る舞っている。四肢を堂々と踏み出し、完成された美しいシルエットを披露した。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。周囲の空気までもが華やぐようだ。",senior:"お洒落なカフェの店員さんを優しく見守るように、●●は足を止めた。背筋をピンと伸ばした姿勢で、まるでモデルのような風格で歩く。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。周囲の空気までもが華やぐようだ。"},
  {area:"beach",stat1:"intelligence",amt1:1,stat2:"luck",amt2:1,puppy:"釣りをしているお兄さんを見つけると、●●は夢中で駆け寄った。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。偶然出会ったプロのトレーナーに、特別なコツを教えてもらった。道行く人が思わず笑顔をこぼしている。",adult:"釣りをしているお兄さんに対しても、●●は堂々と振る舞っている。複雑な分かれ道でも、以前通ったルートを正確に思い出して進んだ。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。",senior:"散歩中のチワワを優しく見守るように、●●は足を止めた。仕掛けのある看板の仕組みを理解したようで、賢い振る舞いを見せた。茂みの奥から、誰かが落とした珍しいおもちゃを見つけ出した。道行く人が思わず笑顔をこぼしている。"},
];
const STROLL_EVENT_CHANCE = 0.30;  // 散歩1回あたりの発生確率

// ── ショップカタログ（Excel goods.xlsx より実装）
const SHOP_CATALOG: ShopItem[] = [
  {id:'shop_001',name:'子犬用フード',category:'food',cost:10,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  興奮+5  幸福+5  眠気+5  疲労-5  活力+5',flavorText:'子犬用フード',phases:{puppy:true,adult:false,senior:false},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,arousal:5,happiness:5,sleepiness:5,fatigue:-5,vitality:5}},
  {id:'shop_002',name:'総合栄養食ドライフード',category:'food',cost:30,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  眠気+5  疲労-5  活力+10',flavorText:'総合栄養食ドライフード',phases:{puppy:false,adult:true,senior:false},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,sleepiness:5,fatigue:-5,vitality:10}},
  {id:'shop_003',name:'総合栄養食ウェットフード',category:'food',cost:30,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  興奮+10  眠気+5  疲労-5',flavorText:'総合栄養食ウェットフード',phases:{puppy:false,adult:true,senior:false},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,arousal:10,sleepiness:5,fatigue:-5}},
  {id:'shop_004',name:'おやつクッキー',category:'food',cost:30,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  幸福+10  眠気+5  疲労-5',flavorText:'おやつクッキー',phases:{puppy:true,adult:true,senior:false},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,happiness:10,sleepiness:5,fatigue:-5}},
  {id:'shop_005',name:'シニア_療法食ドライフード',category:'food',cost:50,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  眠気+5  疲労-5  活力+5  毛並み-1  寿命+1',flavorText:'シニア_療法食ドライフード',phases:{puppy:false,adult:false,senior:true},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,sleepiness:5,fatigue:-5,vitality:5,coat:-1,lifespan:1}},
  {id:'shop_006',name:'シニア_療法食ウェットフード',category:'food',cost:50,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  興奮+5  眠気+5  疲労-5  毛並み-1  寿命+1',flavorText:'シニア_療法食ウェットフード',phases:{puppy:false,adult:false,senior:true},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,arousal:5,sleepiness:5,fatigue:-5,coat:-1,lifespan:1}},
  {id:'shop_007',name:'シニア_関節・免疫等ケアサプリメント',category:'food',cost:50,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  眠気+5  疲労-5  毛並み-1  寿命+1',flavorText:'シニア_関節・免疫等ケアサプリメント',phases:{puppy:false,adult:false,senior:true},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,sleepiness:5,fatigue:-5,coat:-1,lifespan:1}},
  {id:'shop_008',name:'シニア_無添加おやつクッキー',category:'food',cost:50,sellPrice:0,rarity:'common',description:'空腹+20  汚れ+5  排泄+10  幸福+10  眠気+5  疲労-5  毛並み-1  寿命+1',flavorText:'シニア_無添加おやつクッキー',phases:{puppy:false,adult:false,senior:true},shopFreq:'daily',statEffects:{hunger:20,dirtiness:5,bladder:10,happiness:10,sleepiness:5,fatigue:-5,coat:-1,lifespan:1}},
  {id:'shop_009',name:'スタミナドリンク',category:'food',cost:100,sellPrice:0,rarity:'common',description:'スタミナドリンク',flavorText:'スタミナドリンク',phases:{puppy:true,adult:true,senior:true},shopFreq:'daily',staminaRestorePercent:1.0},
  {id:'shop_010',name:'トイレシーツ',category:'food',cost:30,sellPrice:0,rarity:'common',description:'汚れ-15',flavorText:'トイレシーツ',phases:{puppy:true,adult:true,senior:true},shopFreq:'daily',statEffects:{dirtiness:-15}},
  {id:'shop_011',name:'トイレマット',category:'food',cost:30,sellPrice:0,rarity:'common',description:'汚れ-15',flavorText:'トイレマット',phases:{puppy:true,adult:true,senior:true},shopFreq:'daily',statEffects:{dirtiness:-15}},
  {id:'shop_012',name:'防臭袋',category:'food',cost:30,sellPrice:0,rarity:'common',description:'汚れ-15',flavorText:'防臭袋',phases:{puppy:true,adult:true,senior:true},shopFreq:'daily',statEffects:{dirtiness:-15}},
  {id:'shop_013',name:'シニア_おむつ',category:'food',cost:50,sellPrice:0,rarity:'common',description:'汚れ-25  認知+1',flavorText:'シニア_おむつ',phases:{puppy:false,adult:false,senior:true},shopFreq:'daily',statEffects:{dirtiness:-25,cognition:1}},
  {id:'shop_014',name:'しつけ用・噛みぐせ防止スプレー',category:'food',cost:50,sellPrice:0,rarity:'common',description:'興奮-20',flavorText:'しつけ用・噛みぐせ防止スプレー',phases:{puppy:true,adult:true,senior:false},shopFreq:'daily',statEffects:{arousal:-20}},
  {id:'shop_015',name:'アジリティトンネル',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+30  速度+30  スタミナ+5  集中力+5',flavorText:'アジリティトンネル',phases:{puppy:false,adult:true,senior:false},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:30,speed:30,stamina:5,focus:5}},
  {id:'shop_016',name:'スラローム',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+30  規律+15  スタミナ+5  バネ+15  集中力+5',flavorText:'スラローム',phases:{puppy:false,adult:true,senior:false},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:30,discipline:15,stamina:5,spring:15,focus:5}},
  {id:'shop_017',name:'ジャンプハードル',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+30  スタミナ+5  バネ+30  集中力+5',flavorText:'ジャンプハードル',phases:{puppy:false,adult:true,senior:false},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:30,stamina:5,spring:30,focus:5}},
  {id:'shop_018',name:'犬用バランスボール・ディスク',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+30  規律+10  スタミナ+10  集中力+15',flavorText:'犬用バランスボール・ディスク',phases:{puppy:false,adult:true,senior:false},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:30,discipline:10,stamina:10,focus:15}},
  {id:'shop_019',name:'ノーズワークマット',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+15  集中力+20  知性+20',flavorText:'ノーズワークマット',phases:{puppy:true,adult:true,senior:true},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:15,focus:20,intelligence:20}},
  {id:'shop_020',name:'知育玩具',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+15  知性+30  認知+1',flavorText:'知育玩具',phases:{puppy:true,adult:true,senior:true},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:15,intelligence:30,cognition:1}},
  {id:'shop_021',name:'木製デンタルケアおもちゃ',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+15  知性+15  寿命+1',flavorText:'木製デンタルケアおもちゃ',phases:{puppy:true,adult:true,senior:true},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:15,intelligence:15,lifespan:1}},
  {id:'shop_022',name:'音の鳴るぬいぐるみ',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+15  知性+10',flavorText:'音の鳴るぬいぐるみ',phases:{puppy:true,adult:true,senior:true},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:15,intelligence:10}},
  {id:'shop_023',name:'電動ボール',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹+20  眠気+20  疲労+15  知性+10',flavorText:'電動ボール',phases:{puppy:true,adult:true,senior:true},shopFreq:'monthly',statEffects:{hunger:20,sleepiness:20,fatigue:15,intelligence:10}},
  {id:'shop_024',name:'ひんやり冷感ベッド',category:'food',cost:1000,sellPrice:0,rarity:'common',description:'興奮-100  寿命+100',flavorText:'ひんやり冷感ベッド',phases:{puppy:true,adult:true,senior:true},shopFreq:'yearly',statEffects:{arousal:-100,lifespan:100}},
  {id:'shop_025',name:'あたたか温感ベッド',category:'food',cost:1000,sellPrice:0,rarity:'common',description:'興奮-100  寿命+100',flavorText:'あたたか温感ベッド',phases:{puppy:true,adult:true,senior:true},shopFreq:'yearly',statEffects:{arousal:-100,lifespan:100}},
  {id:'shop_026',name:'ドーム型ハウス・ベッド',category:'food',cost:1000,sellPrice:0,rarity:'common',description:'興奮-100  寿命+100',flavorText:'ドーム型ハウス・ベッド',phases:{puppy:true,adult:true,senior:true},shopFreq:'yearly',statEffects:{arousal:-100,lifespan:100}},
  {id:'shop_027',name:'シニア_早食い防止フードボウル',category:'food',cost:300,sellPrice:0,rarity:'common',description:'空腹-100  寿命+10',flavorText:'シニア_早食い防止フードボウル',phases:{puppy:false,adult:false,senior:true},shopFreq:'monthly',statEffects:{hunger:-100,lifespan:10}},
  {id:'shop_028',name:'シニア_健康診断',category:'food',cost:1000,sellPrice:0,rarity:'common',description:'寿命+200',flavorText:'シニア_健康診断',phases:{puppy:false,adult:false,senior:true},shopFreq:'yearly',statEffects:{lifespan:200}},
  {id:'shop_029',name:'シニア_手術',category:'food',cost:5000,sellPrice:0,rarity:'common',description:'寿命+500',flavorText:'シニア_手術',phases:{puppy:false,adult:false,senior:true},shopFreq:'lifetime',statEffects:{lifespan:500},isSurgery:true},
  {id:'shop_030',name:'パピー服',category:'equipment',subCategory:'outfit',cost:150,sellPrice:45,rarity:'common',description:'スタイル+3',flavorText:'パピー服',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:3}},
  {id:'shop_031',name:'ワイシャツ',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'ワイシャツ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_032',name:'パジャマ・シャツ',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'パジャマ・シャツ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_033',name:'Ｔシャツ',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'Ｔシャツ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_034',name:'ポロ・シャツ',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'ポロ・シャツ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_035',name:'スモック・ブラウス',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'スモック・ブラウス',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_036',name:'パーカー',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'パーカー',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_037',name:'カーディガン',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'カーディガン',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_038',name:'タンクトップ',category:'equipment',subCategory:'outfit',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'タンクトップ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_039',name:'パピー帽',category:'equipment',subCategory:'hat',cost:200,sellPrice:60,rarity:'common',description:'スタイル+3',flavorText:'パピー帽',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:3}},
  {id:'shop_040',name:'中折れ帽',category:'equipment',subCategory:'hat',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'中折れ帽',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_041',name:'6パネルキャップ',category:'equipment',subCategory:'hat',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'6パネルキャップ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_042',name:'ワッチ',category:'equipment',subCategory:'hat',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'ワッチ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_043',name:'パピーシューズ',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+3',flavorText:'パピーシューズ',phases:{puppy:true,adult:false,senior:false},shopFreq:'lifetime',bonuses:{style:3}},
  {id:'shop_044',name:'カッターシューズ',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'カッターシューズ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_045',name:'コンフォートシューズ',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'コンフォートシューズ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_046',name:'スニーカー',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'スニーカー',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_047',name:'スリッパ',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'スリッパ',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_048',name:'ローファー',category:'equipment',subCategory:'shoes',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'ローファー',phases:{puppy:false,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_049',name:'ペットカート',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'ペットカート',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_050',name:'抱っこ紐',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'抱っこ紐',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_051',name:'リュック型キャリーバッグ',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'リュック型キャリーバッグ',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_052',name:'シンプルなハーネス',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シンプルなハーネス',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_053',name:'シンプルな首輪',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シンプルな首輪',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_054',name:'シンプルなネームプレート',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シンプルなネームプレート',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_055',name:'拾い食い・噛みつき防止マズル',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'拾い食い・噛みつき防止マズル',phases:{puppy:true,adult:true,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_056',name:'シニア_ドッグスロープ',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シニア_ドッグスロープ',phases:{puppy:false,adult:false,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_057',name:'シニア_エリザベスカラー',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シニア_エリザベスカラー',phases:{puppy:false,adult:false,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_058',name:'シニア_介護用歩行補助ハーネス',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シニア_介護用歩行補助ハーネス',phases:{puppy:false,adult:false,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  {id:'shop_059',name:'シニア_車椅子',category:'equipment',subCategory:'accessory',cost:200,sellPrice:60,rarity:'common',description:'スタイル+5',flavorText:'シニア_車椅子',phases:{puppy:false,adult:false,senior:true},shopFreq:'lifetime',bonuses:{style:5}},
  // ── 安楽死（例外保持）
  {id:'euthanasia',name:'安楽死',category:'food',cost:10000,sellPrice:0,rarity:'epic',
   description:'苦しみから解放し引退へ',flavorText:'苦しみの中にある愛犬を安らかに見送ることができます。',
   phases:{puppy:false,adult:false,senior:true},isEuthanasia:true},
];

// ── NPCミートアップ（v8）
const MEETUP_CHANCE              = 0.50;   // 散歩ループ1回あたりの遭遇確率
const MEETUP_KNOWN_DOG_CHANCE    = 0.35;   // 知っている犬が出る確率
const MEETUP_GIFT_CHANCE         = 0.15;   // 一緒に遊ぶ時のギフト確率
const MEETUP_INTIMACY_GREET      = 5;      // 挨拶で親密度+
const MEETUP_INTIMACY_PLAY       = 15;     // 一緒に遊ぶで親密度+
const MATE_INTIMACY_THRESHOLD    = 80;     // 番登録に必要な親密度
const WALK_STAMINA_CONTINUE_MIN  = 200;    // ループ継続に必要なスタミナ（能力値）
const STAMINA_RECOVERY_RATE   = 1 / 60;     // /game-min: 1ゲーム時間で0→maxStaminaに全快（比率）
const WALK_STAMINA_COST_NEW   = 200;         // 散歩スタミナ消費
const ACTIVITY_STAMINA_COST_BASE = 100;      // アクティビティ消費スタミナ（最小）
const ACTIVITY_STAMINA_COST_RAND = 51;       // + random(0〜50)  → 100〜150
const WALK_COAT_PENALTY       = 3;           // 散歩/アクティビティで毛並み-3
// ── 集中力（Focus）定数
const FOCUS_DECAY_RATE        = 0.05;        // /game-min: 自然減衰
const FOCUS_AROUSAL_DEBUFF_THRESHOLD = 80;   // 興奮度がこれ以上で集中力が急落
const FOCUS_AROUSAL_DEBUFF_RATE      = 0.30; // /game-min: 興奮デバフ時の減衰速度
const FOCUS_WINDOW_MAX_BOOST         = 0.25; // 集中力1000で判定窓+25%
const CONTEST_CYCLE_DAYS      = 30;          // 大会周期（日）
const CONTEST_ENTRY_START_DAY = 15;          // エントリー受付開始日
const CONTEST_ENTRY_END_DAY   = 17;          // エントリー受付終了日
const SCOUT_STYLE_THRESHOLD   = 70;          // スカウトイベント発動スタイル閾値
const SCOUT_CHARM_THRESHOLD   = 60;          // スカウトイベント発動愛嬌閾値
const STRAY_DOG_POWER_THRESHOLD = 2000;      // 野良犬撃退フィジカル合計閾値

const NPC_NAMES_MALE   = ['ポチ','コタロウ','レオ','マックス','クロ','ゴン','リク','ソラ'];
const NPC_NAMES_FEMALE = ['ハナ','モモ','サクラ','ユキ','ベル','ルナ','ミル','アン'];
const NPC_BREEDS       = ['柴犬','トイプードル','ゴールデン','ラブラドール','ダックスフント','シュナウザー','コーギー','ビーグル'];

// ── 散歩報酬
const WALK_COIN_BASE       = 12;
const WALK_COIN_RAND       = 18;   // + random(0〜WALK_COIN_RAND)
const WALK_ITEM_DROP_CHANCE = 0.35; // 幸運で最大+0.15
const WALK_STAT_GAIN_BASE  = 1;
const WALK_STAT_GAIN_RAND  = 2;    // speed/stamina +1〜3
const WALK_STAMINA_COST    = 200;   // 散歩でスタミナ能力値を消費

const WALK_UNIQUE_EVENT_CHANCE = 0.30;

const DEST_DEFS: Record<WalkDestination, {
  label: string; emoji: string; desc: string;
  genderBias: 'opposite' | 'same' | 'random';
}> = {
  city:    { label:'市街地', emoji:'🏙️', desc:'コイン・服・帽子ドロップ率高。固有: ショーウィンドウ→スタイル上昇',    genderBias:'random' },
  park:    { label:'公園',   emoji:'🌳', desc:'小物ドロップ率高・異性犬との遭遇率高。固有: 集団プレイボウ→協調性上昇', genderBias:'opposite' },
  beach:   { label:'海辺',   emoji:'🏖️', desc:'消費アイテムドロップ率高。固有: 海辺ダッシュ→スタミナ上昇',           genderBias:'random' },
  mountain:{ label:'山道',   emoji:'⛰️', desc:'靴ドロップ率高・同性犬との遭遇率高。固有: 動物の匂い→知性上昇',       genderBias:'same' },
  secret:  { label:'秘密の集い', emoji:'✨', desc:'レア以上のアイテムが確定ドロップ。名だたる名犬が集まる秘密の場所', genderBias:'random' },
};

// ── 散歩アイテムプール（Excel goods.xlsx より実装）
const WALK_ITEM_POOL: Array<Pick<InventoryItem,
  'name'|'rarity'|'bonuses'|'flavorText'|'phases'|'reqStatValue'|'legendaryEffect'
> & {category: ItemCategory}> = [
  {name:'ピンタック・シャツ',rarity:'rare',category:'outfit',bonuses:{style:7},flavorText:'ピンタック・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'パイロット・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'パイロット・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'アイビー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'アイビー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ネル・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ネル・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'テーパード・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'テーパード・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'オーバーシャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'オーバーシャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'サファリ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'サファリ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'テーラード・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'テーラード・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'バーバー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'バーバー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ボウリング・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ボウリング・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ベースボール・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ベースボール・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'アロハ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'アロハ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャンプ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'キャンプ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'グアヤベラ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'グアヤベラ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'クルタ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'クルタ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'バロン・タガログ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'バロン・タガログ',phases:{puppy:false,adult:true,senior:true}},
  {name:'タイフロント・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'タイフロント・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'スクラブ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'スクラブ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ケーシー',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ケーシー',phases:{puppy:false,adult:true,senior:true}},
  {name:'サイクル・ジャージ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'サイクル・ジャージ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ガウチョ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ガウチョ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ラガー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ラガー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'カシュクール',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'カシュクール',phases:{puppy:false,adult:true,senior:true}},
  {name:'サッシュ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'サッシュ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ペプラム・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ペプラム・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ルバシカ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ルバシカ',phases:{puppy:false,adult:true,senior:true}},
  {name:'チョリ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'チョリ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ギブソン・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ギブソン・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ジプシー・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ジプシー・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ヴィシヴァンカ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ヴィシヴァンカ',phases:{puppy:false,adult:true,senior:true}},
  {name:'モラ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'モラ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャバリア・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'キャバリア・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'パフィー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'パフィー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ボヘミアン・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ボヘミアン・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'スカーフ・タイ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'スカーフ・タイ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'カミサ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'カミサ',phases:{puppy:false,adult:true,senior:true}},
  {name:'クバヤ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'クバヤ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハビット・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ハビット・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'シャーリング・トップ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'シャーリング・トップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ベッティーナ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ベッティーナ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ミディ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ミディ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ピンタック･ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ピンタック･ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ジップアップ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ジップアップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'アーミー・セーター',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'アーミー・セーター',phases:{puppy:false,adult:true,senior:true}},
  {name:'フィッシャーマンズ・セーター',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'フィッシャーマンズ・セーター',phases:{puppy:false,adult:true,senior:true}},
  {name:'シェットランド・セーター',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'シェットランド・セーター',phases:{puppy:false,adult:true,senior:true}},
  {name:'バルキー・ニット',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'バルキー・ニット',phases:{puppy:false,adult:true,senior:true}},
  {name:'ロピー・セーター',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ロピー・セーター',phases:{puppy:false,adult:true,senior:true}},
  {name:'アンサンブル・ニット',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'アンサンブル・ニット',phases:{puppy:false,adult:true,senior:true}},
  {name:'レーシー・ニット',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'レーシー・ニット',phases:{puppy:false,adult:true,senior:true}},
  {name:'道化の服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,spring:50,style:10},flavorText:'道化の服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'武士の鎧',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,discipline:50,style:10},flavorText:'武士の鎧',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'忍びの胴着',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,speed:50,style:10},flavorText:'忍びの胴着',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'魔法使いの長衣',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,intelligence:50,style:10},flavorText:'魔法使いの長衣',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'僧侶のケープ',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,focus:50,style:10},flavorText:'僧侶のケープ',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'サラマーの神聖服',rarity:'legendary',category:'outfit',bonuses:{beauty_charm:4,luck:10,discipline:50,speed:50,stamina:50,spring:50,focus:50,intelligence:100,style:15},flavorText:'サラマーの神聖服',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'cognition_decay_0.95'},
  {name:'ガルムの魔胴着',rarity:'legendary',category:'outfit',bonuses:{beauty_charm:4,luck:-10,discipline:60,speed:60,stamina:60,spring:60,focus:60,intelligence:200,style:15},flavorText:'ガルムの魔胴着',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'beauty_contest_1.05'},
  {name:'ボーラーハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ボーラーハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'ポークパイ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ポークパイ',phases:{puppy:false,adult:true,senior:true}},
  {name:'クロッシェ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'クロッシェ',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャノチエ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'キャノチエ',phases:{puppy:false,adult:true,senior:true}},
  {name:'メトロハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'メトロハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'バケットハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'バケットハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'ブーニーハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ブーニーハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'トラッカーキャップ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'トラッカーキャップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ジェットキャップ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ジェットキャップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャスケット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'キャスケット',phases:{puppy:false,adult:true,senior:true}},
  {name:'マリン',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'マリン',phases:{puppy:false,adult:true,senior:true}},
  {name:'ワークキャップ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ワークキャップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'トラッパー',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'トラッパー',phases:{puppy:false,adult:true,senior:true}},
  {name:'ビーニー',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ビーニー',phases:{puppy:false,adult:true,senior:true}},
  {name:'オスロ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'オスロ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ニットガイド',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ニットガイド',phases:{puppy:false,adult:true,senior:true}},
  {name:'ヘッドラップ',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ヘッドラップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ヘアバンド',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ヘアバンド',phases:{puppy:false,adult:true,senior:true}},
  {name:'道化の帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,spring:50,style:10},flavorText:'道化の帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'武士の兜',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,discipline:50,style:10},flavorText:'武士の兜',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'忍びの面',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,speed:50,style:10},flavorText:'忍びの面',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'魔法使いの帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,intelligence:50,style:10},flavorText:'魔法使いの帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'僧侶の冠',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,focus:50,style:10},flavorText:'僧侶の冠',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'サラマーの神聖冠',rarity:'legendary',category:'hat',bonuses:{beauty_charm:4,luck:10,discipline:50,speed:50,stamina:50,spring:50,focus:50,intelligence:100,style:15},flavorText:'サラマーの神聖冠',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'cognition_decay_0.95'},
  {name:'ガルムの魔面',rarity:'legendary',category:'hat',bonuses:{beauty_charm:4,luck:-10,discipline:60,speed:60,stamina:60,spring:60,focus:60,intelligence:200,style:15},flavorText:'ガルムの魔面',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'beauty_contest_1.05'},
  {name:'Tストラップシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'Tストラップシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'アースシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'アースシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'イタリアンカットシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'イタリアンカットシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ウィングチップ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ウィングチップ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ウォータシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ウォータシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'オックスフォードシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'オックスフォードシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャンバスシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'キャンバスシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'グルカサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'グルカサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'サドルシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'サドルシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'シャネルシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'シャネルシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ジャーマントレーナー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ジャーマントレーナー',phases:{puppy:false,adult:true,senior:true}},
  {name:'ストレートチップシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ストレートチップシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'スペクテイターシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'スペクテイターシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'スポックシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'スポックシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'スポーツサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'スポーツサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ソックスブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ソックスブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'タッセルローファー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'タッセルローファー',phases:{puppy:false,adult:true,senior:true}},
  {name:'ダッドシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ダッドシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ダービーシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ダービーシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'チャッカブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'チャッカブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'チロリアンシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'チロリアンシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'トゥシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'トゥシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'トングサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'トングサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ドレスシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ドレスシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハイカットスニーカー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ハイカットスニーカー',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハンティングブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ハンティングブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'バブーシュ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'バブーシュ',phases:{puppy:false,adult:true,senior:true}},
  {name:'バルモラル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'バルモラル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ビスポークシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ビスポークシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ビットモカシン',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ビットモカシン',phases:{puppy:false,adult:true,senior:true}},
  {name:'ビーチサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ビーチサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ファーブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ファーブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'フラットシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'フラットシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ブローグ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ブローグ',phases:{puppy:false,adult:true,senior:true}},
  {name:'プリムソール',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'プリムソール',phases:{puppy:false,adult:true,senior:true}},
  {name:'ホワイトバックス',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ホワイトバックス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ミュールスニーカー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ミュールスニーカー',phases:{puppy:false,adult:true,senior:true}},
  {name:'メリージェーン',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'メリージェーン',phases:{puppy:false,adult:true,senior:true}},
  {name:'モカシン',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'モカシン',phases:{puppy:false,adult:true,senior:true}},
  {name:'モックシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'モックシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'モンキーブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'モンキーブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'モンクシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'モンクシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'レースアップブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'レースアップブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ローマンサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ローマンサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ワラビー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ワラビー',phases:{puppy:false,adult:true,senior:true}},
  {name:'道化の靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,spring:50,style:10},flavorText:'道化の靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'武士の脚甲',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,discipline:50,style:10},flavorText:'武士の脚甲',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'忍びの脚絆',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,speed:50,style:10},flavorText:'忍びの脚絆',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'魔法使いの履物',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,intelligence:50,style:10},flavorText:'魔法使いの履物',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'サラマーの神聖靴',rarity:'legendary',category:'shoes',bonuses:{beauty_charm:4,luck:10,discipline:50,speed:50,stamina:50,spring:50,focus:50,intelligence:100,style:15},flavorText:'サラマーの神聖靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'cognition_decay_0.95'},
  {name:'ガルムの魔靴',rarity:'legendary',category:'shoes',bonuses:{beauty_charm:4,luck:-10,discipline:60,speed:60,stamina:60,spring:60,focus:60,intelligence:200,style:15},flavorText:'ガルムの魔靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'beauty_contest_1.05'},
  {name:'クールなメガネ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'クールなメガネ',phases:{puppy:false,adult:true,senior:true}},
  {name:'学者メガネ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'学者メガネ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハート型スタイ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'ハート型スタイ',phases:{puppy:false,adult:true,senior:true}},
  {name:'リボンのネクタイ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'リボンのネクタイ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ビーズのネックレス',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'ビーズのネックレス',phases:{puppy:false,adult:true,senior:true}},
  {name:'貝のネックレス',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'貝のネックレス',phases:{puppy:false,adult:true,senior:true}},
  {name:'貴重そうな昔の硬貨',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'貴重そうな昔の硬貨',phases:{puppy:false,adult:true,senior:true}},
  {name:'きれいな鳥の羽',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'きれいな鳥の羽',phases:{puppy:false,adult:true,senior:true}},
  {name:'頑丈そうな棒',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'頑丈そうな棒',phases:{puppy:false,adult:true,senior:true}},
  {name:'大きな獣の骨',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'大きな獣の骨',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_安全',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_安全',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_金運',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_金運',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_縁結び',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_縁結び',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_学業',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_学業',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_厄除け',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_厄除け',phases:{puppy:false,adult:true,senior:true}},
  {name:'お守り_健康',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:2,style:7},flavorText:'お守り_健康',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_安全',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_安全',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_金運',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_金運',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_縁結び',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_縁結び',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_学業',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_学業',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_厄除け',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_厄除け',phases:{puppy:false,adult:true,senior:true}},
  {name:'いわくつきのお守り_健康',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-2,style:7},flavorText:'いわくつきのお守り_健康',phases:{puppy:false,adult:true,senior:true}},
  {name:'居眠り公の首輪',rarity:'rare',category:'accessory',bonuses:{beauty_coat:30,beauty_charm:1,luck:-1,intelligence:50,style:7},flavorText:'居眠り公の首輪',phases:{puppy:false,adult:true,senior:true}},
  {name:'穴掘り狂の爪カバー',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-1,discipline:-50,focus:25,style:7},flavorText:'穴掘り狂の爪カバー',phases:{puppy:false,adult:true,senior:true}},
  {name:'蛮勇のぼろ布',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-1,discipline:-25,intelligence:-25,style:7},flavorText:'蛮勇のぼろ布',phases:{puppy:false,adult:true,senior:true}},
  {name:'貴金属のネックレス',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,discipline:10,speed:10,stamina:10,spring:10,focus:10,style:10},flavorText:'貴金属のネックレス',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'道化の小道具',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,spring:50,style:10},flavorText:'道化の小道具',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'武士の小刀',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,discipline:50,style:10},flavorText:'武士の小刀',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'忍びの七つ道具',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,speed:50,style:10},flavorText:'忍びの七つ道具',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'魔法使いの水晶',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,intelligence:50,style:10},flavorText:'魔法使いの水晶',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'僧侶のタリスマン',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,focus:50,style:10},flavorText:'僧侶のタリスマン',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'獣使いの匂い袋',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,style:10},flavorText:'獣使いの匂い袋',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'商人の計算機',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,style:10},flavorText:'商人の計算機',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'闘犬の化粧廻し',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,stamina:50,style:10},flavorText:'闘犬の化粧廻し',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'バフォメットの角飾',rarity:'legendary',category:'accessory',bonuses:{beauty_charm:4,luck:-5,discipline:100,speed:100,stamina:100,spring:100,focus:100,style:15},flavorText:'バフォメットの角飾',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000},
  {name:'パンドラの箱',rarity:'legendary',category:'accessory',bonuses:{beauty_charm:4,luck:-5,discipline:60,speed:60,stamina:60,spring:60,focus:60,intelligence:200,style:15},flavorText:'パンドラの箱',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000},
];

// ── 大会景品プール（Excel goods.xlsx より実装）
const CONTEST_ITEM_POOL: Array<Pick<InventoryItem,
  'name'|'rarity'|'bonuses'|'flavorText'|'phases'|'reqStatValue'|'legendaryEffect'
> & {category: ItemCategory}> = [
  {name:'ポリス・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ポリス・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ウェスタン・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ウェスタン・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャバルリー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'キャバルリー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ミリタリー・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ミリタリー・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'コック・コート',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'コック・コート',phases:{puppy:false,adult:true,senior:true}},
  {name:'メディカル・スモック',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'メディカル・スモック',phases:{puppy:false,adult:true,senior:true}},
  {name:'ガリバルディ・シャツ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ガリバルディ・シャツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ヴィクトリア・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ヴィクトリア・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'パイレーツ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'パイレーツ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'チャイナ・ブラウス',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'チャイナ・ブラウス',phases:{puppy:false,adult:true,senior:true}},
  {name:'ノルディック・セーター',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'ノルディック・セーター',phases:{puppy:false,adult:true,senior:true}},
  {name:'チョゴリ',rarity:'rare',category:'outfit',bonuses:{beauty_charm:1,style:7},flavorText:'チョゴリ',phases:{puppy:false,adult:true,senior:true}},
  {name:'獣使いの胴着',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,style:10},flavorText:'獣使いの胴着',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'商人の服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,style:10},flavorText:'商人の服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'闘犬の服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,stamina:50,style:10},flavorText:'闘犬の服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'パトラッシュの服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,discipline:25,spring:25,style:10},flavorText:'パトラッシュの服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'ハチ公の服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,discipline:25,stamina:25,style:10},flavorText:'ハチ公の服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アルゴスの服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,speed:25,focus:25,style:10},flavorText:'アルゴスの服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'雪丸の服',rarity:'epic',category:'outfit',bonuses:{beauty_charm:2,focus:25,intelligence:25,style:10},flavorText:'雪丸の服',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アヌビスの裁定服',rarity:'legendary',category:'outfit',bonuses:{beauty_charm:4,luck:10,discipline:100,speed:50,stamina:50,spring:50,focus:50,intelligence:50,style:15},flavorText:'アヌビスの裁定服',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'lifespan_decay_0.95'},
  {name:'ケルベロスの地獄長衣',rarity:'legendary',category:'outfit',bonuses:{beauty_charm:4,luck:-10,discipline:100,speed:100,stamina:100,spring:100,focus:100,style:15},flavorText:'ケルベロスの地獄長衣',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'physical_contest_1.05'},
  {name:'トップハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'トップハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'キャペリン',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'キャペリン',phases:{puppy:false,adult:true,senior:true}},
  {name:'チューリップハット',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'チューリップハット',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハンチング',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ハンチング',phases:{puppy:false,adult:true,senior:true}},
  {name:'ベレー',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'ベレー',phases:{puppy:false,adult:true,senior:true}},
  {name:'イヤーマフラー',rarity:'rare',category:'hat',bonuses:{beauty_charm:1,style:7},flavorText:'イヤーマフラー',phases:{puppy:false,adult:true,senior:true}},
  {name:'獣使いの皮帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,style:10},flavorText:'獣使いの皮帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'商人の帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,style:10},flavorText:'商人の帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'闘犬の帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,stamina:50,style:10},flavorText:'闘犬の帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'パトラッシュの帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,discipline:25,spring:25,style:10},flavorText:'パトラッシュの帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'ハチ公の帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,discipline:25,stamina:25,style:10},flavorText:'ハチ公の帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アルゴスの帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,speed:25,focus:25,style:10},flavorText:'アルゴスの帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'雪丸の帽子',rarity:'epic',category:'hat',bonuses:{beauty_charm:2,focus:25,intelligence:25,style:10},flavorText:'雪丸の帽子',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アヌビスの裁定帽',rarity:'legendary',category:'hat',bonuses:{beauty_charm:4,luck:10,discipline:100,speed:50,stamina:50,spring:50,focus:50,intelligence:50,style:15},flavorText:'アヌビスの裁定帽',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'lifespan_decay_0.95'},
  {name:'ケルベロスの三つ首帽',rarity:'legendary',category:'hat',bonuses:{beauty_charm:4,luck:-10,discipline:100,speed:100,stamina:100,spring:100,focus:100,style:15},flavorText:'ケルベロスの三つ首帽',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'physical_contest_1.05'},
  {name:'オペラシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'オペラシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'カンフーシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'カンフーシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'スリッポン',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'スリッポン',phases:{puppy:false,adult:true,senior:true}},
  {name:'デザートブーツ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'デザートブーツ',phases:{puppy:false,adult:true,senior:true}},
  {name:'デッキシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'デッキシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'ナースサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ナースサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'ハイテクスニーカー',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'ハイテクスニーカー',phases:{puppy:false,adult:true,senior:true}},
  {name:'バレエシューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'バレエシューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'リカバリーサンダル',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'リカバリーサンダル',phases:{puppy:false,adult:true,senior:true}},
  {name:'草鞋',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'草鞋',phases:{puppy:false,adult:true,senior:true}},
  {name:'安全靴',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'安全靴',phases:{puppy:false,adult:true,senior:true}},
  {name:'足袋シューズ',rarity:'rare',category:'shoes',bonuses:{beauty_charm:1,style:7},flavorText:'足袋シューズ',phases:{puppy:false,adult:true,senior:true}},
  {name:'僧侶の履物',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,focus:50,style:10},flavorText:'僧侶の履物',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'獣使いの皮履物',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,style:10},flavorText:'獣使いの皮履物',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'商人の靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,style:10},flavorText:'商人の靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'闘犬の靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,stamina:50,style:10},flavorText:'闘犬の靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'パトラッシュの靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,discipline:25,spring:25,style:10},flavorText:'パトラッシュの靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'ハチ公の靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,discipline:25,stamina:25,style:10},flavorText:'ハチ公の靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アルゴスの靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,speed:25,focus:25,style:10},flavorText:'アルゴスの靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'雪丸の靴',rarity:'epic',category:'shoes',bonuses:{beauty_charm:2,focus:25,intelligence:25,style:10},flavorText:'雪丸の靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アヌビスの裁定靴',rarity:'legendary',category:'shoes',bonuses:{beauty_charm:4,luck:10,discipline:100,speed:50,stamina:50,spring:50,focus:50,intelligence:50,style:15},flavorText:'アヌビスの裁定靴',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'lifespan_decay_0.95'},
  {name:'ケルベロスの地獄脚絆',rarity:'legendary',category:'shoes',bonuses:{beauty_charm:4,luck:-10,discipline:100,speed:100,stamina:100,spring:100,focus:100,style:15},flavorText:'ケルベロスの地獄脚絆',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'physical_contest_1.05'},
  {name:'無駄吠え防止首輪',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'無駄吠え防止首輪',phases:{puppy:true,adult:true,senior:true}},
  {name:'蝶ネクタイ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'蝶ネクタイ',phases:{puppy:true,adult:true,senior:true}},
  {name:'しっぽスリーブ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'しっぽスリーブ',phases:{puppy:true,adult:true,senior:true}},
  {name:'ダリアの首輪',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'ダリアの首輪',phases:{puppy:false,adult:true,senior:true}},
  {name:'サングラス',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'サングラス',phases:{puppy:false,adult:true,senior:true}},
  {name:'バットマンマスク',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'バットマンマスク',phases:{puppy:false,adult:true,senior:true}},
  {name:'豪華なネームプレート',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'豪華なネームプレート',phases:{puppy:false,adult:true,senior:true}},
  {name:'豪華なハーネス',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'豪華なハーネス',phases:{puppy:false,adult:true,senior:true}},
  {name:'シニア_豪華なドッグスロープ',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'シニア_豪華なドッグスロープ',phases:{puppy:false,adult:false,senior:true}},
  {name:'シニア_豪華なエリザベスカラー',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'シニア_豪華なエリザベスカラー',phases:{puppy:false,adult:false,senior:true}},
  {name:'シニア_豪華な介護用歩行補助ハーネス',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'シニア_豪華な介護用歩行補助ハーネス',phases:{puppy:false,adult:false,senior:true}},
  {name:'シニア_豪華な車椅子',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,style:7},flavorText:'シニア_豪華な車椅子',phases:{puppy:false,adult:false,senior:true}},
  {name:'耳障りな鈴',rarity:'rare',category:'accessory',bonuses:{beauty_charm:1,luck:-1,focus:-50,style:7},flavorText:'耳障りな鈴',phases:{puppy:false,adult:true,senior:true}},
  {name:'宝石のネックレス',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,discipline:5,speed:5,stamina:5,spring:5,focus:5,intelligence:25,style:10},flavorText:'宝石のネックレス',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'パトラッシュのハーネス',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,discipline:25,spring:25,style:10},flavorText:'パトラッシュのハーネス',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'ハチ公の親愛首輪',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,discipline:25,stamina:25,style:10},flavorText:'ハチ公の親愛首輪',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'アルゴスの耳飾り',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,speed:25,focus:25,style:10},flavorText:'アルゴスの耳飾り',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'雪丸の数珠',rarity:'epic',category:'accessory',bonuses:{beauty_charm:2,luck:5,focus:25,intelligence:25,style:10},flavorText:'雪丸の数珠',phases:{puppy:false,adult:true,senior:true},reqStatValue:1500},
  {name:'聖杯',rarity:'legendary',category:'accessory',bonuses:{beauty_charm:4,luck:15,style:15},flavorText:'聖杯',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'dirt_bladder_rate_0.50'},
  {name:'黄金のリンゴ',rarity:'legendary',category:'accessory',bonuses:{beauty_charm:4,luck:15,style:15},flavorText:'黄金のリンゴ',phases:{puppy:false,adult:true,senior:true},reqStatValue:3000,legendaryEffect:'hunger_rate_0.50'},
];

const ACTION_LABELS: ActionLabel[] = [
  'eating','sleeping','playing','resting','toilet','wandering',
  'barking','exploring','fleeing','excessive_barking','destructive','fearful',
];

const ACTION_JP: Record<ActionLabel, string> = {
  eating:'ごはんを食べている', sleeping:'眠っている',
  playing:'はしゃいで遊んでいる！', resting:'のんびりくつろいでいる',
  toilet:'トイレをしている', wandering:'うろうろと徘徊している',
  barking:'わんわん吠えている！', exploring:'好奇心旺盛に探索している！',
  fleeing:'びくびくしながら逃げ回っている',
  excessive_barking:'延々と吠え続けている！！',
  destructive:'物を噛んで破壊している！！',
  fearful:'叱られて怯えて震えている...',
};

// ─────────────────────────────────────────────
// 画像アセット
// ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_DOG_IDLE    = require('./Images/shibainu_image_0_Idle.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_DOG_HAPPY   = require('./Images/shibainu_image_1_Happy.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_DOG_EXCITED = require('./Images/shibainu_image_2_Excited.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_DOG_SAD     = require('./Images/shibainu_image_3_Sad.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_DOG_SLEEP   = require('./Images/shibainu_image_4_Sleep.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_BG_MAIN     = require('./Images/Mein_image_0.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_BG_CLOSET   = require('./Images/closet_image_0.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_BG_SHOP     = require('./Images/shop_image_0.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_MAP         = require('./Images/Map_image_0.png');
const IMG_MAP_FULLSCREEN = require('./Images/Map_image_0.png');
// ── 散歩先・大会 背景画像 ──
const IMG_BG_ARENA    = require('./Images/Arena_image_0.png');
const IMG_BG_PHYSICAL_CONTEST = require('./Images/Physical contest_image_0.png');
const IMG_BG_BEAUTY_CONTEST   = require('./Images/Beauty contest_image_0.png');
const IMG_BG_NOSEWORK_CONTEST = require('./Images/Nosework contest_image_0.png');
const IMG_BG_BEACH    = require('./Images/Beach_image_0.png');
const IMG_BG_PARK     = require('./Images/Park_image_0.png');
const IMG_BG_TOWN     = require('./Images/Town_image_0.png');
const IMG_BG_TRAIL    = require('./Images/Trail_image_0.png');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const IMG_BG_END      = require('./Images/End_image_0.png');
// ── フィジカル大会用 ──
const IMG_HIGHJUMP_BAR  = require('./Images/Physical_HighJump_Bar_0.png');
const IMG_LONGRUN_GAUGE = require('./Images/Physical_LongRun_Gauge_0.png');
const IMG_OBE_ICON      = require('./Images/Physical_Obedience_Icon_0.png');
const IMG_OBE_SIT       = require('./Images/Obedience_Shit_image_0.png');
const IMG_OBE_DOWN      = require('./Images/Obedience_Down_image_0.png.png');
const IMG_OBE_STAY      = require('./Images/Obedience_Stay_image_0.png.png');
const IMG_BG_HIGHJUMP   = require('./Images/Physical Contest_ High Jump_image_0.png');
const IMG_BG_LONGRUN    = require('./Images/Physical_Long Run_image_0.png');
// ── ビューティー大会用 ──
const IMG_BG_BEAUTY_PHOTO_SESSION = require('./Images/Beauty contest_image_1.png');
// ── ノーズワーク大会用 ──
const IMG_NW_FIELD_BG   = require('./Images/Nosework contest_image_1.png');
// ── ノーズワーク 柴犬スプライトシート ──
const IMG_NW_SPRITE        = require('./Images/shibainu_nosework_grid.png');
const IMG_CONTEST_RESULT_BG = require('./Images/contest_result_background.png');

// ── 犬種別立ち絵画像 ──
const BREED_IMAGES: Record<string, {idle:any, happy:any, excited:any, sad:any, sleep:any}> = {
  'chihuahua': {
    idle:    require('./Images/chihuahua_image_0_Idle.png'),
    happy:   require('./Images/chihuahua_image_1_Happy.png'),
    excited: require('./Images/chihuahua_image_2_Excited.png'),
    sad:     require('./Images/chihuahua_image_3_Sad.png'),
    sleep:   require('./Images/chihuahua_image_4_Sleep.png'),
  },
  'dachshund': {
    idle:    require('./Images/dachshund_image_0_Idle.png'),
    happy:   require('./Images/dachshund_image_1_Happy.png'),
    excited: require('./Images/dachshund_image_2_Excited.png'),
    sad:     require('./Images/dachshund_image_3_Sad.png'),
    sleep:   require('./Images/dachshund_image_4_Sleep.png'),
  },
  'golden retriever': {
    idle:    require('./Images/golden retriever_image_0_Idle.png'),
    happy:   require('./Images/golden retriever_image_1_Happy.png'),
    excited: require('./Images/golden retriever_image_2_Excited.png'),
    sad:     require('./Images/golden retriever_image_3_Sad.png'),
    sleep:   require('./Images/golden retriever_image_4_Sleep.png'),
  },
  'shibainu': {
    idle:    require('./Images/shibainu_image_0_Idle.png'),
    happy:   require('./Images/shibainu_image_1_Happy.png'),
    excited: require('./Images/shibainu_image_2_Excited.png'),
    sad:     require('./Images/shibainu_image_3_Sad.png'),
    sleep:   require('./Images/shibainu_image_4_Sleep.png'),
  },
  'toy poodle': {
    idle:    require('./Images/toy poodle_image_0_Idle.png'),
    happy:   require('./Images/toy poodle_image_1_Happy.png'),
    excited: require('./Images/toy poodle_image_2_Excited.png'),
    sad:     require('./Images/toy poodle_image_3_Sad.png'),
    sleep:   require('./Images/toy poodle_image_4_Sleep.png'),
  },
};

// ── 犬種定義 ──
interface BreedDef {
  id:          string;
  labelJP:     string;   // 表示名（日本語）
  initialStats: {
    discipline: number; speed: number; stamina: number;
    spring: number; focus: number; intelligence: number;
  };
  // ステータス伸び率 (1.0 = 通常)
  growthMult: {
    hunger: number; dirtiness: number; bladder: number; arousal: number;
    happiness: number; sleepiness: number; fatigue: number; vitality: number;
    discipline: number; speed: number; stamina: number; spring: number;
    focus: number; coat: number; charm: number; style: number;
    intelligence: number; luck: number; attachment: number;
  };
  trait: string;  // 特性説明
}

const BREED_DEFS: BreedDef[] = [
  {
    id: 'chihuahua', labelJP: 'チワワ',
    initialStats: { discipline:170, speed:120, stamina:110, spring:130, focus:220, intelligence:170 },
    growthMult: { hunger:0.4, dirtiness:0.8, bladder:1.5, arousal:1.5, happiness:1.1, sleepiness:1, fatigue:1, vitality:1, discipline:1, speed:1, stamina:0.9, spring:1, focus:1, coat:1, charm:1.1, style:1, intelligence:1.1, luck:1, attachment:1 },
    trait: 'ビューティーコンテストの得点を1.05倍にする',
  },
  {
    id: 'dachshund', labelJP: 'ダックスフント',
    initialStats: { discipline:160, speed:140, stamina:220, spring:90, focus:250, intelligence:180 },
    growthMult: { hunger:0.6, dirtiness:1.5, bladder:1.1, arousal:1.3, happiness:1, sleepiness:1, fatigue:1, vitality:1, discipline:1, speed:1, stamina:1.1, spring:0.9, focus:1.1, coat:1, charm:1, style:1, intelligence:1, luck:1, attachment:1 },
    trait: '散歩中にアイテムを拾う確率を1.05倍にする',
  },
  {
    id: 'golden retriever', labelJP: 'ゴールデンレトリバー',
    initialStats: { discipline:260, speed:210, stamina:240, spring:180, focus:250, intelligence:240 },
    growthMult: { hunger:2, dirtiness:1.3, bladder:0.7, arousal:0.8, happiness:1, sleepiness:1, fatigue:1, vitality:1, discipline:1.1, speed:1, stamina:1, spring:1, focus:1, coat:1, charm:1, style:1, intelligence:1.1, luck:1, attachment:1 },
    trait: 'フィジカルコンテストの得点を1.05倍にする。散歩中に他の犬と遭遇する確率を1.05倍にする',
  },
  {
    id: 'shibainu', labelJP: '柴犬',
    initialStats: { discipline:140, speed:230, stamina:230, spring:220, focus:180, intelligence:190 },
    growthMult: { hunger:1, dirtiness:0.6, bladder:0.8, arousal:1, happiness:1, sleepiness:1, fatigue:1, vitality:1, discipline:1.1, speed:1, stamina:1.1, spring:1, focus:1, coat:1, charm:1, style:1, intelligence:1, luck:1, attachment:0.9 },
    trait: '「興奮」の上昇が最大でも90で止まる',
  },
  {
    id: 'toy poodle', labelJP: 'トイプードル',
    initialStats: { discipline:240, speed:190, stamina:170, spring:240, focus:210, intelligence:250 },
    growthMult: { hunger:0.5, dirtiness:1.1, bladder:1.2, arousal:1.2, happiness:1, sleepiness:1, fatigue:1, vitality:1, discipline:1, speed:1, stamina:1, spring:1, focus:1.1, coat:1, charm:1.1, style:1.1, intelligence:1, luck:1, attachment:1 },
    trait: '「スタイル」へのデバフ効果を無効にする',
  },
];

/** 犬種IDからBreedDefを取得 */
function getBreedDef(breedId: string): BreedDef {
  return BREED_DEFS.find(b => b.id === breedId) ?? BREED_DEFS.find(b => b.id === 'shibainu')!;
}

/** 犬種の成長倍率を取得 */
function getBreedMult(breedId: string, stat: keyof BreedDef['growthMult']): number {
  return getBreedDef(breedId).growthMult[stat] ?? 1.0;
}

/** ステータス上昇に犬種倍率を適用（能力値用） */
function applyBreedGain(gain: number, breedId: string, stat: keyof BreedDef['growthMult']): number {
  if(gain <= 0) return gain;
  return Math.max(1, Math.round(gain * getBreedMult(breedId, stat)));
}

// ─────────────────────────────────────────────
// 犬種プリセット
// ─────────────────────────────────────────────

interface PresetDef {
  label: string; description: string;
  personality: BigFive; typeName: string;
  toyFetchMult: number; toyChewMult: number;
}

const PRESETS: Record<DogPreset, PresetDef> = {
  random: {
    label:'ランダム', description:'ランダムに生成された個体',
    typeName:'バランス型', toyFetchMult:1.0, toyChewMult:1.0,
    personality:{openness:.5,conscientiousness:.5,extraversion:.5,agreeableness:.5,neuroticism:.5},
  },
  active: {
    label:'活発な個体', description:'外向的(E=0.85)・好奇心旺盛(O=0.75)。ボール大好き。',
    typeName:'外向・探索型', toyFetchMult:1.8, toyChewMult:0.5,
    personality:{openness:.75,conscientiousness:.50,extraversion:.85,agreeableness:.65,neuroticism:.20},
  },
  timid: {
    label:'臆病な個体', description:'神経症傾向高め(N=0.85)。ガムで落ち着く。',
    typeName:'内向・回避型', toyFetchMult:0.5, toyChewMult:1.5,
    personality:{openness:.35,conscientiousness:.55,extraversion:.20,agreeableness:.50,neuroticism:.85},
  },
};

// ─────────────────────────────────────────────
// 数学ユーティリティ
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// カレンダーシステム
// ─────────────────────────────────────────────

function gameCalendar(totalGameMin: number, gameMinsPerDay: number): { year: number; month: number; day: number } {
  const totalDays = Math.floor(totalGameMin / gameMinsPerDay);
  const totalMonthOffset = Math.floor(totalDays / DAYS_PER_MONTH) + (CALENDAR_START_MONTH - 1);
  const year = Math.floor(totalMonthOffset / MONTHS_PER_YEAR);
  const month = (totalMonthOffset % MONTHS_PER_YEAR) + 1;
  const day = (totalDays % DAYS_PER_MONTH) + 1;
  return { year, month, day };
}

/** ライフサイクルステージ判定 */
function getLifecycleStage(totalGameMin: number): 'puppy' | 'adult' | 'senior' {
  const totalDays  = Math.floor(totalGameMin / GAME_MINUTES_PER_DAY);
  const totalWeeks = totalDays / 7;
  const ageWeeks   = 3 + totalWeeks; // ゲーム開始 = 生後3週目
  if (ageWeeks <= 12) return 'puppy';
  const cal = gameCalendar(totalGameMin, GAME_MINUTES_PER_DAY);
  if (cal.year >= 11) return 'senior';
  return 'adult';
}

/** 悟りスキル定義 */
const SATORI_SKILLS: Array<{ id: string; name: string; desc: string; group: 'A'|'B'|'C'|number }> = [
  // ── 固定確率 4% ──
  { id: 'danki',        name: '断飢の悟り',  desc: '空腹ゲージ増加速度-10%',              group: 0.04  },
  { id: 'joshin',       name: '浄身の悟り',  desc: '汚れゲージ増加速度-10%',              group: 0.04  },
  { id: 'ruten',        name: '流転の悟り',  desc: '排泄ゲージ増加速度-10%',              group: 0.04  },
  { id: 'jakujou',      name: '寂静の悟り',  desc: '興奮が25〜85の範囲に収まる',          group: 0.04  },
  { id: 'houetsu',      name: '法悦の悟り',  desc: '幸福感ゲージ増加速度+10%',            group: 0.04  },
  { id: 'seikaku',      name: '醒覚の悟り',  desc: '眠気ゲージ増加速度-10%',              group: 0.04  },
  { id: 'riku',         name: '離苦の悟り',  desc: '疲労ゲージ増加速度-10%',              group: 0.04  },
  { id: 'shoujin',      name: '精進の悟り',  desc: '活力ゲージ増加速度+10%',              group: 0.04  },
  // ── グループA（フィジカルコンテスト連動）──
  { id: 'jikai',        name: '持戒の悟り',  desc: '規律の増加効果+10%/減少効果-10%',     group: 'A'   },
  { id: 'shikkou',      name: '疾行の悟り',  desc: '速度の増加効果+10%/減少効果-10%',     group: 'A'   },
  { id: 'nintai',       name: '忍耐の悟り',  desc: 'スタミナの増加効果+10%/減少効果-10%', group: 'A'   },
  { id: 'keishin',      name: '軽身の悟り',  desc: 'バネの増加効果+10%/減少効果-10%',     group: 'A'   },
  // ── グループB（ノーズワークコンテスト連動）──
  { id: 'ichinen',      name: '一念の悟り',  desc: '集中力の増加効果+10%/減少効果-10%',   group: 'B'   },
  { id: 'hannya',       name: '般若の悟り',  desc: '知性の増加効果+10%/減少効果-10%',     group: 'B'   },
  // ── グループC（ビューティーコンテスト連動）──
  { id: 'sougen',       name: '荘厳の悟り',  desc: '毛並みの増加効果+10%/減少効果-10%',   group: 'C'   },
  { id: 'jigan',        name: '慈顔の悟り',  desc: '愛嬌の増加効果+10%/減少効果-10%',    group: 'C'   },
  { id: 'myousou',      name: '妙相の悟り',  desc: 'スタイル+10（永続ボーナス）',          group: 'C'   },
  // ── 固定確率 4% ──
  { id: 'fukutoku',     name: '福徳の悟り',  desc: '幸運+10（習得時に適用）',              group: 0.04  },
  { id: 'kizuna',       name: '絆の悟り',    desc: '愛着の上昇速度+10%',                 group: 0.04  },
  // ── 固定確率 0.5% ──
  { id: 'nehan',        name: '涅槃',        desc: '5つの負荷ゲージ増加速度-5%',          group: 0.005 },
  { id: 'mujougaku',    name: '無上覚',       desc: '能力6項目の増加+5%・減少-5%',         group: 0.005 },
  { id: 'koumyousou',   name: '光明相',       desc: '外見3項目の増加+5%・減少-5%',         group: 0.005 },
  { id: 'tennunjizai',  name: '天運自在',     desc: '幸運を100に固定',                     group: 0.005 },
];

/** 悟りスキル抽選確率テーブルを生成（コンテスト出場数に基づく） */
function calcSatoriDrawProbs(
  contests: { physical: number; nosework: number; beauty: number }
): Record<string, number> {
  const fixedTotal = SATORI_SKILLS
    .filter(s => typeof s.group === 'number')
    .reduce((sum, s) => sum + (s.group as number), 0);
  const variableTotal = 1 - fixedTotal; // (A)(B)(C)の合計確率

  const total = contests.physical + contests.nosework + contests.beauty;
  const pA = total > 0 ? variableTotal * contests.physical / total : variableTotal / 3;
  const pB = total > 0 ? variableTotal * contests.nosework / total : variableTotal / 3;
  const pC = total > 0 ? variableTotal * contests.beauty   / total : variableTotal / 3;

  const aCount = SATORI_SKILLS.filter(s => s.group === 'A').length;
  const bCount = SATORI_SKILLS.filter(s => s.group === 'B').length;
  const cCount = SATORI_SKILLS.filter(s => s.group === 'C').length;

  const probs: Record<string, number> = {};
  for (const s of SATORI_SKILLS) {
    if      (typeof s.group === 'number') probs[s.id] = s.group;
    else if (s.group === 'A')             probs[s.id] = pA / aCount;
    else if (s.group === 'B')             probs[s.id] = pB / bCount;
    else                                  probs[s.id] = pC / cCount;
  }
  return probs;
}

/** 未取得スキルの中から抽選して1つ返す */
function drawSatoriSkill(
  existing: string[],
  contests: { physical: number; nosework: number; beauty: number }
): string | null {
  const eligible = SATORI_SKILLS.filter(s => !existing.includes(s.id));
  if (eligible.length === 0) return null;
  const probs = calcSatoriDrawProbs(contests);
  const entries = eligible.map(s => ({ id: s.id, p: probs[s.id] ?? 0 }));
  const total = entries.reduce((sum, e) => sum + e.p, 0);
  if (total <= 0) return eligible[Math.floor(Math.random() * eligible.length)].id;
  let r = Math.random() * total;
  for (const e of entries) { r -= e.p; if (r <= 0) return e.id; }
  return entries[entries.length - 1].id;
}

/**
 * 悟りスキルによる能力値変化の補正倍率を返す
 * @param bonuses  satoriBonuses 配列
 * @param stat     対象ステータス名
 * @param isGain   true=増加, false=減少
 */
function satoriAbilityMult(bonuses: string[], stat: string, isGain: boolean): number {
  const b = new Set(bonuses);
  let m = 1.0;
  // 個別スキル ±10%
  if (stat === 'discipline'   && b.has('jikai'))       m *= isGain ? 1.1 : 0.9;
  if (stat === 'speed'        && b.has('shikkou'))      m *= isGain ? 1.1 : 0.9;
  if (stat === 'stamina'      && b.has('nintai'))       m *= isGain ? 1.1 : 0.9;
  if (stat === 'spring'       && b.has('keishin'))      m *= isGain ? 1.1 : 0.9;
  if (stat === 'focus'        && b.has('ichinen'))      m *= isGain ? 1.1 : 0.9;
  if (stat === 'intelligence' && b.has('hannya'))       m *= isGain ? 1.1 : 0.9;
  if (stat === 'coat'         && b.has('sougen'))       m *= isGain ? 1.1 : 0.9;
  if (stat === 'charm'        && b.has('jigan'))        m *= isGain ? 1.1 : 0.9;
  // 無上覚 ±5%: discipline, speed, stamina, spring, focus, intelligence
  if (['discipline','speed','stamina','spring','focus','intelligence'].includes(stat) && b.has('mujougaku'))
    m *= isGain ? 1.05 : 0.95;
  // 光明相 ±5%: coat, charm, style
  if (['coat','charm','style'].includes(stat) && b.has('koumyousou'))
    m *= isGain ? 1.05 : 0.95;
  return m;
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map(s => Math.exp(s - max));
  const sum = exps.reduce((a,b)=>a+b,0);
  return exps.map(e=>e/sum);
}
function sampleFromDist(probs: number[]): number {
  const r = Math.random(); let cum = 0;
  for (let i=0;i<probs.length;i++){cum+=probs[i];if(r<cum)return i;}
  return probs.length-1;
}
function clamp(v:number,lo=0,hi=100){return Math.max(lo,Math.min(hi,v));}
function attachmentDiscount(a:number):number{return 1-ATTACHMENT_DISCOUNT_ALPHA*(a/100);}

// ─────────────────────────────────────────────
// ストレス成分計算
// ─────────────────────────────────────────────

interface StressComponents{fromHunger:number;fromDirt:number;fromBladder:number;total:number;}

function calcStressComponents(dog:DogState):StressComponents{
  const N=dog.personality.neuroticism;
  const nF=0.5+N*0.5;
  const fromHunger  = Math.max(0,dog.hunger   -60)/40*0.25*nF;
  const fromDirt    = Math.max(0,dog.dirtiness-50)/50*0.18*nF;
  const fromBladder = Math.max(0,dog.bladder  -65)/35*0.20*nF;
  return{fromHunger,fromDirt,fromBladder,total:fromHunger+fromDirt+fromBladder};
}

// ─────────────────────────────────────────────
// 能力システム関数（v6）
// ─────────────────────────────────────────────

/** 能力値クランプ (0〜上限なし, 整数) */
function clampAbility(v: number): number {
  return Math.max(ABILITY_MIN, Math.round(v));
}

/** フィジカル・知性ゲージの動的Max（現在値が1000に達するたびに1000ずつ拡張） */
function abilityGaugeMax(v: number): number {
  return Math.max(1000, Math.ceil(Math.max(1, v) / 1000) * 1000);
}

/** 大会優勝回数 → 実績ボーナス (上限 LEGACY_BONUS_MAX) */
function calcLegacyBonus(wins: number): number {
  return Math.min(wins * LEGACY_BONUS_PER_WIN, LEGACY_BONUS_MAX);
}

/**
 * 子犬の1能力値を計算
 *   P_offspring = (P_sire + P_dam) / 2 × (h² + legacy_bonus) + Random(-50〜+50)
 */
function calcOffspringValue(
  sireVal: number, damVal: number,
  h2Key: string,
  sireWins: number, damWins: number,
): number {
  const h2 = H2[h2Key] ?? 0.20;
  // Base inheritance: 20%, bonus: tournamentWins * 5% (capped at 60% total)
  const tournamentBonus = Math.min(0.60, 0.20 + ((sireWins + damWins) / 2) * 0.05) - 0.20;
  const bonus = (calcLegacyBonus(sireWins) + calcLegacyBonus(damWins)) / 2 + tournamentBonus;
  const effectiveH2 = Math.min(h2 + bonus, h2 + LEGACY_BONUS_MAX + tournamentBonus);
  const midParent = (sireVal + damVal) / 2;
  const noise = Math.random() * 100 - 50;   // -50〜+50
  return clampAbility(midParent * effectiveH2 + noise);
}

/** 突然変異: 5%の確率で ±15% の能力変動を起こす */
function applyMutation(val: number, maxVal = 1000): number {
  if(Math.random() < 0.05) {
    const delta = Math.round(maxVal * 0.15 * (Math.random() < 0.5 ? 1 : -1));
    return Math.max(0, Math.min(maxVal, val + delta));
  }
  return val;
}

/**
 * 繁殖計算: 親2頭 → 子の AbilityStats
 * Beauty の coat/charm は 0-100 スケールのため別処理
 */
function breedDogs(
  sire: { abilities: AbilityStats; peakAbilities?: AbilityStats; tournamentWins: number; cognition?: number },
  dam:  { abilities: AbilityStats; peakAbilities?: AbilityStats; tournamentWins: number; cognition?: number },
): AbilityStats {
  const sw = sire.tournamentWins;
  const dw = dam.tournamentWins;
  const sp = sire.abilities.physical;
  const dp = dam.abilities.physical;
  const sPeak = sire.peakAbilities?.physical ?? sp;
  const dPeak = dam.peakAbilities?.physical  ?? dp;
  const sireCogFactor = (sire.cognition ?? 500) / 1000;
  const damCogFactor  = (dam.cognition  ?? 500) / 1000;
  // 新遺伝計算: 基本値 + ピーク能力×認知係数×0.01
  const peakBonus = (sPeakVal: number, dPeakVal: number): number =>
    (sPeakVal * 0.01 * sireCogFactor + dPeakVal * 0.01 * damCogFactor) / 2;
  return {
    physical: {
      discipline: applyMutation(clampAbility(calcOffspringValue(sp.discipline, dp.discipline, 'discipline', sw, dw) + peakBonus(sPeak.discipline, dPeak.discipline))),
      speed:      applyMutation(clampAbility(calcOffspringValue(sp.speed,      dp.speed,      'speed',      sw, dw) + peakBonus(sPeak.speed,      dPeak.speed))),
      stamina:    applyMutation(clampAbility(calcOffspringValue(sp.stamina,    dp.stamina,    'stamina',    sw, dw) + peakBonus(sPeak.stamina,    dPeak.stamina))),
      spring:     applyMutation(clampAbility(calcOffspringValue(sp.spring,     dp.spring,     'spring',     sw, dw) + peakBonus(sPeak.spring,     dPeak.spring))),
      focus:      applyMutation(clampAbility(calcOffspringValue(sp.focus??0,   dp.focus??0,   'intelligence', sw, dw) + peakBonus(sPeak.focus??0, dPeak.focus??0))),
    },
    intelligence: applyMutation(clampAbility(
      calcOffspringValue(sire.abilities.intelligence, dam.abilities.intelligence, 'intelligence', sw, dw)
      + peakBonus(sire.peakAbilities?.intelligence ?? sire.abilities.intelligence,
                  dam.peakAbilities?.intelligence  ?? dam.abilities.intelligence),
    )),
    beauty: {
      // Beauty は 0-100 スケール
      coat:  applyMutation(Math.max(0, Math.min(100, Math.round(
        (sire.abilities.beauty.coat  + dam.abilities.beauty.coat)  / 2
        * (H2['beauty'] ?? 0.20) + (Math.random() * 20 - 10)
        + peakBonus(sire.peakAbilities?.beauty.coat  ?? sire.abilities.beauty.coat,
                    dam.peakAbilities?.beauty.coat   ?? dam.abilities.beauty.coat)
      ))), 100),
      charm: applyMutation(Math.max(0, Math.min(100, Math.round(
        (sire.abilities.beauty.charm + dam.abilities.beauty.charm) / 2
        * (H2['beauty'] ?? 0.20) + (Math.random() * 20 - 10)
        + peakBonus(sire.peakAbilities?.beauty.charm ?? sire.abilities.beauty.charm,
                    dam.peakAbilities?.beauty.charm  ?? dam.abilities.beauty.charm)
      ))), 100),
    },
    luck: 50 + Math.round(Math.random() * 40 - 20),  // 幸運はランダム要素強め
  };
}

/** 子の Big-Five を両親から継承し、5% 確率で各特性 ±15% 変動 */
function breedPersonality(
  sireP: BigFive, damP: BigFive,
): BigFive {
  const midTrait = (a: number, b: number) => {
    const base = (a + b) / 2 + (Math.random() * 0.10 - 0.05);
    const mutated = Math.random() < 0.05 ? base + (Math.random() * 0.30 - 0.15) : base;
    return Math.max(0.05, Math.min(0.95, mutated));
  };
  return {
    openness:          midTrait(sireP.openness,          damP.openness),
    conscientiousness: midTrait(sireP.conscientiousness, damP.conscientiousness),
    extraversion:      midTrait(sireP.extraversion,      damP.extraversion),
    agreeableness:     midTrait(sireP.agreeableness,     damP.agreeableness),
    neuroticism:       midTrait(sireP.neuroticism,       damP.neuroticism),
  };
}

/** 興奮度(arousal)バフ係数: 緑ゾーン(40-70)で×1.1、それ以外は×1.0 */
function calcArousalBuff(arousal: number): number {
  return (arousal >= AROUSAL_GREEN_MIN && arousal <= AROUSAL_GREEN_MAX)
    ? AROUSAL_GREEN_BUFF : 1.0;
}

/**
 * 規律の実効値（興奮度バフ＋赤ゾーンペナルティ適用後）
 *   ・緑ゾーン(40-70): discipline × 1.1
 *   ・赤ゾーン(80+):   上記に加え × (1 - 0.20)
 */
function calcEffectiveDiscipline(discipline: number, arousal: number): number {
  const buff = calcArousalBuff(arousal);
  const penalty = arousal >= AROUSAL_RED_THRESHOLD ? AROUSAL_RED_PENALTY : 0;
  return Math.round(discipline * buff * (1 - penalty));
}

/**
 * 知性による判定ウィンドウ倍率
 *   intelligence=0 → 1.00, intelligence=1000 → 1.20
 *   （今後実装するミニゲームの成功判定時間に乗算する定数）
 */
function calcIntelligenceWindow(intelligence: number): number {
  return 1.0 + (intelligence / ABILITY_MAX) * INTEL_WINDOW_MAX_BOOST;
}

/** 自律行動モード判定: 規律実効値 ≥ AUTO_DISCIPLINE_THRESHOLD の成犬 */
function isAutoMode(dog: DogState): boolean {
  const effDisc = calcEffectiveDiscipline(dog.abilities.physical.discipline, dog.arousal);
  return effDisc >= AUTO_DISCIPLINE_THRESHOLD;
}

// ── 家族・NPC ヘルパー（v8）───────────────────────────────────────────

/** ランダムなNPC犬を生成 */
function generateNpcDog(gender: Gender): NpcDog {
  const names = gender === 'male' ? NPC_NAMES_MALE : NPC_NAMES_FEMALE;
  const name  = names[Math.floor(Math.random() * names.length)];
  const breed = NPC_BREEDS[Math.floor(Math.random() * NPC_BREEDS.length)];
  const id    = 'npc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const base  = 60 + Math.round(Math.random() * 140);
  const rng   = () => clampAbility(base + Math.round(Math.random() * 100 - 50));
  return {
    id, name, gender, breed,
    personality: {
      openness:          0.3 + Math.random() * 0.5,
      conscientiousness: 0.3 + Math.random() * 0.5,
      extraversion:      0.3 + Math.random() * 0.5,
      agreeableness:     0.3 + Math.random() * 0.5,
      neuroticism:       0.1 + Math.random() * 0.5,
    },
    abilities: {
      physical: { discipline: rng(), speed: rng(), stamina: rng(), spring: rng() },
      intelligence: rng(),
      beauty: { coat: clamp(40 + Math.round(Math.random() * 40)), charm: clamp(40 + Math.round(Math.random() * 40)) },
      luck: 30 + Math.round(Math.random() * 40),
    },
    equipment: { outfit:null, shoes:null, hat:null, accessory1:null, accessory2:null, accessory3:null },
    intimacy:         0,
    metCount:         0,
    reencounterBonus: 0,
  };
}

/** DogState → FamilyMember 変換 */
function dogStateToFamily(dog: DogState): FamilyMember {
  return {
    id:             dog.dogId,
    name:           dog.dogName,
    gender:         dog.gender,
    generation:     dog.generation,
    abilities:      dog.abilities,
    tournamentWins: dog.tournamentWins,
    preset:         dog.presetName,
  };
}

// ── 装備システムヘルパー ────────────────────────────────────────────────

/** 空の装備スロットを生成 */
function emptyEquipment(): EquipmentSlots {
  return { outfit:null, shoes:null, hat:null, accessory1:null, accessory2:null, accessory3:null };
}

/** スロットキー → アイテムカテゴリ */
function slotToCategory(slot: EquipSlotKey): ItemCategory {
  if(slot==='outfit')   return 'outfit';
  if(slot==='shoes')    return 'shoes';
  if(slot==='hat')      return 'hat';
  return 'accessory';
}

/** 装備中の全スロットを配列で取得 */
function allEquippedItems(eq: EquipmentSlots): InventoryItem[] {
  return ([eq.outfit, eq.shoes, eq.hat, eq.accessory1, eq.accessory2, eq.accessory3]
    .filter(Boolean) as InventoryItem[]);
}

/** 装備全体のステータスボーナスを合算 */
function calcEquipmentBonuses(eq: EquipmentSlots): Required<ItemBonuses> {
  const empty: Required<ItemBonuses> = {
    beauty_coat:0, beauty_charm:0, luck:0, discipline:0,
    speed:0, stamina:0, spring:0, focus:0, intelligence:0,
    style:0, maxStamina:0, lifespan:0, cognition:0,
  };
  return allEquippedItems(eq).reduce((acc, item)=>{
    for(const k of Object.keys(acc) as (keyof ItemBonuses)[]){
      (acc as any)[k] += (item.bonuses[k] ?? 0);
    }
    return acc;
  }, { ...empty });
}

/** 装備中のLegendary特殊効果を取得 */
function getEquippedLegendaryEffects(eq: EquipmentSlots): Set<LegendaryEffect> {
  const effects = new Set<LegendaryEffect>();
  allEquippedItems(eq).forEach(item => {
    if(item.legendaryEffect) effects.add(item.legendaryEffect);
  });
  return effects;
}

/**
 * 着こなしスコア (0〜100) を算出
 * - 装備数・レアリティ・カテゴリ充填ボーナスの合算
 */
function calcStyleScore(eq: EquipmentSlots): number {
  const RARITY_PT: Record<InventoryItem['rarity'], number> = { common:5, rare:10, epic:15, legendary:25 };
  const items = allEquippedItems(eq);
  let score = items.reduce((s, i) => s + RARITY_PT[i.rarity], 0);
  // 全6スロット埋まればボーナス +10
  if(items.length === 6) score += 10;
  return Math.min(100, score);
}

/** スロット定義（ラベル・絵文字） */
const SLOT_DEFS: Array<{ key: EquipSlotKey; label: string; emoji: string; category: ItemCategory }> = [
  { key:'outfit',     label:'服',   emoji:'👗', category:'outfit'    },
  { key:'shoes',      label:'靴',   emoji:'👟', category:'shoes'     },
  { key:'hat',        label:'帽子', emoji:'🎩', category:'hat'       },
  { key:'accessory1', label:'小物①', emoji:'💎', category:'accessory' },
  { key:'accessory2', label:'小物②', emoji:'💎', category:'accessory' },
  { key:'accessory3', label:'小物③', emoji:'💎', category:'accessory' },
];

// ── 散歩報酬生成 ────────────────────────────────────────────────────────

/**
 * 散歩終了時の報酬を生成
 * コイン + 能力値上昇 + 確率でインベントリアイテムドロップ
 * ※ アイテムボーナスは装備時に有効になる（自動適用しない）
 */
function generateWalkRewards(dog: DogState, destination?: WalkDestination | null): {
  coins: number;
  speedGain: number;
  staminaGain: number;
  item: InventoryItem | null;
} {
  const luck = dog.abilities.luck;
  const coins = WALK_COIN_BASE + Math.round(Math.random() * WALK_COIN_RAND)
    + Math.floor(luck / 10);

  const speedGain   = WALK_STAT_GAIN_BASE + Math.round(Math.random() * WALK_STAT_GAIN_RAND);
  const staminaGain = WALK_STAT_GAIN_BASE + Math.round(Math.random() * WALK_STAT_GAIN_RAND);

  const intelBoost = (dog.abilities.intelligence / 1000) * 0.20;
  // ダックスフント特性: アイテムドロップ率1.05倍
  const dropBreedMult = dog.breed === 'dachshund' ? 1.05 : 1.0;
  const dropChance = (WALK_ITEM_DROP_CHANCE + luck / 1000 + intelBoost) * dropBreedMult;
  const walkPhase = getLifecycleStage(dog.totalGameMin);
  const phasePool = WALK_ITEM_POOL.filter(i => !i.phases || i.phases[walkPhase] === true);
  let item: InventoryItem | null = null;
  // 秘密の集い: レア以上確定
  if(destination === 'secret') {
    // 秘密の集い: Legendary:1% / Epic:50% / Rare:49%
    const r2 = Math.random();
    let pool2 = r2 < 0.01
      ? phasePool.filter(i => i.rarity === 'legendary')
      : r2 < 0.51
      ? phasePool.filter(i => i.rarity === 'epic')
      : phasePool.filter(i => i.rarity === 'rare');
    if(pool2.length === 0) pool2 = phasePool.filter(i => i.rarity === 'rare');
    const tpl2 = pool2[Math.floor(Math.random() * pool2.length)];
    item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: tpl2.name, category: (tpl2.category ?? 'accessory') as ItemCategory, rarity: tpl2.rarity,
      bonuses: { ...tpl2.bonuses }, flavorText: tpl2.flavorText,
      source: 'event', acquiredAt: dog.totalGameMin,
    };
  } else if(Math.random() < dropChance) {
    // 通常散歩: Legendary:0.1% / Epic:2.9% / Rare:97%
    const rw = Math.random();
    let pool: typeof WALK_ITEM_POOL;
    if(rw < 0.001) {
      pool = phasePool.filter(i => i.rarity === 'legendary');
    } else if(rw < 0.030) {
      pool = phasePool.filter(i => i.rarity === 'epic');
    } else {
      pool = phasePool.filter(i => i.rarity === 'rare');
    }
    if(pool.length === 0) pool = phasePool.filter(i => i.rarity === 'rare');
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: tpl.name, category: (tpl.category ?? 'accessory') as ItemCategory, rarity: tpl.rarity,
      bonuses: { ...tpl.bonuses }, flavorText: tpl.flavorText,
      source: 'walk', acquiredAt: dog.totalGameMin,
    };
  }
  return { coins, speedGain, staminaGain, item };
}

/** 全能力値の乱数初期値を生成 */
function createInitialAbilities(preset: DogPreset): AbilityStats {
  const r = (base: number, range: number) =>
    clampAbility(base + Math.round(Math.random() * range * 2 - range));
  const rb = (base: number, range: number) =>
    Math.max(0, Math.min(100, Math.round(base + Math.random() * range * 2 - range)));
  // active 個体は規律・スタミナ高め / timid は知性・バネ高め
  const disciplineBase = preset === 'active' ? 250 : preset === 'timid' ? 180 : 200;
  const intelBase      = preset === 'timid'  ? 250 : preset === 'active' ? 180 : 200;
  return {
    physical: {
      discipline: r(disciplineBase, 50),
      speed:      r(200, 50),
      stamina:    r(preset === 'active' ? 230 : 200, 50),
      spring:     r(200, 50),
      focus:      r(100, 30),   // 集中力初期値 70〜130
    },
    intelligence: r(intelBase, 50),
    beauty: {
      coat:  rb(50, 15),
      charm: rb(50, 15),
    },
    luck: 50,
  };
}

// ─────────────────────────────────────────────
// 意思決定エンジン
// ─────────────────────────────────────────────

function decideAction(dog:DogState):ActionLabel{
  if(dog.stress>=STRESS_DESTROY_THRESHOLD)
    return Math.random()<0.55?'destructive':'excessive_barking';
  if(dog.stress>=STRESS_BARK_THRESHOLD&&Math.random()<0.5)return'excessive_barking';

  const p=dog.personality;
  const ageNoise=clamp(dog.age/365/15,0,1);
  const trainFactor=1-dog.trainability/150;

  const scores:number[]=[
    dog.hunger*0.9+p.openness*10,
    dog.sleepiness*0.95,
    (100-dog.stress)*0.4*p.extraversion*(1-dog.fatigue/200),
    dog.stress*0.25+35*(1-p.extraversion)+dog.fatigue*0.3,
    dog.bladder*0.9,
    (ageNoise*40+p.openness*8)*trainFactor,
    dog.stress*0.45*p.neuroticism*trainFactor,
    (100-dog.stress)*0.55*p.extraversion*p.openness*1.8*(0.5+dog.arousal/200),
    dog.stress*0.65*p.neuroticism*(1-p.extraversion),
    Math.max(0,dog.stress-60)*0.8*p.neuroticism*trainFactor,
    Math.max(0,dog.stress-80)*0.6*p.neuroticism*trainFactor,
    0,
  ];
  const probs=softmax(scores.map(s=>s+ageNoise*25*Math.random()));
  return ACTION_LABELS[sampleFromDist(probs)];
}

// ─────────────────────────────────────────────
// 状態初期化
// ─────────────────────────────────────────────

function randomPersonality():BigFive{
  const r=()=>0.3+Math.random()*0.4;
  return{openness:r(),conscientiousness:r(),extraversion:r(),agreeableness:r(),neuroticism:r()};
}

function createInitialDogState(preset:DogPreset='random', breedId: string = 'shibainu'):DogState{
  const personality=preset==='random'?randomPersonality():{...PRESETS[preset].personality};
  const lineageType: 'show' | 'working' = Math.random() < 0.5 ? 'show' : 'working';
  const baseAbilities = createInitialAbilities(preset);
  // ショー系: 毛並み+10 愛嬌+5 / ワーキング系: スタミナ上限+50 速度+10
  if(lineageType === 'show') {
    baseAbilities.beauty.coat  = Math.min(100, baseAbilities.beauty.coat  + 10);
    baseAbilities.beauty.charm = Math.min(100, baseAbilities.beauty.charm + 5);
  }
  const baseMaxStamina = 250 + Math.floor(Math.random() * 51) + (lineageType === 'working' ? 50 : 0);
  if(lineageType === 'working') {
    baseAbilities.physical.speed = clampAbility(baseAbilities.physical.speed + 10);
  }
  // 犬種別初期ステータスを上書き（規律・速度・スタミナ・バネ・集中力・知性）
  const breedDef = getBreedDef(breedId);
  baseAbilities.physical.discipline = breedDef.initialStats.discipline;
  baseAbilities.physical.speed      = breedDef.initialStats.speed;
  baseAbilities.physical.stamina    = breedDef.initialStats.stamina;
  baseAbilities.physical.spring     = breedDef.initialStats.spring;
  baseAbilities.physical.focus      = breedDef.initialStats.focus;
  baseAbilities.intelligence        = breedDef.initialStats.intelligence;
  // その他ステータス（毛並み・愛嬌・幸運・愛着など）は0に
  baseAbilities.beauty.coat  = 0;
  baseAbilities.beauty.charm = 0;
  baseAbilities.luck         = 0;
  return{
    age:0,hunger:30,bladder:20,sleepiness:40,
    isSleeping:false,sleepPhase:'awake',sleepCycleMin:0,
    stress:10,happiness:80,
    dirtiness:10,fatigue:10,arousal:50,trainability:30,
    stressFromHunger:0,stressFromDirt:0,stressFromBladder:0,
    attachment:20,
    walkingTicksLeft:0,fearfulTicksLeft:0,
    statsActionCount:0,statsBarkCount:0,statsDestroyCount:0,
    statsScoldSuccess:0,statsScoldFear:0,
    personality,presetName:preset,currentAction:'resting',
    log:[`[${preset==='random'?'ランダム':PRESETS[preset].label}] 犬が生まれました！`],
    totalGameMin:0,
    // v6: 能力値・系譜
    abilities:      baseAbilities,
    lineage:        [],
    tournamentWins: 0,
    // v6 Step2/3: 散歩報酬・装備
    coins:     0,
    inventory: [],
    equipment: emptyEquipment(),
    style:     0,
    dayTimeMin:          DAY_START_MIN,
    poopDebuff:          false,
    poopDebuffWalksLeft: 0,
    walkEventLog:        [],
    // v8: 個体識別・家族
    dogId:         Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    dogName:       'ぽち',
    breed:         breedId,
    gender:        (Math.random() < 0.5 ? 'male' : 'female') as Gender,
    generation:    1,
    mate:          null,
    children:      [],
    knownDogs:     [],
    walkLoopCount: 0,
    puppies:       [],
    walkMeetup:      null,
    lastWalkDayMin:  0,
    walkDestination:    null,
    hasSecretInfo:      false,
    lastUniqueEventDay: -999,
    isRetired: false,
    walkPoopFired: false,
    walkItemFired: false,
    walkStrollEventFired:   false,
    walkStrollEventMsg:     '',
    walkStrollEventPending: false,
    walkStrollEventStats:   '',
    actionHoldTicks: 0,
    contestEntryMonth: -1,
    contestEntered:    false,
    // v10: 大会結果
    lastContestRunMonth: -1,
    contestPendingResult: null,
    // v11: スタミナ最大値成長
    maxStamina: baseMaxStamina,
    // 血統タイプ
    lineageType,
    // v12: ライフサイクル
    socialExp:           0,
    lifespan:            1000,
    cognition:           500,
    satoriBonuses:       [],
    peakAbilities:       {
      ...baseAbilities,
      physical: { ...baseAbilities.physical },
      beauty:   { ...baseAbilities.beauty },
    },
    consecutiveTopFinish: 0,
    surgeryUsed:          false,
    seTransitioned:       false,
    socialMultiplier:     1.0,
    seLearned:            { care: [], play: [], areas: [], equippedSlots: 0 },
    satoriSlotsUnlocked:  0,
    puppyClassEventFired: false,
    // v13: 終焉・継承
    walkStats:      {},
    heirloomItemId: null,
    pendingDeath:   false,
    // 老衰ステータス管理
    seniorFeedingDays:  0,
    seniorExerciseDays: 0,
    seniorLastDecayDay: 0,
    seniorDailyFeedOK:  false,
    seniorDailyExerOK:  false,
  };
}

// ─────────────────────────────────────────────
// デバッグ用: 老犬テストモード犬生成（v13）
// ─────────────────────────────────────────────

function createDebugSeniorDog(): DogState {
  // year=12（12-10=2 /day 減衰）になる totalGameMin
  // year=12: totalDays=4230 以上が必要 → 4230 * 1440
  const SENIOR_TOTAL_MIN = 4230 * 1440; // year 12 初日

  const abilities: AbilityStats = {
    physical: { discipline: 820, speed: 650, stamina: 480, spring: 570, focus: 730 },
    beauty:   { coat: 78, charm: 65 },
    intelligence: 760,
    luck:     42,
  };

  const heirloomItem: InventoryItem = {
    id:          'debug_heirloom',
    name:        '古いコイン',
    category:    'accessory',
    rarity:      'epic',
    bonuses:     { luck: 4, discipline: 3 },
    flavorText:  '年代物の古銭。誰かの想いが込められているかもしれない。',
    source:      'event',
    acquiredAt:  0,
  };

  const puppyAbil = (d: number, s: number): AbilityStats => ({
    physical: { discipline: d, speed: s, stamina: 300, spring: 280, focus: 310 },
    beauty:   { coat: 55, charm: 48 },
    intelligence: 420,
    luck:     25,
  });

  const puppies: FamilyMember[] = [
    { id:'dbg_pup1', name:'サクラ', gender:'female', generation:2, abilities: puppyAbil(380, 310), tournamentWins:0, preset:'active' },
    { id:'dbg_pup2', name:'ハチ',   gender:'male',   generation:2, abilities: puppyAbil(340, 350), tournamentWins:0, preset:'timid' },
    { id:'dbg_pup3', name:'ユキ',   gender:'female', generation:2, abilities: puppyAbil(400, 290), tournamentWins:0, preset:'random' },
  ];

  const base = createInitialDogState('active');
  return {
    ...base,
    dogId:        'debug_senior',
    dogName:      '老犬テスト',
    breed:        'shibainu',
    gender:       'male',
    generation:   3,
    age:          SENIOR_TOTAL_MIN / GAME_MINUTES_PER_DAY,
    totalGameMin: SENIOR_TOTAL_MIN,
    dayTimeMin:   DAY_START_MIN,
    abilities,
    peakAbilities: { ...abilities, physical: { ...abilities.physical }, beauty: { ...abilities.beauty } },
    lifespan:     150,   // あと約75ゲーム日で自然死（year12: 2/day）
    cognition:    720,
    satoriBonuses:      ['shikkou', 'hannya'],
    satoriSlotsUnlocked: 2,
    socialMultiplier:   1.1,
    seTransitioned:     true,
    socialExp:          100,
    tournamentWins:     5,
    consecutiveTopFinish: 2,
    maxStamina:   600,
    lineageType:  'working',
    lineage: [
      { generation:1, name:'タロウ', tournamentWins:3, abilities: puppyAbil(500, 400) },
      { generation:2, name:'ハナ',   tournamentWins:2, abilities: puppyAbil(600, 500) },
    ],
    puppies,
    children: puppies,
    coins:      3000,
    happiness:  85,
    attachment: 90,
    fatigue:    20,
    hunger:     15,
    stress:     10,
    arousal:    50,
    equipment: {
      ...emptyEquipment(),
      accessory1: heirloomItem,
    },
    inventory: [heirloomItem],
    walkStats: { park: 12, mountain: 8, beach: 5, city: 3 },
    heirloomItemId: null,
    pendingDeath:   false,
    isRetired:      false,
    seniorFeedingDays:  0,
    seniorExerciseDays: 0,
    seniorLastDecayDay: 0,
    seniorDailyFeedOK:  false,
    seniorDailyExerOK:  false,
    log: ['🧪 [デバッグモード] 老犬テスト犬を生成しました！寿命150 / 年齢12年目'],
  };
}

// SFX設定グローバル参照（ゲームティック内から参照）
let _sfxSettings = { enabled: true, volume: 80 };

// ─────────────────────────────────────────────
// 状態更新エンジン
// ─────────────────────────────────────────────

function addLog(log:string[],msg:string):string[]{
  const t=new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return[`[${t}] ${msg}`,...log].slice(0,10);
}

function tickDogState(dog:DogState,gameDelta:number):DogState{
  const d:DogState={
    ...dog,
    personality:{...dog.personality},
    log:[...dog.log],
    // abilities は深いコピー
    abilities:{
      ...dog.abilities,
      physical:{...dog.abilities.physical},
      beauty:{...dog.abilities.beauty},
    },
  };

  // ── v6: 自律行動モード判定
  const autoMode = isAutoMode(dog);

  d.age=dog.age+gameDelta/GAME_MINUTES_PER_DAY;
  d.totalGameMin=dog.totalGameMin+gameDelta;

  // ── 時間の連続進行（アクション非依存でリアルタイム進行）
  if(dog.dayTimeMin < NIGHT_START_MIN) {
    d.dayTimeMin = Math.min(NIGHT_START_MIN, dog.dayTimeMin + gameDelta);
  }

  // ── ウルトラディアンリズム / 睡眠フェーズ
  d.sleepCycleMin=(dog.sleepCycleMin+gameDelta)%ULTRADIAN_CYCLE_MIN;
  const cr=d.sleepCycleMin/ULTRADIAN_CYCLE_MIN;
  if(d.isSleeping){
    d.sleepPhase=cr<0.25?'NREM1':cr<0.50?'NREM2':cr<0.75?'NREM3':'REM';
  }else{d.sleepPhase='awake';}

  // ── 犬種成長倍率（負のステータス蓄積速度に適用）
  const _breedId = dog.breed ?? 'shibainu';
  const _mHunger    = getBreedMult(_breedId, 'hunger');
  const _mBladder   = getBreedMult(_breedId, 'bladder');
  const _mSleepiness= getBreedMult(_breedId, 'sleepiness');
  const _mDirtiness = getBreedMult(_breedId, 'dirtiness');
  const _mFatigue   = getBreedMult(_breedId, 'fatigue');

  // ── 悟りスキル効果計算
  const _satB = new Set(dog.satoriBonuses ?? []);
  const _satHunger     = (_satB.has('danki')   ? 0.9 : 1.0) * (_satB.has('nehan') ? 0.95 : 1.0);
  const _satBladder    = (_satB.has('ruten')   ? 0.9 : 1.0) * (_satB.has('nehan') ? 0.95 : 1.0);
  const _satSleepiness = (_satB.has('seikaku') ? 0.9 : 1.0) * (_satB.has('nehan') ? 0.95 : 1.0);
  const _satDirtiness  = (_satB.has('joshin')  ? 0.9 : 1.0) * (_satB.has('nehan') ? 0.95 : 1.0);
  const _satFatigue    = (_satB.has('riku')    ? 0.9 : 1.0) * (_satB.has('nehan') ? 0.95 : 1.0);

  // ── 眠気
  if(d.isSleeping){
    const rr=d.sleepPhase==='NREM3'?1.2:0.7;
    d.sleepiness=clamp(dog.sleepiness-gameDelta*rr);
    if(d.sleepiness<15&&cr>0.85){
      d.isSleeping=false;d.sleepPhase='awake';
      d.log=addLog(d.log,'目覚めた');
    }
  }else{
    d.sleepiness=clamp(dog.sleepiness+gameDelta*0.38*_mSleepiness*_satSleepiness);
    if(d.sleepiness>78){
      d.isSleeping=true;
      d.log=addLog(d.log, autoMode
        ? '🤖 [自律] 眠くなったので自分で休んだ（規律高）'
        : '眠りに就いた...'
      );
    }
  }

  // ── 空腹・排泄
  d.hunger =clamp(dog.hunger +gameDelta*(d.isSleeping?0.12:0.38)*_mHunger*_satHunger);
  d.bladder=clamp(dog.bladder+gameDelta*(d.isSleeping?0.08:0.28)*_mBladder*_satBladder);
  if(d.bladder>=99){
    if(autoMode){
      // 【自律行動】規律 ≥ 700: 粗相せず自動でトイレ解決
      d.bladder=10;
      d.log=addLog(d.log,'🤖 [自律] トイレを自分で済ませた（規律高）');
    }else{
      d.bladder=10;d.dirtiness=clamp(dog.dirtiness+30);
      d.stress=clamp(d.stress+15);d.attachment=clamp(dog.attachment-5);
      d.log=addLog(d.log,'粗相をしてしまった...');
    }
  }
  // 【自律行動】眠気 ≥ 78 の時も自動で就寝（autoMode かつまだ寝ていない場合）
  // 通常ロジックと合わせるため isSleeping 遷移はそのまま維持し、
  // autoMode 時は自律就寝ログを出すだけ（強制粗相なし）

  // ── 散歩処理（進捗管理・イベント・完了報酬）
  const wasWalking = dog.walkingTicksLeft > 0;
  const meetupActive = dog.walkMeetup !== null && dog.walkMeetup.phase !== 'done';
  const strollEventPaused = dog.walkStrollEventPending === true;
  // ミートアップ中・イベント確認待ちは散歩進捗を止める
  if(wasWalking && !meetupActive && !strollEventPaused) {
    d.walkingTicksLeft = dog.walkingTicksLeft - 1;
  }
  const isWalking = d.walkingTicksLeft > 0;
  // 22:00〜06:00（夜間）は汚れ進行を停止
  const isNightTick = dog.dayTimeMin >= NIGHT_START_MIN;
  const dirtRate = isNightTick ? 0 : d.isSleeping ? 0 : isWalking ? 0.30 : 0.06;
  d.dirtiness = clamp(dog.dirtiness + gameDelta * dirtRate * _mDirtiness * _satDirtiness);

  // ── 散歩中イベント（進捗1%〜99%、各1回限り）
  if(wasWalking && isWalking && !meetupActive) {
    // ウンチイベント（まだ発生していない場合）
    if(!dog.walkPoopFired) {
      const midPoopChance = POOP_EVENT_CHANCE * (1 - dog.abilities.intelligence / 2000) / (WALK_DIRT_TICKS - 2);
      if(Math.random() < midPoopChance) {
        d.walkPoopFired = true;
        d.dirtiness = clamp(d.dirtiness + POOP_DIRTY_HIT);
        d.poopDebuff = true;
        d.poopDebuffWalksLeft = POOP_DEBUFF_WALKS;
        const poopEvt = '💩 ウンチを踏んでしまった！ 幸運が一時的に低下した（汚れ+50  散歩3回orお風呂で解除）';
        d.walkEventLog = [...(dog.walkEventLog ?? []), poopEvt].slice(-20);
        d.log = addLog(d.log, poopEvt);
      }
    }
    // アイテムドロップ（まだ発生していない場合）
    if(!dog.walkItemFired) {
      const midLuck = dog.abilities.luck;
      const midIntelBoost = (dog.abilities.intelligence / 1000) * 0.20;
      const midDropBreedMult = dog.breed === 'dachshund' ? 1.05 : 1.0;
      const midDropChance = (WALK_ITEM_DROP_CHANCE + midLuck / 1000 + midIntelBoost) * midDropBreedMult;
      const perTickItemChance = midDropChance / (WALK_DIRT_TICKS - 4);
      if(Math.random() < perTickItemChance) {
        d.walkItemFired = true;
        // 秘密の集い: レア以上確定
        let midItem: InventoryItem | null = null;
        const midDest = dog.walkDestination;
        const midPhase = getLifecycleStage(dog.totalGameMin);
        const midPhasePool = WALK_ITEM_POOL.filter(i => !i.phases || i.phases[midPhase] === true);
        if(midDest === 'secret') {
          // 秘密の集い: Legendary:1% / Epic:50% / Rare:49%
          const r2mid = Math.random();
          let pool2 = r2mid < 0.01
            ? midPhasePool.filter(i => i.rarity === 'legendary')
            : r2mid < 0.51
            ? midPhasePool.filter(i => i.rarity === 'epic')
            : midPhasePool.filter(i => i.rarity === 'rare');
          if(pool2.length === 0) pool2 = midPhasePool.filter(i => i.rarity === 'rare');
          const tpl2 = pool2[Math.floor(Math.random() * pool2.length)];
          midItem = { id: Date.now().toString(36) + 'w', name: tpl2.name, category: (tpl2.category ?? 'accessory') as ItemCategory, rarity: tpl2.rarity, bonuses: { ...tpl2.bonuses }, flavorText: tpl2.flavorText, source: 'walk' as const, acquiredAt: dog.totalGameMin };
        } else {
          // 通常散歩: Legendary:0.1% / Epic:2.9% / Rare:97%
          const rwm = Math.random();
          let pool3: typeof WALK_ITEM_POOL;
          if(rwm < 0.001) { pool3 = midPhasePool.filter(i => i.rarity === 'legendary'); }
          else if(rwm < 0.030) { pool3 = midPhasePool.filter(i => i.rarity === 'epic'); }
          else { pool3 = midPhasePool.filter(i => i.rarity === 'rare'); }
          if(pool3.length === 0) pool3 = midPhasePool.filter(i => i.rarity === 'rare');
          const tpl3 = pool3[Math.floor(Math.random() * pool3.length)];
          midItem = { id: Date.now().toString(36) + 'w', name: tpl3.name, category: (tpl3.category ?? 'accessory') as ItemCategory, rarity: tpl3.rarity, bonuses: { ...tpl3.bonuses }, flavorText: tpl3.flavorText, source: 'walk' as const, acquiredAt: dog.totalGameMin };
        }
        if(midItem) {
          const prevInv = dog.inventory ?? [];
          d.inventory = [...prevInv, midItem].slice(-50);
          const bStr = Object.entries(midItem.bonuses).map(([k,v])=>`${
            k==='beauty_coat'?'毛並み':k==='beauty_charm'?'愛嬌':k==='luck'?'幸運':
            k==='discipline'?'規律':k==='speed'?'速度':k==='stamina'?'スタミナ':
            k==='spring'?'バネ':k==='intelligence'?'知性':k}+${v}`).join('/');
          const itemEvt = `🎒 「${midItem.name}」[${midItem.rarity.toUpperCase()}]を拾った！（${bStr}）→クローゼットで装備できる`;
          d.walkEventLog = [...(d.walkEventLog ?? []), itemEvt].slice(-20);
          d.log = addLog(d.log, itemEvt);
        }
      }
    }
    // ミートアップ生成（まだ出会っていない場合）
    if(!dog.walkMeetup) {
      const meetupBreedMult = dog.breed === 'golden retriever' ? 1.05 : 1.0;
      const perTickMeetupChance = MEETUP_CHANCE * meetupBreedMult / (WALK_DIRT_TICKS - 4);
      if(Math.random() < perTickMeetupChance) {
        const midDest = dog.walkDestination;
        let midNpcGender: Gender;
        if(midDest === 'park') {
          midNpcGender = Math.random() < 0.80 ? ((dog.gender ?? 'male') === 'male' ? 'female' : 'male') : (dog.gender ?? 'male') as Gender;
        } else if(midDest === 'mountain') {
          midNpcGender = Math.random() < 0.80 ? (dog.gender ?? 'male') as Gender : ((dog.gender ?? 'male') === 'male' ? 'female' : 'male');
        } else {
          midNpcGender = (Math.random() < 0.5 ? 'male' : 'female') as Gender;
        }
        const midKnown = (dog.knownDogs ?? []).filter(n => n.gender === midNpcGender);
        const useKnown2 = midKnown.length > 0 && Math.random() < MEETUP_KNOWN_DOG_CHANCE;
        let midNpc: NpcDog;
        if(useKnown2) {
          const weights2 = midKnown.map(n => 10 + (n.reencounterBonus ?? 0));
          const totalW2 = weights2.reduce((a,b)=>a+b,0);
          let rw2 = Math.random() * totalW2;
          let chosen2 = midKnown[0];
          for(let i=0;i<midKnown.length;i++){rw2-=weights2[i];if(rw2<=0){chosen2=midKnown[i];break;}}
          midNpc = { ...chosen2 };
        } else {
          midNpc = generateNpcDog(midNpcGender);
        }
        const midNpcStates: NpcMeetupState[] = ['aggressive','playbow','explore','anxious'];
        const midNpcState: NpcMeetupState = midNpcStates[Math.floor(Math.random() * midNpcStates.length)];
        // 大会直前期間（月の22日〜28日）はライバル犬遭遇率UP
        const totalDaysForContest = Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY);
        const dayOfMonthForContest = (totalDaysForContest % CONTEST_CYCLE_DAYS) + 1;
        const isContestNear = dayOfMonthForContest >= 22 && dayOfMonthForContest <= 28;
        if(isContestNear) {
          d.arousal = clamp(d.arousal + 1); // ライバル犬の気配で興奮+1
        }
        d.walkMeetup = { npc: midNpc, phase: 'encounter', npcState: midNpcState, giftItem: null, intimacyGain: 0, rewardLog: '' };
        // 子犬期: 他犬との遭遇 SE+1
        if (getLifecycleStage(d.totalGameMin) === 'puppy') {
          d.socialExp = Math.min(100, (d.socialExp ?? 0) + 1);
        }
        const midMeetEvt = `🐕 ${midNpc.name}（${midNpc.breed}）が近づいてきた！`;
        d.walkEventLog = [...(d.walkEventLog ?? []), midMeetEvt].slice(-20);
      }
    }
    // ── Excelイベント抽選（散歩1回あたり30%、まだ発生していない場合）
    if(!dog.walkStrollEventFired && Math.random() < STROLL_EVENT_CHANCE) {
      const midDest = dog.walkDestination;
      const midStage = getLifecycleStage(d.totalGameMin);
      const stageKey: 'puppy'|'adult'|'senior' = midStage === 'puppy' ? 'puppy' : midStage === 'senior' ? 'senior' : 'adult';
      const pool = STROLL_EVENTS.filter(e => e.area === midDest && e[stageKey] != null);
      if(pool.length > 0) {
        const ev = pool[Math.floor(Math.random() * pool.length)];
        const rawText = ev[stageKey] as string;
        const evText = rawText.replace(/●●/g, dog.dogName ?? 'わんこ');
        // ステータス反映
        const applyStatChange = (statName: string|null, amt: number) => {
          if(!statName || amt === 0) return;
          if(statName === 'hunger')      d.hunger      = clamp((d.hunger ?? 0) + amt);
          else if(statName === 'dirtiness') d.dirtiness = clamp((d.dirtiness ?? 0) + amt);
          else if(statName === 'bladder')   d.bladder   = clamp((d.bladder ?? 0) + amt);
          else if(statName === 'arousal')   d.arousal   = clamp((d.arousal ?? 0) + amt);
          else if(statName === 'happiness') d.happiness = clamp((d.happiness ?? 0) + amt);
          else if(statName === 'sleepiness') d.sleepiness = clamp((d.sleepiness ?? 0) + amt);
          else if(statName === 'fatigue')   d.fatigue   = clamp((d.fatigue ?? 0) + amt);
          else if(statName === 'discipline') d.abilities = {...d.abilities, physical:{...d.abilities.physical, discipline: clampAbility(d.abilities.physical.discipline + amt)}};
          else if(statName === 'speed')  d.abilities = {...d.abilities, physical:{...d.abilities.physical, speed:  clampAbility(d.abilities.physical.speed + amt)}};
          else if(statName === 'stamina') d.abilities = {...d.abilities, physical:{...d.abilities.physical, stamina: clampAbility(d.abilities.physical.stamina + amt)}};
          else if(statName === 'spring') d.abilities = {...d.abilities, physical:{...d.abilities.physical, spring: clampAbility(d.abilities.physical.spring + amt)}};
          else if(statName === 'focus')  d.abilities = {...d.abilities, physical:{...d.abilities.physical, focus:  clampAbility((d.abilities.physical.focus ?? 0) + amt)}};
          else if(statName === 'coat')   d.abilities = {...d.abilities, beauty:{...d.abilities.beauty, coat:  Math.min(100, Math.max(0, d.abilities.beauty.coat + amt))}};
          else if(statName === 'charm')  d.abilities = {...d.abilities, beauty:{...d.abilities.beauty, charm: Math.min(100, Math.max(0, d.abilities.beauty.charm + amt))}};
          else if(statName === 'intelligence') d.abilities = {...d.abilities, intelligence: clampAbility(d.abilities.intelligence + amt)};
          else if(statName === 'luck')   d.abilities = {...d.abilities, luck: Math.min(100, Math.max(0, d.abilities.luck + amt))};
          else if(statName === 'style') {
            // トイプードル特性: スタイルへのデバフを無効化
            if(amt < 0 && dog.breed === 'toy poodle') return;
            d.style = Math.min(100, Math.max(0, (d.style ?? 0) + amt));
          }
        };
        applyStatChange(ev.stat1, ev.amt1);
        applyStatChange(ev.stat2, ev.amt2);
        // バフ/デバフ音
        if (_sfxSettings.enabled) {
          const isDebuff = (ev.amt1 ?? 0) < 0 || (ev.amt2 ?? 0) < 0;
          const isBuff   = (ev.amt1 ?? 0) > 0 || (ev.amt2 ?? 0) > 0;
          if (isDebuff) SoundManager.playSfx(SND_SFX_DEBUFF, _sfxSettings.volume);
          else if (isBuff) SoundManager.playSfx(SND_SFX_BUFF, _sfxSettings.volume);
        }
        // ステータス変化テキスト生成
        const statNameJP = (s: string|null): string => {
          if(!s) return '';
          const MAP: Record<string,string> = {
            hunger:'空腹', dirtiness:'汚れ', bladder:'排泄', arousal:'興奮',
            happiness:'幸福', sleepiness:'眠気', fatigue:'疲労',
            discipline:'規律', speed:'速度', stamina:'スタミナ',
            spring:'バネ', focus:'集中力', coat:'毛並み', charm:'愛嬌',
            intelligence:'知性', luck:'幸運', style:'スタイル',
          };
          return MAP[s] ?? s;
        };
        const statParts: string[] = [];
        if(ev.stat1 && ev.amt1 !== 0) statParts.push(`${statNameJP(ev.stat1)}${ev.amt1>0?'+':''}${ev.amt1}`);
        if(ev.stat2 && ev.amt2 !== 0) statParts.push(`${statNameJP(ev.stat2)}${ev.amt2>0?'+':''}${ev.amt2}`);
        const statsText = statParts.length > 0 ? `📊 ${statParts.join('  ')}` : '';
        d.walkStrollEventFired   = true;
        d.walkStrollEventMsg     = evText;
        d.walkStrollEventPending = true;
        d.walkStrollEventStats   = statsText;
        d.walkEventLog = [...(d.walkEventLog ?? []), `🌟 ${evText.slice(0, 60)}…`].slice(-20);
        d.log = addLog(d.log, `🌟 散歩イベント発生！`);
      }
    }
  }

  // ── 散歩完了（walkingTicksLeft が 0 になった瞬間）
  if(wasWalking && !isWalking) {
    // コイン + フィジカル報酬（アイテムは mid-walk 済みのため item は無視）
    const endRewards = generateWalkRewards(dog, dog.walkDestination);
    d.coins = (dog.coins ?? 0) + endRewards.coins;
    if (_sfxSettings.enabled) SoundManager.playSfx(SND_SFX_COIN, _sfxSettings.volume);
    const _wSb = dog.satoriBonuses ?? [];
    const walkSpeedGain   = Math.max(1, Math.round(applyBreedGain(endRewards.speedGain,   dog.breed ?? 'shibainu', 'speed')   * satoriAbilityMult(_wSb, 'speed',   true)));
    const walkStaminaGain = Math.max(1, Math.round(applyBreedGain(endRewards.staminaGain, dog.breed ?? 'shibainu', 'stamina') * satoriAbilityMult(_wSb, 'stamina', true)));
    d.abilities = {
      ...d.abilities,
      physical: {
        ...d.abilities.physical,
        speed:   clampAbility(d.abilities.physical.speed   + walkSpeedGain),
        stamina: clampAbility(d.abilities.physical.stamina + walkStaminaGain),
      },
    };
    d.log = addLog(d.log,
      `散歩から帰ってきた！💰+${endRewards.coins}枚 💨速度+${walkSpeedGain} 💪スタミナ+${walkStaminaGain}`
    );
    d.style = Math.min(100, calcStyleScore(dog.equipment ?? emptyEquipment()) + (_satB.has('myousou') ? 10 : 0));
    d.walkLoopCount = (dog.walkLoopCount ?? 0) + 1;
    // v13: walkStats tracking
    if (dog.walkDestination) {
      const prevWalkStats = dog.walkStats ?? {};
      d.walkStats = { ...prevWalkStats, [dog.walkDestination]: (prevWalkStats[dog.walkDestination] ?? 0) + 1 };
    }
    // 散歩で毛並みペナルティ（荘厳の悟り・光明相で軽減）
    const _wCoatPenalty = Math.round(WALK_COAT_PENALTY * satoriAbilityMult(dog.satoriBonuses ?? [], 'coat', false));
    d.abilities = { ...d.abilities, beauty: { ...d.abilities.beauty, coat: Math.max(0, d.abilities.beauty.coat - _wCoatPenalty) } };
    // 散歩完了時の汚れ加算（目的地によって変動）
    const walkEndDirt = dog.walkDestination === 'mountain' ? 25
                      : dog.walkDestination === 'beach'    ? 22
                      : dog.walkDestination === 'park'     ? 18
                      : dog.walkDestination === 'secret'   ? 15
                      : 15; // city
    d.dirtiness = clamp(d.dirtiness + walkEndDirt);

    // うんちデバフのカウントダウン（このループでウンチを踏まなかった場合）
    if(!d.walkPoopFired && dog.poopDebuff && dog.poopDebuffWalksLeft > 0) {
      const newLeft2 = dog.poopDebuffWalksLeft - 1;
      d.poopDebuffWalksLeft = newLeft2;
      if(newLeft2 <= 0) {
        d.poopDebuff = false;
        d.log = addLog(d.log, '✨ うんちデバフ解除！幸運が回復しました');
      }
    }

    // フラグリセット（次のループ用）
    d.walkPoopFired = false;
    d.walkItemFired = false;

    // 固有イベント（目的地別、100%で確実に実行、1日1回）
    const endCurrentDay = Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY);
    const endCanUnique = endCurrentDay > (dog.lastUniqueEventDay ?? -999);
    if(dog.walkDestination && endCanUnique) {
      d.lastUniqueEventDay = endCurrentDay;
      switch(dog.walkDestination) {
        case 'city': {
          const _citySb = dog.satoriBonuses ?? [];
          const nc  = Math.min(100, d.abilities.beauty.coat  + Math.round(2 * satoriAbilityMult(_citySb, 'coat',  true)));
          const nch = Math.min(100, d.abilities.beauty.charm + Math.round(2 * satoriAbilityMult(_citySb, 'charm', true)));
          d.abilities = { ...d.abilities, beauty: { coat: nc, charm: nch } };
          const e2 = '🏙️ ショーウィンドウに自分の姿が映った！ スタイル感覚が磨かれた（毛並み+2 愛嬌+2）';
          d.walkEventLog = [...(d.walkEventLog ?? []), e2].slice(-20);
          d.log = addLog(d.log, e2);
          break;
        }
        case 'park': {
          d.personality = { ...d.personality, agreeableness: Math.min(0.95, d.personality.agreeableness + 0.05) };
          const e3 = '🌳 ほかの犬たちが一斉にプレイボウ！ 協調性が育まれた（協調性+5%）';
          d.walkEventLog = [...(d.walkEventLog ?? []), e3].slice(-20);
          d.log = addLog(d.log, e3);
          break;
        }
        case 'beach': {
          d.abilities = { ...d.abilities, physical: { ...d.abilities.physical, stamina: clampAbility(d.abilities.physical.stamina + 30) } };
          // v11: スタミナ最大値 +5
          d.maxStamina = (d.maxStamina ?? dog.maxStamina ?? 300) + 5;
          const e4 = `🏖️ 波打ち際を全力でダッシュ！ スタミナが鍛えられた（スタミナ+30 スタミナ上限+5→${d.maxStamina}）`;
          d.walkEventLog = [...(d.walkEventLog ?? []), e4].slice(-20);
          d.log = addLog(d.log, e4);
          break;
        }
        case 'mountain': {
          d.abilities = { ...d.abilities, intelligence: clampAbility(d.abilities.intelligence + 20) };
          const e5 = '⛰️ さまざまな動物の匂い跡を発見！ 知性が刺激された（知性+20）';
          d.walkEventLog = [...(d.walkEventLog ?? []), e5].slice(-20);
          d.log = addLog(d.log, e5);
          break;
        }
        case 'secret': {
          d.hasSecretInfo = false;
          const e6 = '✨ 名だたる名犬たちが集まる秘密の集いに参加した！ 特別なアイテムを手に入れた！';
          d.walkEventLog = [...(d.walkEventLog ?? []), e6].slice(-20);
          d.log = addLog(d.log, e6);
          break;
        }
      }
    }

    // ── プチ自慢イベント（低確率）
    if(Math.random() < 0.15) {
      const coatLevel = d.abilities.beauty.coat;
      const happyGain = Math.max(1, Math.round(coatLevel / 20)); // 毛並みに応じて1-5
      d.happiness = clamp(d.happiness + happyGain * 2);
      const praiseName = ['ポメラニアン','マルチーズ','シュナウザー'][Math.floor(Math.random()*3)];
      const e7 = `💬 散歩中に${praiseName}のオーナーに「毛並みが綺麗ね！」と褒められた✨（幸福感+${happyGain*2}）`;
      d.walkEventLog = [...(d.walkEventLog ?? []), e7].slice(-20);
      d.log = addLog(d.log, e7);
    }

    // ── スカウトイベント（スタイル≥70 & 愛嬌≥60、低確率）
    const currentStyle = calcStyleScore(dog.equipment ?? emptyEquipment());
    if(currentStyle >= SCOUT_STYLE_THRESHOLD && d.abilities.beauty.charm >= SCOUT_CHARM_THRESHOLD && Math.random() < 0.08) {
      const scoutCoins = 300 + Math.floor(Math.random() * 200);
      d.coins = (d.coins ?? 0) + scoutCoins;
      const e8 = `📸 雑誌社からモデル犬のスカウトが来た！スタイル${currentStyle}・愛嬌${Math.round(d.abilities.beauty.charm)}が認められた！コイン+${scoutCoins}💰`;
      d.walkEventLog = [...(d.walkEventLog ?? []), e8].slice(-20);
      d.log = addLog(d.log, e8);
    }

    // ── 野良犬との対峙（山道で低確率）
    if(dog.walkDestination === 'mountain' && Math.random() < 0.20) {
      const physTotal = d.abilities.physical.discipline + d.abilities.physical.speed + d.abilities.physical.stamina + d.abilities.physical.spring;
      if(physTotal >= STRAY_DOG_POWER_THRESHOLD) {
        // 勝利: フィジカル全項目UP
        d.abilities = {
          ...d.abilities,
          physical: {
            discipline: clampAbility(d.abilities.physical.discipline + 5),
            speed:      clampAbility(d.abilities.physical.speed      + 5),
            stamina:    clampAbility(d.abilities.physical.stamina     + 5),
            spring:     clampAbility(d.abilities.physical.spring      + 5),
          },
        };
        const e9 = `🐺 山道で野良犬に遭遇！フィジカル合計${physTotal}で威圧して追い払った💪（全フィジカル+5）`;
        d.walkEventLog = [...(d.walkEventLog ?? []), e9].slice(-20);
        d.log = addLog(d.log, e9);
      } else {
        // 敗北: スタミナ0
        d.abilities = {
          ...d.abilities,
          physical: { ...d.abilities.physical, stamina: 0 },
        };
        const e10 = `🐺 山道で野良犬に襲われた…フィジカル合計${physTotal}では敵わなかった。怪我でスタミナ0💔`;
        d.walkEventLog = [...(d.walkEventLog ?? []), e10].slice(-20);
        d.log = addLog(d.log, e10);
      }
    }
  }

  // ── 疲労度 (v5: 待機中に微量回復)
  if(d.isSleeping){
    d.fatigue=clamp(dog.fatigue-gameDelta*0.5);
  }else if(dog.currentAction==='resting'||dog.currentAction==='wandering'){
    // 待機・徘徊中はごくわずかに回復
    d.fatigue=clamp(dog.fatigue-gameDelta*0.01);
  }else if(dog.currentAction==='playing'||dog.currentAction==='exploring'){
    d.fatigue=clamp(dog.fatigue+gameDelta*0.10*_mFatigue*_satFatigue);
  }else{
    d.fatigue=clamp(dog.fatigue+gameDelta*0.03*_mFatigue*_satFatigue);
  }

  // ── 覚醒度: 50（ニュートラル）へ収束 / 睡眠中は急速低下
  if(d.isSleeping){
    d.arousal = clamp(dog.arousal - gameDelta * 0.8);
  }else{
    // (AROUSAL_NEUTRAL - current) × rate → 50 へ引き戻す
    const diff = AROUSAL_NEUTRAL - dog.arousal;
    d.arousal = clamp(dog.arousal + gameDelta * diff * AROUSAL_CONVERGENCE_RATE);
  }
  // 柴犬特性: 興奮は最大90で止まる
  if(_breedId === 'shibainu' && d.arousal > 90) d.arousal = 90;
  // 寂静の悟り: 興奮を25〜85の範囲に収める
  if(_satB.has('jakujou')) d.arousal = clamp(d.arousal, 25, 85);

  // ── スタミナ自然回復（1ゲーム時間で0→maxStaminaに全快）
  const maxSt = dog.maxStamina ?? 300;
  if(!isWalking) {
    const recovered = Math.min(
      maxSt,
      d.abilities.physical.stamina + gameDelta * maxSt * STAMINA_RECOVERY_RATE
    );
    d.abilities = {
      ...d.abilities,
      physical: { ...d.abilities.physical, stamina: Math.round(recovered) },
    };
  }
  // スタミナが maxStamina を超えないようにクランプ（散歩中も）
  if(d.abilities.physical.stamina > maxSt) {
    d.abilities = {
      ...d.abilities,
      physical: { ...d.abilities.physical, stamina: maxSt },
    };
  }

  // ── 集中力（Focus）の更新
  {
    const curFocus = dog.abilities.physical.focus ?? 0;
    let newFocus = curFocus;
    if(dog.arousal >= FOCUS_AROUSAL_DEBUFF_THRESHOLD) {
      // 興奮度80以上 → 急落デバフ
      newFocus = Math.max(0, curFocus - gameDelta * FOCUS_AROUSAL_DEBUFF_RATE * 100);
    } else {
      // 通常時は自然減衰（緩やか）
      newFocus = Math.max(0, curFocus - gameDelta * FOCUS_DECAY_RATE);
    }
    d.abilities = {
      ...d.abilities,
      physical: { ...d.abilities.physical, focus: Math.round(newFocus) },
    };
  }

  // ── 夜間強制就寝（22:00以降は静かに眠る）
  if(d.dayTimeMin >= NIGHT_START_MIN) {
    d.isSleeping = true;
    d.currentAction = 'sleeping';
  }

  // ── 統合ストレス（生理欲求から間接導出）
  const sc=calcStressComponents(d);
  if(d.sleepiness>80&&!d.isSleeping)sc.total+=0.18;
  const discount=attachmentDiscount(dog.attachment);
  const _effDecay = _satB.has('shoujin') ? 0.066 : 0.06; // 精進の悟り: 活力増加速度+10%
  const effDelta=sc.total>0?sc.total*discount-_effDecay:-_effDecay;
  d.stress=clamp(dog.stress+gameDelta*effDelta);
  d.stressFromHunger=sc.fromHunger;
  d.stressFromDirt=sc.fromDirt;
  d.stressFromBladder=sc.fromBladder;

  if(d.stress>=STRESS_DESTROY_THRESHOLD&&dog.stress<STRESS_DESTROY_THRESHOLD)
    d.log=addLog(d.log,'⚠️ ストレス臨界！破壊行動が始まった！');
  else if(d.stress>=STRESS_BARK_THRESHOLD&&dog.stress<STRESS_BARK_THRESHOLD)
    d.log=addLog(d.log,'⚠️ ストレス高！無駄吠えが始まった！');

  // 愛着度: 自然減衰（低速化）+ 放置ペナルティ（空腹+汚れ放置で追加減衰）
  const neglectPenalty = (dog.hunger > 60 && dog.dirtiness > 50) ? 0.003 : 0;
  const _attachDecay = _satB.has('kizuna') ? 0.0009 : 0.001; // 絆の悟り: 愛着の上昇速度+10%
  d.attachment=clamp(dog.attachment-gameDelta*(_attachDecay+neglectPenalty));

  // ── 幸福度：生理欲求から間接導出（v5: 直接操作を廃止し、生理状態からのみ算出）
  const stressOver50=Math.max(0,(dog.stress-50)/50);
  let hD=0;
  // 苦痛項（超過量に比例）
  hD -= Math.max(0,d.hunger   -60)/40*0.12;
  hD -= Math.max(0,d.bladder  -70)/30*0.10;
  hD -= Math.max(0,d.dirtiness-60)/40*0.08;
  hD -= Math.max(0,d.fatigue  -70)/30*0.06;
  hD -= Math.max(0,d.stress   -50)/50*0.14;
  // 快適項（低値で上昇）
  hD += d.hunger   <30?0.04:0;
  hD += d.dirtiness<30?0.03:0;
  hD += !d.isSleeping&&d.fatigue<40?0.03:0;
  hD += d.isSleeping?0.05:0;
  hD += d.attachment>60?0.04*(1-stressOver50):0;
  hD += 0.01; // 微量ベースライン
  // 法悦の悟り: 幸福感ゲージ増加速度+10%
  if(_satB.has('houetsu') && hD > 0) hD *= 1.1;
  d.happiness=clamp(dog.happiness+gameDelta*hD);

  // ── 行動決定（恐怖優先 → 安定化ホールド）
  if(d.fearfulTicksLeft > 0) {
    d.fearfulTicksLeft = d.fearfulTicksLeft - 1;
    d.currentAction = 'fearful';
    d.actionHoldTicks = ACTION_MIN_HOLD_TICKS;
  } else if(d.isSleeping) {
    d.currentAction = 'sleeping';
    d.actionHoldTicks = ACTION_MIN_HOLD_TICKS;
  } else {
    const isEmergency = d.stress >= STRESS_BARK_THRESHOLD;
    if(isEmergency || dog.actionHoldTicks <= 0) {
      d.currentAction = decideAction(d);
      d.actionHoldTicks = ACTION_MIN_HOLD_TICKS;
    } else {
      d.actionHoldTicks = dog.actionHoldTicks - 1;
    }
  }

  // ── 統計
  d.statsActionCount+=1;
  if(d.currentAction==='excessive_barking')d.statsBarkCount+=1;
  if(d.currentAction==='destructive')d.statsDestroyCount+=1;

  // ── v10: 大会実行チェック（ゲーム月の初日 & エントリー済み）
  {
    const prevTotalDay = Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY);
    const nextTotalDay = Math.floor(d.totalGameMin   / GAME_MINUTES_PER_DAY);
    if(nextTotalDay > prevTotalDay) {
      const dayIdx   = nextTotalDay % CONTEST_CYCLE_DAYS;
      const newMonth = Math.floor(nextTotalDay / CONTEST_CYCLE_DAYS);
      const lastRun  = dog.lastContestRunMonth ?? -1;
      if(dayIdx === 0 && newMonth > lastRun) {
        d.lastContestRunMonth = newMonth;
        if(dog.contestEntered && dog.contestEntryMonth === newMonth - 1) {
          // ── コンテスト種別（3種ローテーション: 月%3: 0=フィジカル, 1=ビューティー, 2=ノーズワーク）
          const contestTypeIdx = dog.contestEntryMonth % 3;
          const contestType: 'physical'|'beauty'|'nosework' =
            contestTypeIdx === 0 ? 'physical' : contestTypeIdx === 1 ? 'beauty' : 'nosework';

          // ── 自犬スコア計算
          const calcMyScore = (abilities: AbilityStats, conscientious: number, arousal: number): number => {
            if(contestType === 'physical') {
              const phys = abilities.physical;
              const cBonus = conscientious >= 0.6 ? 1.5 : conscientious < 0.4 ? 0.7 : 1.0;
              return Math.round(
                (phys.discipline*0.30 + phys.speed*0.30 + phys.stamina*0.20 + phys.spring*0.20)
                * calcArousalBuff(arousal) * cBonus
              );
            } else if(contestType === 'beauty') {
              const coat  = Math.min(100, abilities.beauty.coat);
              const charm = Math.min(100, abilities.beauty.charm);
              const luckMult = 1 + Math.min(100, abilities.luck) / 200;
              return Math.round((coat*6 + charm*4) * luckMult);
            } else {
              // ノーズワーク: 知性×集中力補正×運補正
              const intel = abilities.intelligence;
              const focus = abilities.physical.focus ?? 0;
              const focusBonus = 1.0 + (focus / 1000) * 0.5; // focus 0→1.0倍、1000→1.5倍
              const luckMult2 = 1 + Math.min(100, abilities.luck) / 200;
              return Math.round(intel * focusBonus * luckMult2);
            }
          };
          const equipBonus = calcEquipmentBonuses(dog.equipment ?? emptyEquipment());
          const styl = calcStyleScore(dog.equipment ?? emptyEquipment());
          let myScore: number;
          if(contestType === 'physical') {
            const phys = d.abilities.physical;
            const cBonus = dog.personality.conscientiousness >= 0.6 ? 1.5
              : dog.personality.conscientiousness < 0.4 ? 0.7 : 1.0;
            myScore = Math.round(
              (phys.discipline*0.30 + phys.speed*0.30 + phys.stamina*0.20 + phys.spring*0.20)
              * calcArousalBuff(dog.arousal) * cBonus
            );
          } else if(contestType === 'beauty') {
            const coat  = Math.min(100, d.abilities.beauty.coat  + (equipBonus.beauty_coat  ?? 0));
            const charm = Math.min(100, d.abilities.beauty.charm + (equipBonus.beauty_charm ?? 0));
            const luckMult = 1 + Math.min(100, d.abilities.luck + (equipBonus.luck ?? 0)) / 200;
            myScore = Math.round((coat*6 + charm*4 + styl*5) * luckMult);
          } else {
            // ノーズワーク（嗅覚捜査）
            const intel = d.abilities.intelligence + (equipBonus.intelligence ?? 0);
            const focus = (d.abilities.physical.focus ?? 0) + (equipBonus.focus ?? 0);
            const focusBonus = 1.0 + (Math.min(1000, focus) / 1000) * 0.5;
            const luckMult = 1 + Math.min(100, d.abilities.luck + (equipBonus.luck ?? 0)) / 200;
            myScore = Math.round(intel * focusBonus * luckMult);
          }
          const base = myScore > 0 ? myScore : 100;

          // ── 参加者リスト構築（最大5頭）
          const participants: ContestParticipant[] = [];

          // [1] 歴代犬（lineage）を他ユーザーとして参照
          const lineagePool = dog.lineage ?? [];
          for(const rec of lineagePool) {
            if(participants.length >= 5) break;
            const recScore = calcMyScore(rec.abilities, 0.5, 50); // lineageは誠実性・覚醒不明なので中央値
            const diff = Math.abs(recScore - myScore) / (base);
            if(diff <= 0.20) {
              // ±20%以内 → PvP扱い
              participants.push({ name: `${rec.name}（第${rec.generation}世代）`, score: recScore, type: 'pvp' });
            } else {
              // 範囲外 → CPU扱い
              participants.push({ name: `${rec.name}（CPU）`, score: recScore, type: 'cpu' });
            }
          }

          // [2] NPCで残枠を補充（最大4頭、不足分はランダム選択）
          // NPCの4ティア定義：①+10% ②equal ③-20% ④-30%
          const npcTierMults: Record<1|2|3|4, number> = { 1:1.10, 2:1.00, 3:0.80, 4:0.70 };
          const allTiers: (1|2|3|4)[] = [1,2,3,4];
          const npcSlotsNeeded = Math.min(4, 5 - participants.length);
          // 補充が4未満ならランダム選択、ちょうど4ならすべて使用
          const selectedTiers: (1|2|3|4)[] = npcSlotsNeeded >= 4
            ? [...allTiers]
            : ((): (1|2|3|4)[] => {
                const shuffled = [...allTiers].sort(() => Math.random() - 0.5);
                return shuffled.slice(0, npcSlotsNeeded) as (1|2|3|4)[];
              })();
          for(const tier of selectedTiers) {
            const sr = 0.60 + Math.random() * 0.40;  // アクション成功率 60〜100%
            const npcScore = Math.max(0, Math.round(base * npcTierMults[tier] * sr));
            participants.push({
              name: `NPC犬${participants.length + 1}`,
              score: npcScore,
              type: 'npc',
              npcTier: tier,
              successRate: sr,
            });
          }

          // ── 順位決定
          const allScores = [...participants.map(p => p.score), myScore].sort((a,b) => b-a);
          const rank = allScores.indexOf(myScore) + 1;

          // ── 賞金テーブル（1位〜6位）: 2000/1000/500/100/50/0
          const prizeTable = [2000, 1000, 500, 100, 50, 0];
          const prizeCoins = prizeTable[(rank-1)] ?? 0;
          const won = rank === 1;
          d.coins = (d.coins ?? 0) + prizeCoins;
          if (prizeCoins > 0 && _sfxSettings.enabled) SoundManager.playSfx(SND_SFX_COIN, _sfxSettings.volume);

          // ── ログ用タイプ名（trophy にも使う）
          const typeName = contestType === 'physical' ? 'フィジカル（トライアスロン）'
            : contestType === 'beauty' ? 'ビューティー（フォトセッション）'
            : 'ノーズワーク（嗅覚捜査）';

          if(won) {
            d.tournamentWins = (dog.tournamentWins ?? 0) + 1;
            // トロフィーをインベントリに追加
            const calDate = gameCalendar(d.totalGameMin, GAME_MINUTES_PER_DAY);
            const trophy: InventoryItem = {
              id: `trophy_${calDate.year}_${calDate.month}_${Date.now().toString(36)}`,
              name: `${calDate.year}年目${calDate.month}月 ${typeName}優勝トロフィー`,
              category: 'accessory' as const,
              rarity: 'epic' as const,
              bonuses: {},
              flavorText: `${calDate.year}年目${calDate.month}月の${typeName}大会で優勝した証。`,
              source: 'event' as const,
              acquiredAt: d.totalGameMin,
            };
            d.inventory = [...(d.inventory ?? []), trophy];
          }

          // ── 副賞アイテム（大会景品プールから: Legendary:1%/Epic:79%/Rare:20%）
          let bonusItem: ContestBonusItem | null = null;
          if(rank <= 2) {
            const tickContestPhase = getLifecycleStage(d.totalGameMin);
            const tickContestPool = CONTEST_ITEM_POOL.filter(i => !i.phases || i.phases[tickContestPhase] === true);
            const rc2 = Math.random();
            const targetRarity: 'legendary'|'epic'|'rare' = rc2 < 0.01 ? 'legendary' : rc2 < 0.80 ? 'epic' : 'rare';
            let itemPool = tickContestPool.filter(i => i.rarity === targetRarity);
            if(!itemPool.length) itemPool = tickContestPool.filter(i => i.rarity === 'rare');
            if(itemPool.length > 0) {
              const tpl = itemPool[Math.floor(Math.random() * itemPool.length)];
              bonusItem = { name: tpl.name, rarity: targetRarity, bonuses: { ...tpl.bonuses }, flavorText: tpl.flavorText };
              // インベントリに追加
              const newItem: InventoryItem = {
                id: Date.now().toString(36) + 'c' + rank,
                name: tpl.name,
                category: (tpl.category ?? 'accessory') as ItemCategory,
                rarity: targetRarity,
                bonuses: { ...tpl.bonuses },
                flavorText: tpl.flavorText,
                source: 'event' as const,
                acquiredAt: d.totalGameMin,
              };
              d.inventory = [...(d.inventory ?? []), newItem];
            }
          }

          // ── ログ
          const itemNote = bonusItem ? ` 副賞「${bonusItem.name}」獲得！` : '';
          d.log = addLog(d.log, won
            ? `🏆 ${typeName}コンテスト優勝！スコア${myScore} 賞金${prizeCoins}💰 通算${d.tournamentWins}勝${itemNote}`
            : `🏅 ${typeName}コンテスト第${rank}位。スコア${myScore} 賞金${prizeCoins}💰${itemNote}`
          );
          d.contestPendingResult = { type: contestType, rank, score: myScore, coins: prizeCoins, won, participants, bonusItem };
          d.contestEntered = false;
          // 大会後の認知能力向上
          if (rank <= 3) {
            d.cognition = Math.min(1000, (d.cognition ?? 500) + 5);
          }
        }
      }
    }
  }

  // ── v12: ライフサイクル処理 ──
  {
    const stage = getLifecycleStage(d.totalGameMin);
    const prevStage = getLifecycleStage(dog.totalGameMin);

    // ── ピーク能力値の更新（毎ティック）
    d.peakAbilities = {
      physical: {
        discipline: Math.max((dog.peakAbilities?.physical.discipline ?? 0), d.abilities.physical.discipline),
        speed:      Math.max((dog.peakAbilities?.physical.speed      ?? 0), d.abilities.physical.speed),
        stamina:    Math.max((dog.peakAbilities?.physical.stamina    ?? 0), d.abilities.physical.stamina),
        spring:     Math.max((dog.peakAbilities?.physical.spring     ?? 0), d.abilities.physical.spring),
        focus:      Math.max((dog.peakAbilities?.physical.focus      ?? 0), d.abilities.physical.focus ?? 0),
      },
      intelligence: Math.max((dog.peakAbilities?.intelligence ?? 0), d.abilities.intelligence),
      beauty: {
        coat:  Math.max((dog.peakAbilities?.beauty.coat  ?? 0), d.abilities.beauty.coat),
        charm: Math.max((dog.peakAbilities?.beauty.charm ?? 0), d.abilities.beauty.charm),
      },
      luck: Math.max((dog.peakAbilities?.luck ?? 0), d.abilities.luck),
    };

    // ── 子犬期（社会化期）処理
    if (stage === 'puppy') {
      // 子犬教室イベント（week 8 通過時）
      if (!dog.puppyClassEventFired) {
        const prevWeeks = 3 + Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY) / 7;
        const currWeeks = 3 + Math.floor(d.totalGameMin   / GAME_MINUTES_PER_DAY) / 7;
        if (prevWeeks < 8 && currWeeks >= 8) {
          d.socialExp = Math.min(100, (d.socialExp ?? 0) + 20);
          d.puppyClassEventFired = true;
          d.log = addLog(d.log, '🎓 子犬教室に参加！社会化経験値+20');
        }
      }
      // ネグレクトペナルティ（各ステータスが100に達した瞬間に -1、イベント式）
      if (dog.hunger    < 100 && d.hunger    >= 100) d.socialExp = Math.max(0, (d.socialExp ?? 0) - 1);
      if (dog.dirtiness < 100 && d.dirtiness >= 100) d.socialExp = Math.max(0, (d.socialExp ?? 0) - 1);
      if (dog.bladder   < 100 && d.bladder   >= 100) d.socialExp = Math.max(0, (d.socialExp ?? 0) - 1);
      // 遊び・ケア中のSE緩やかな向上
      if (dog.currentAction === 'playing' || dog.currentAction === 'exploring') {
        d.socialExp = Math.min(100, (d.socialExp ?? 0) + gameDelta * (2 / GAME_MINUTES_PER_DAY));
      }
    }

    // ── 社会化期終了（week13=puppy→adult 遷移）
    if (!dog.seTransitioned && prevStage === 'puppy' && stage === 'adult') {
      d.seTransitioned = true;
      const se = dog.socialExp ?? 0;
      if (se >= 80) {
        d.socialMultiplier = 1.1;
        d.log = addLog(d.log, '✨ 社会化期終了！高い社会化スコアで成長ボーナス+10%を獲得！');
      } else if (se >= 50) {
        d.socialMultiplier = 1.0;
        d.log = addLog(d.log, '📚 社会化期終了。標準的な成長を続けます。');
      } else {
        d.socialMultiplier = 0.95;
        d.log = addLog(d.log, '⚠️ 社会化期終了。社会化が不十分で成長が-5%になります。');
      }
    }

    // ── 老犬期処理
    if (stage === 'senior') {
      const calS = gameCalendar(d.totalGameMin, GAME_MINUTES_PER_DAY);
      const yearDecay = Math.max(1, calS.year - 10); // 11年目以降: year-10 /day
      const decayPerMin = yearDecay / GAME_MINUTES_PER_DAY;
      d.lifespan  = Math.max(0, (d.lifespan  ?? 1000) - gameDelta * decayPerMin);
      d.cognition = Math.max(0, (d.cognition ?? 500)  - gameDelta * decayPerMin * 0.7); // 認知は少し緩やか
      // 悟りスロット解放数の更新（知性1000で+1ボーナス）
      const baseSlots  = Math.min(SATORI_SKILLS.length, calS.year - 10);
      const intelBonus = d.abilities.intelligence >= 1000 ? 1 : 0;
      d.satoriSlotsUnlocked = Math.min(SATORI_SKILLS.length, baseSlots + intelBonus);
      // 寿命尽きたら終焉シーケンス
      if (d.lifespan <= 0 && !dog.isRetired && !dog.pendingDeath) {
        d.pendingDeath = true;
        d.log = addLog(d.log, '💔 寿命を迎えました…');
      }

      // ── 老衰によるフィジカルステータス減退（毎ゲーム日の日替わりで適用）
      const currGameDay  = Math.floor(d.totalGameMin  / GAME_MINUTES_PER_DAY);
      const prevGameDay  = Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY);
      // 毎ティック: 本日フラグを更新（腹八分目 / 運動中）
      if (dog.hunger <= 20)  d.seniorDailyFeedOK = true;
      if (dog.currentAction === 'walking' || dog.currentAction === 'playing') d.seniorDailyExerOK = true;

      if (currGameDay > prevGameDay) {
        // 前日の達成状況を集計してカウンタを更新
        if (d.seniorDailyFeedOK)  d.seniorFeedingDays  = (d.seniorFeedingDays  ?? 0) + 1;
        if (d.seniorDailyExerOK)  d.seniorExerciseDays = (d.seniorExerciseDays ?? 0) + 1;
        // 翌日フラグをリセット
        d.seniorDailyFeedOK = false;
        d.seniorDailyExerOK = false;

        // k_aging = max(0, k_base - α×給餌日数 - β×運動日数)
        const ALPHA = 0.004;
        const BETA  = 0.004;
        const fDays = d.seniorFeedingDays  ?? 0;
        const eDays = d.seniorExerciseDays ?? 0;
        const calcK = (base: number) => Math.max(0, base - ALPHA * fDays - BETA * eDays);

        const _sb = dog.satoriBonuses ?? [];
        const kDiscipline = calcK(0.1) * satoriAbilityMult(_sb, 'discipline', false);
        const kSpeed      = calcK(1.5) * satoriAbilityMult(_sb, 'speed',      false);
        const kSpring     = calcK(1.5) * satoriAbilityMult(_sb, 'spring',     false);
        const kStamina    = calcK(1.0) * satoriAbilityMult(_sb, 'stamina',    false);
        const kFocus      = calcK(1.0) * satoriAbilityMult(_sb, 'focus',      false);

        // t = 老犬期経過年数（11年目→t=1, 12年目→t=2 …）
        const t   = Math.max(0, calS.year - 10);
        const tSq = t * t;

        const peak = d.peakAbilities.physical;
        d.abilities = {
          ...d.abilities,
          physical: {
            ...d.abilities.physical,
            discipline: Math.max(0, Math.min(d.abilities.physical.discipline, peak.discipline - kDiscipline * tSq)),
            speed:      Math.max(0, Math.min(d.abilities.physical.speed,      peak.speed      - kSpeed     * tSq)),
            spring:     Math.max(0, Math.min(d.abilities.physical.spring,     peak.spring     - kSpring    * tSq)),
            stamina:    Math.max(0, Math.min(d.abilities.physical.stamina,    peak.stamina    - kStamina   * tSq)),
            focus:      Math.max(0, Math.min(d.abilities.physical.focus ?? 0, (peak.focus ?? 0) - kFocus  * tSq)),
          },
        };
        d.seniorLastDecayDay = currGameDay;

        // ログ（5日おき）
        if (tSq > 0 && currGameDay % 5 === 0) {
          const careNote = (fDays > 0 || eDays > 0)
            ? `（ケア効果: 給餌${fDays}日 運動${eDays}日）`
            : '（適切なケアで衰えを遅らせられます）';
          d.log = addLog(d.log, `🦴 老衰進行 ${t}年目… フィジカルに衰えが出ている ${careNote}`);
        }
      }
    }

    // ── 認知能力の向上（遊び・出会い）
    if (stage === 'adult' || stage === 'senior') {
      if (dog.currentAction === 'playing' || dog.currentAction === 'exploring') {
        d.cognition = Math.min(1000, (d.cognition ?? 500) + gameDelta * (1 / GAME_MINUTES_PER_DAY));
      }
    }
  }

  // 天運自在: 幸運を100に固定
  if(_satB.has('tennunjizai')) {
    d.abilities = { ...d.abilities, luck: 100 };
  }

  return d;
}

// ─────────────────────────────────────────────
// 表示用ヘルパー
// ─────────────────────────────────────────────

function getStatusText(dog:DogState):string{
  if(dog.dayTimeMin >= NIGHT_START_MIN) return '静かに眠っている...💤';
  if(dog.currentAction==='fearful')return'叱られて怖くて震えている...';
  if(dog.isSleeping){
    const jp:Record<SleepPhase,string>={
      awake:'覚醒',NREM1:'浅い眠り',NREM2:'軽睡眠',NREM3:'深い眠り',REM:'夢を見ている'};
    return`${jp[dog.sleepPhase]}... (${dog.sleepPhase})`;
  }
  if(dog.currentAction==='destructive')return'物を破壊している！緊急ケアが必要！';
  if(dog.currentAction==='excessive_barking')return'激しく吠え続けている！ストレスが限界！';
  if(dog.hunger>=85)return'お腹がすいてたまらない！';
  if(dog.bladder>=85)return'トイレに行きたくてそわそわ...';
  if(dog.dirtiness>=80)return'かなり汚れて不快そう...';
  if(dog.sleepiness>=80)return'うとうとしている...';
  if(dog.stress>=75)return'ストレスでパニック気味...';
  if(dog.happiness>=80)return'ご機嫌でしっぽを振っている♪';
  return ACTION_JP[dog.currentAction];
}

function getEmotionIcon(dog:DogState):string{
  if(dog.currentAction==='fearful')return'😨';
  if(dog.isSleeping)return'💤';
  if(dog.currentAction==='destructive')return'💢';
  if(dog.currentAction==='excessive_barking')return'🔊';
  if(dog.stress>=75)return'⚠️';
  if(dog.happiness>=80&&dog.stress<40)return'😊';
  if(dog.hunger>=85)return'😔';
  if(dog.bladder>=85)return'😖';
  if(dog.dirtiness>=80)return'😣';
  return'🐕';
}

/** 犬の立ち絵画像を状態から選択 */
/**
 * 犬の立ち絵画像を返す。
 * 画像は必ず透過PNG（RGBAアルファチャンネル付き）で用意すること。
 * 新しい犬種を追加する際は:
 *   1. Images/ に {breed}_image_{n}_{Pose}.png（RGBA PNG）を配置
 *   2. ファイル先頭付近で const IMG_XXX = require('./Images/...') を追加
 *   3. dog.presetName 等で分岐してこの関数を拡張
 * ※ JPEG は透明チャンネルを持てないため、必ずPNGで保存すること。
 */
function getDogImage(dog: DogState, override?: 'happy'|'excited'|null) {
  const imgs = BREED_IMAGES[dog.breed] ?? BREED_IMAGES['shibainu'];
  if(override === 'excited') return imgs.excited;
  if(override === 'happy')   return imgs.happy;
  if(dog.isSleeping || dog.dayTimeMin >= NIGHT_START_MIN) return imgs.sleep;
  if(dog.arousal >= AROUSAL_RED_THRESHOLD)               return imgs.excited;
  if(dog.happiness >= 70 && dog.stress < 40)             return imgs.happy;
  if(dog.stress >= 60 || dog.hunger >= 70 || dog.fatigue >= 70) return imgs.sad;
  return imgs.idle;
}

function derivePersonalityType(p:BigFive):string{
  if(p.extraversion>=0.70&&p.openness>=0.65)return'外向・探索型';
  if(p.neuroticism>=0.70)return'内向・回避型';
  if(p.extraversion>=0.65)return'社交・活発型';
  if(p.agreeableness>=0.70)return'協調・温和型';
  if(p.openness>=0.65)return'好奇心旺盛型';
  if(p.conscientiousness>=0.65)return'慎重・堅実型';
  return'バランス型';
}

function getTrustLabel(a:number):string{
  if(a>=80)return'深い信頼 ❤️';if(a>=60)return'親しみ 🧡';
  if(a>=40)return'友好的 💛';if(a>=20)return'様子見 💚';
  return'警戒中 🩶';
}

function getStressHints(dog:DogState):string[]{
  const h:string[]=[];
  if(dog.stressFromHunger >0.05)h.push(`🍖 空腹(+${(dog.stressFromHunger *100).toFixed(0)}%)`);
  if(dog.stressFromDirt   >0.03)h.push(`🧼 汚れ(+${(dog.stressFromDirt   *100).toFixed(0)}%)`);
  if(dog.stressFromBladder>0.03)h.push(`💦 排泄(+${(dog.stressFromBladder*100).toFixed(0)}%)`);
  if(h.length===0&&dog.stress>20)h.push('複合要因（眠気など）');
  return h;
}

/** しつけやすさからの理論的悪行動スコア削減率 */
function calcTrainReduction(before:number,after:number):string{
  const bF=1-before/150;
  const aF=1-after/150;
  if(bF<=0)return'0.0';
  return((bF-aF)/bF*100).toFixed(1);
}

// ─────────────────────────────────────────────
// UI コンポーネント: ParamBar
// ─────────────────────────────────────────────

/** 統一ゲージバー（0-100 / 0-1000 / カスタムmax 対応）
 *  - max=100: コンディション・メンタル系（デフォルト）
 *  - max=1000: フィジカル系
 *  - effValue: 実効値オーバーレイ（バフ・装備ボーナス可視化）
 *  - bonusValue: 装備ボーナス部分を別色で積み上げ表示
 *  - warning: この値以上で赤字警告 (rawValue 比較)
 */
function ParamBar({label,value,max=100,effValue,bonusValue=0,color,warning,labelWidth=88,helpText,capValue}:{
  label:string; value:number; max?:number; effValue?:number; bonusValue?:number;
  color:string; warning?:number; labelWidth?:number; helpText?:string; capValue?:number;
}){
  const [showHelp, setShowHelp] = React.useState(false);
  const basePct  = Math.min(100, (value / max) * 100);
  const effPct   = effValue   !== undefined ? Math.min(100, (effValue   / max) * 100) : basePct;
  const bonusPct = bonusValue > 0 ? Math.min(100 - basePct, (bonusValue / max) * 100) : 0;
  const isWarn   = warning !== undefined && value >= warning;
  const bc       = isWarn ? '#e74c3c' : color;
  const hasOverlay = (effValue !== undefined && effValue !== value) || bonusValue > 0;
  const capPct   = capValue !== undefined ? Math.min(100, (capValue / max) * 100) : undefined;

  return(
    <View>
      <View style={styles.barRow}>
        <View style={{flexDirection:'row',alignItems:'center',width:labelWidth}}>
          <Text style={[styles.barLabel,{flex:1,width:undefined,fontSize:11}]}>{label}</Text>
          {helpText && (
            <TouchableOpacity
              style={{width:14,height:14,borderRadius:7,backgroundColor:'#C5BDB5',
                alignItems:'center',justifyContent:'center',marginRight:4}}
              onPress={()=>setShowHelp(v=>!v)}
            >
              <Text style={{fontSize:9,color:'#fff',fontWeight:'800',lineHeight:13}}>?</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.barBg,{flex:1,position:'relative'}]}>
          {/* ベース（薄め） */}
          <View style={[styles.barFill,{width:`${basePct}%` as any,backgroundColor:bc,
            opacity: hasOverlay ? 0.35 : 1}]}/>
          {/* 実効値オーバーレイ（arousal buff） */}
          {effValue !== undefined && effValue !== value && (
            <View style={[styles.barFill,{position:'absolute',left:0,top:0,bottom:0,
              width:`${effPct}%` as any,backgroundColor:bc}]}/>
          )}
          {/* 装備ボーナス（積み上げ） */}
          {bonusValue > 0 && (
            <View style={[styles.barFill,{position:'absolute',left:`${basePct}%` as any,
              top:0,bottom:0,width:`${bonusPct}%` as any,backgroundColor:bc,opacity:0.8}]}/>
          )}
          {/* capValue: 上限ロック帯 + マーカー */}
          {capPct !== undefined && (
            <>
              <View style={{position:'absolute',left:`${capPct}%` as any,top:0,bottom:0,right:0,backgroundColor:'rgba(0,0,0,0.18)'}}/>
              <View style={{position:'absolute',left:`${capPct}%` as any,top:0,bottom:0,width:2,backgroundColor:'#fff',opacity:0.8}}/>
            </>
          )}
        </View>
        <Text style={[styles.barValue,{width:56,fontSize:11},
          isWarn && {color:'#e74c3c',fontWeight:'700'}]}>
          {capValue !== undefined
            ? `${Math.round(value)}/${capValue}`
            : Math.round(value)}
          {bonusValue > 0 && <Text style={{fontSize:9,color:bc}}> +{bonusValue}</Text>}
          {effValue !== undefined && effValue !== value &&
            <Text style={{fontSize:9,color:'#e67e22'}}> ({Math.round(effValue)})</Text>}
        </Text>
      </View>
      {showHelp && helpText && (
        <View style={{
          backgroundColor:'#f8f9fa',borderRadius:8,padding:8,
          marginBottom:4,marginLeft:labelWidth,
          borderLeftWidth:2,borderLeftColor:color,
        }}>
          <Text style={{fontSize:11,color:'#8C7B6E',lineHeight:16}}>{helpText}</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: AnalogClock
// ─────────────────────────────────────────────

const CLOCK_SIZE = 58;
const CLOCK_R    = CLOCK_SIZE / 2;
const HOUR_LEN   = 14;
const MIN_LEN    = 20;

/** アナログ時計（針 + 中心ドット） */
function AnalogClock({ dayTimeMin }: { dayTimeMin: number }) {
  const h = Math.floor(dayTimeMin / 60) % 24;
  const m = dayTimeMin % 60;
  const hourDeg = (h % 12) * 30 + m * 0.5;
  const minDeg  = m * 6;

  /** 時計針スタイル（RN では transformOrigin 未サポートのため translateY トリック） */
  const handStyle = (len: number, deg: number, width: number, color: string) => ({
    position: 'absolute' as const,
    width,
    height: len,
    backgroundColor: color,
    borderRadius: width / 2,
    top:  CLOCK_R - len,        // 針の下端 = 時計中心
    left: CLOCK_R - width / 2,
    transform: [
      { translateY:  len / 2 }, // 回転軸を針の下端（時計中心）へ移動
      { rotate: `${deg}deg` },
      { translateY: -len / 2 }, // 元の位置に戻す
    ],
  });

  return (
    <View style={{ width:CLOCK_SIZE, height:CLOCK_SIZE, borderRadius:CLOCK_R,
      backgroundColor:'rgba(255,255,255,0.22)', borderWidth:2,
      borderColor:'rgba(255,255,255,0.6)', overflow:'hidden' }}>
      {/* 時針 */}
      <View style={handStyle(HOUR_LEN, hourDeg, 4, '#4A3F35')}/>
      {/* 分針 */}
      <View style={handStyle(MIN_LEN,  minDeg,  2.5, '#4A3F35')}/>
      {/* 中心ドット */}
      <View style={{ position:'absolute', width:7, height:7, borderRadius:3.5,
        backgroundColor:'#e74c3c', top:CLOCK_R-3.5, left:CLOCK_R-3.5, zIndex:10 }}/>
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: ArousalBar（興奮度ゾーン表示）
// ─────────────────────────────────────────────

function ArousalBar({ value }: { value: number }) {
  const [showHelp, setShowHelp] = React.useState(false);
  const pct = clamp(value);
  const zone =
    pct >= AROUSAL_RED_THRESHOLD ? 'danger' :
    (pct >= AROUSAL_GREEN_MIN && pct <= AROUSAL_GREEN_MAX) ? 'optimal' :
    pct > AROUSAL_GREEN_MAX ? 'high' : 'low';
  const zoneColor =
    zone === 'danger'  ? '#e74c3c' :
    zone === 'optimal' ? '#8DAA91' :
    zone === 'high'    ? '#D4974E' : '#B8AFA6';
  const helpText = '① 影響: 40-70がOptimalゾーン（フィジカル×1.1バフ）。80以上のDangerゾーンでは規律の実効値-20%。\n② 上げ方: 声かけ・ボール投げで上昇。散歩・マッサージで穏やかに下降。常に50へ自然収束。';
  return (
    <View>
      <View style={styles.barRow}>
        <View style={{flexDirection:'row',alignItems:'center',width:88}}>
          <Text style={[styles.barLabel,{flex:1,width:undefined,fontSize:11}]}>🧠 脳の活動</Text>
          <TouchableOpacity
            style={{width:14,height:14,borderRadius:7,backgroundColor:'#C5BDB5',
              alignItems:'center',justifyContent:'center',marginRight:4}}
            onPress={()=>setShowHelp(v=>!v)}
          >
            <Text style={{fontSize:9,color:'#fff',fontWeight:'800',lineHeight:13}}>?</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.barBg,{flex:1,position:'relative'}]}>
          <View style={[styles.barFill,{width:`${pct}%` as any,backgroundColor:zoneColor}]}/>
          {/* boundary markers */}
          <View style={{position:'absolute',left:`${AROUSAL_GREEN_MIN}%` as any,top:0,bottom:0,width:1.5,backgroundColor:'#8DAA91',opacity:0.7}}/>
          <View style={{position:'absolute',left:`${AROUSAL_GREEN_MAX}%` as any,top:0,bottom:0,width:1.5,backgroundColor:'#8DAA91',opacity:0.7}}/>
          <View style={{position:'absolute',left:`${AROUSAL_RED_THRESHOLD}%` as any,top:0,bottom:0,width:2,backgroundColor:'#e74c3c',opacity:0.9}}/>
        </View>
        <Text style={[styles.barValue,{width:30,fontSize:11,color:zoneColor,fontWeight:'700'}]}>{Math.round(pct)}</Text>
      </View>
      {showHelp && (
        <View style={{backgroundColor:'#f8f9fa',borderRadius:8,padding:8,marginBottom:4,marginLeft:88,borderLeftWidth:2,borderLeftColor:zoneColor}}>
          <Text style={{fontSize:11,color:'#8C7B6E',lineHeight:16}}>{helpText}</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: StressGauge
// ─────────────────────────────────────────────

function StressGauge({dog}:{dog:DogState}){
  const [showHelp, setShowHelp] = React.useState(false);
  const pct=clamp(dog.stress);
  const bc=pct>=STRESS_DESTROY_THRESHOLD?'#7b0000':
           pct>=STRESS_BARK_THRESHOLD?'#e74c3c':
           pct>=50?'#e67e22':'#C9A96E';
  const hints=getStressHints(dog);
  const helpText = `① 影響: ${STRESS_BARK_THRESHOLD}以上→無駄吠え、${STRESS_DESTROY_THRESHOLD}以上→破壊行動が発生。愛着度が高いほど割引効果（最大-50%）。\n② 下げ方: 空腹・汚れ・排泄欲求を解消すると低下。ごはん・ブラッシング・トイレ誘導が有効。`;
  return(
    <View>
      <View style={styles.barRow}>
        <View style={{flexDirection:'row',alignItems:'center',width:88}}>
          <Text style={[styles.barLabel,{flex:1,width:undefined,fontSize:11,fontWeight:'700',color:'#4A3F35'}]}>😤 ストレス</Text>
          <TouchableOpacity
            style={{width:14,height:14,borderRadius:7,backgroundColor:'#C5BDB5',
              alignItems:'center',justifyContent:'center',marginRight:4}}
            onPress={()=>setShowHelp(v=>!v)}
          >
            <Text style={{fontSize:9,color:'#fff',fontWeight:'800',lineHeight:13}}>?</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.barBg,{flex:1,height:18}]}>
          <View style={[styles.barFill,{width:`${pct}%` as any,backgroundColor:bc}]}/>
        </View>
        <Text style={[styles.barValue,{color:'#4A3F35',fontWeight:'700'}]}>{Math.round(pct)}</Text>
      </View>
      {showHelp && (
        <View style={{backgroundColor:'#f8f9fa',borderRadius:8,padding:8,marginBottom:4,marginLeft:88,borderLeftWidth:2,borderLeftColor:bc}}>
          <Text style={{fontSize:11,color:'#8C7B6E',lineHeight:16}}>{helpText}</Text>
          {hints.length>0 && <Text style={{fontSize:11,color:'#e74c3c',marginTop:4}}>現在の原因: {hints.join('  ')}</Text>}
        </View>
      )}
      {pct>=STRESS_DESTROY_THRESHOLD&&(
        <Text style={[styles.stressWarning,{backgroundColor:'#7b0000'}]}>
          💥 臨界値超過 — 破壊行動が発生しています
        </Text>
      )}
      {pct>=STRESS_BARK_THRESHOLD&&pct<STRESS_DESTROY_THRESHOLD&&(
        <Text style={[styles.stressWarning,{backgroundColor:'#c0392b'}]}>
          ⚠️ 高ストレス — 無駄吠えが続いています
        </Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: PersonalityPanel
// ─────────────────────────────────────────────

const BIG5_HELP: Record<string, string> = {
  '開放性 O': '① 影響: 好奇心・探索意欲。散歩での新発見や新NPCとの出会いやすさに影響（準備中）。\n② 上げ方: 遊び全般・散歩・探索系訓練で上昇傾向。',
  '誠実性 C': '① 影響: 0.6以上→訓練効果×1.5。0.4未満→×0.7。大会での集中力に影響。\n② 上げ方: 継続的なしつけ・訓練で高まる。プリセット「活発」は平均的。',
  '外向性 E': '① 影響: 0.7以上→親密度増加×1.5。0.5以上→×1.2。遊び・散歩でのNPCとの交流が活発になる。\n② 上げ方: 声かけ・遊び・NPCとの交流で高まる傾向。',
  '協調性 A': '① 影響: 高いほどしつけやすさ(trainability)が上がり、問題行動が減りやすくなる。\n② 上げ方: 優しい接し方・遊びで育まれる。',
  '神経症 N': '① 影響: 高いとストレスが蓄積しやすく、無駄吠え・破壊行動が発生しやすくなる。\n② 下げ方: 安定したケア・愛着度を高めることで影響を抑制できる。',
};

function PersonalityPanel({p}:{p:BigFive}){
  const [helpKey, setHelpKey] = React.useState<string|null>(null);
  const items:[string,number][]=[
    ['開放性 O',p.openness],['誠実性 C',p.conscientiousness],
    ['外向性 E',p.extraversion],['協調性 A',p.agreeableness],['神経症 N',p.neuroticism],
  ];
  return(
    <View>
      {items.map(([label,val])=>(
        <View key={label}>
          <View style={styles.barRow}>
            <View style={{flexDirection:'row',alignItems:'center',width:80}}>
              <Text style={[styles.barLabel,{flex:1,width:undefined,fontSize:11}]}>{label}</Text>
              <TouchableOpacity
                style={{width:14,height:14,borderRadius:7,backgroundColor:'#C5BDB5',
                  alignItems:'center',justifyContent:'center',marginRight:4}}
                onPress={()=>setHelpKey(helpKey===label?null:label)}
              >
                <Text style={{fontSize:9,color:'#fff',fontWeight:'800',lineHeight:13}}>?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill,{width:`${val*100}%` as any,backgroundColor:'#7D6E8A'}]}/>
            </View>
            <Text style={styles.barValue}>{(val*100).toFixed(0)}</Text>
          </View>
          {helpKey===label&&(
            <View style={{backgroundColor:'#f0ebf8',borderRadius:6,padding:6,marginBottom:4,marginLeft:84}}>
              <Text style={{fontSize:11,color:'#6c3483',lineHeight:16}}>{BIG5_HELP[label]}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: PresetBtn
// ─────────────────────────────────────────────

function PresetBtn({preset,current,onPress}:{preset:DogPreset;current:DogPreset;onPress:()=>void}){
  const sel=preset===current;
  const c:Record<DogPreset,string>={random:'#8C7B6E',active:'#e67e22',timid:'#7D6E8A'};
  return(
    <TouchableOpacity
      style={[styles.presetBtn,{borderColor:c[preset]},sel&&{backgroundColor:c[preset]}]}
      onPress={onPress}
    >
      <Text style={[styles.presetBtnText,sel&&{color:'#fff'}]}>{PRESETS[preset].label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: ReportPanel
// ─────────────────────────────────────────────

function ReportPanel({dog}:{dog:DogState}){
  const total=dog.statsActionCount;
  const barkR=total>0?(dog.statsBarkCount/total*100).toFixed(1):'0.0';
  const destR=total>0?(dog.statsDestroyCount/total*100).toFixed(1):'0.0';
  const badTotal=dog.statsBarkCount+dog.statsDestroyCount;
  const badR=total>0?(badTotal/total*100).toFixed(1):'0.0';
  const improvement=calcTrainReduction(30,dog.trainability);
  return(
    <View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>観察ティック数</Text>
        <Text style={styles.reportValue}>{total}</Text>
      </View>
      <View style={styles.reportDivider}/>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>無駄吠え発生率</Text>
        <Text style={[styles.reportValue,parseFloat(barkR)>10&&{color:'#e74c3c'}]}>{barkR}%</Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>破壊行動発生率</Text>
        <Text style={[styles.reportValue,parseFloat(destR)>5&&{color:'#e74c3c'}]}>{destR}%</Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={[styles.reportLabel,{fontWeight:'700'}]}>問題行動合計率</Text>
        <Text style={[styles.reportValue,{fontWeight:'700'}]}>{badR}%</Text>
      </View>
      <View style={styles.reportDivider}/>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>しつけやすさ</Text>
        <Text style={[styles.reportValue,{color:'#7D6E8A'}]}>{Math.round(dog.trainability)} / 100</Text>
      </View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>悪行動スコア削減率</Text>
        <Text style={[styles.reportValue,{color:'#8DAA91',fontWeight:'700'}]}>-{improvement}%（理論値）</Text>
      </View>
      <View style={styles.reportDivider}/>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>叱り成功 / 失敗</Text>
        <Text style={styles.reportValue}>✅{dog.statsScoldSuccess}　😨{dog.statsScoldFear}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// UI コンポーネント: SubMenuBtn
// ─────────────────────────────────────────────

function SubMenuBtn({emoji,title,sub,color,onPress,disabled}:{
  emoji:string;title:string;sub:string;color:string;onPress:()=>void;disabled?:boolean;
}){
  return(
    <TouchableOpacity
      style={[styles.subBtn,{backgroundColor:disabled?'#C5BDB5':color}]}
      onPress={disabled?undefined:onPress}
      disabled={disabled}
    >
      <Text style={styles.subBtnEmoji}>{emoji}</Text>
      <Text style={styles.subBtnTitle}>{title}</Text>
      <Text style={styles.subBtnSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// PC対応: スマホ縦比率コンテナ
// ─────────────────────────────────────────────

function PhoneContainer({children}: {children: React.ReactNode}) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{flex:1, backgroundColor:'#0a0a0a', alignItems:'center', justifyContent:'center'}}>
      <View style={{width:390, flex:1, overflow:'hidden' as any}}>
        {children}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// メイン App
// ─────────────────────────────────────────────

export default function App(){
  const [dog,setDog]                       = useState<DogState>(()=>createInitialDogState('random'));
  const [realMinPerDay,setRealMinPerDay]   = useState<number>(60);
  const [inputText,setInputText]           = useState<string>('60');
  const [running,setRunning]               = useState<boolean>(false);
  const [gameTimeText,setGameTimeText]     = useState<string>('00:00 (Day 1)');
  const [selectedPreset,setSelectedPreset] = useState<DogPreset>('random');
  const [showReport,setShowReport]         = useState<boolean>(false);
  const [openMenu,setOpenMenu]             = useState<'play'|'care'|'train'|null>(null);
  const [screen,setScreen]                 = useState<'prologue'|'title'|'nameEntry'|'main'|'closet'|'shop'|'walk'|'familyTree'|'puppySelect'|'settings'|'collection'|'contestSelect'|'contestPhysical'|'contestBeauty'|'contestNosework'|'contestResult'>('prologue');
  const [contestResultEntries,setContestResultEntries] = useState<ContestResultEntry[]>([]);
  const [contestBonusItem,setContestBonusItem]         = useState<{name:string;rarity:'epic'|'rare'|'legendary';category?:ItemCategory;bonuses?:ItemBonuses;flavorText?:string}|null>(null);
  // v8 追加
  const [saveSlots,setSaveSlots]           = useState<(SaveSlot|null)[]>([null,null,null]);
  // グローバル統計（トロフィー用）
  const [globalPlayCount, setGlobalPlayCount]     = useState<Partial<Record<string, number>>>({});
  const [globalCareCount, setGlobalCareCount]     = useState<Partial<Record<string, number>>>({});
  const [globalShopSpend, setGlobalShopSpend]     = useState(0);
  const [globalDailyShopSpend, setGlobalDailyShopSpend] = useState(0);
  const [globalItemsPickedUp, setGlobalItemsPickedUp] = useState(0);
  const [earnedTrophyIds, setEarnedTrophyIds]     = useState<string[]>([]);
  const [contestParticipation, setContestParticipation] = useState({ physical: 0, beauty: 0, nosework: 0 });
  const [contestPlacements, setContestPlacements] = useState({ physical: 0, beauty: 0, nosework: 0 });
  const [currentDogContestAllPlacements, setCurrentDogContestAllPlacements] = useState({ physical: false, beauty: false, nosework: false });
  const [collectionBackTarget, setCollectionBackTarget] = useState<'main'|'title'>('main');
  const [settings,setSettings]             = useState<GameSettings>({
    tournamentEnabled: true, trainingTournamentEnabled: true, realMinPerDay: 60, volume: 80,
    bgmEnabled: true, bgmVolume: 80, sfxEnabled: true, sfxVolume: 80,
    physicalContestEnabled: true, beautyContestEnabled: true, noseworkContestEnabled: true,
  });
  const [isFirstLaunch,setIsFirstLaunch]   = useState<boolean>(true);
  const [showDestPicker, setShowDestPicker] = React.useState(false);
  const [isDateWalk, setIsDateWalk] = React.useState(false);
  const [debugContestMode, setDebugContestMode] = React.useState(false);
  const [contestMiniScore, setContestMiniScore] = React.useState(0);
  const [isNightAnimating, setIsNightAnimating] = React.useState(false);
  const nightAnimRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [dogImageOverride, setDogImageOverride] = React.useState<'happy'|'excited'|null>(null);
  // ── 隠しHUD ステート（Rulesof Hooks: 必ず早期returnより前に宣言）
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [panelTooltip, setPanelTooltip] = React.useState<string|null>(null);
  const [deathPhase, setDeathPhase] = React.useState<null|1|2|'petted'|3|'succession'>(null);
  // ── 終焉アニメーション用
  const [deathStarStep, setDeathStarStep]           = React.useState(0);
  const [constellationVisible, setConstellationVisible] = React.useState(false);
  const [ghostBlurred, setGhostBlurred] = React.useState(false);
  const tailWagAnim      = React.useRef(new Animated.Value(0)).current;
  const starAnimVals     = React.useRef(Array.from({length:7},()=>new Animated.Value(0))).current;
  const constellationOpa = React.useRef(new Animated.Value(0)).current;
  const drawerAnim = React.useRef(new Animated.Value(0)).current;
  const [activeTab, setActiveTab] = React.useState<'care'|'play'|'other'|null>(null);
  const triggerDogAnim = React.useCallback((type: 'happy'|'excited' = 'happy') => {
    setDogImageOverride(type);
    setTimeout(() => setDogImageOverride(null), 1000);
  }, []);
  const toggleDrawer = React.useCallback(() => {
    setDrawerOpen(prev => {
      const next = !prev;
      Animated.timing(drawerAnim, {toValue:next?1:0,duration:260,useNativeDriver:true}).start();
      return next;
    });
  }, [drawerAnim]);
  const openTab = React.useCallback((tab: 'care'|'play'|'other'|null) => {
    setActiveTab(prev => prev === tab ? null : tab);
  }, []);

  // ── フローティングフィードバック
  const [feedbackMsg,setFeedbackMsg]     = useState<string>('');
  const [feedbackColor,setFeedbackColor] = useState<string>('#fff');
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const feedbackY    = useRef(new Animated.Value(0)).current;

  const showFeedback=useCallback((text:string,color='#fff', sfxType?: 'button'|'buff'|'debuff'|'coin')=>{
    setFeedbackMsg(text);setFeedbackColor(color);
    feedbackAnim.setValue(1);feedbackY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(feedbackAnim,{toValue:0,duration:600,useNativeDriver:false}),
      ]),
      Animated.timing(feedbackY,{toValue:-50,duration:1400,useNativeDriver:false}),
    ]).start(()=>setFeedbackMsg(''));
    // 死亡シーン中はSFXなし
    if (deathPhase !== null) return;
    const sfxVol = settings.sfxVolume;
    if (!settings.sfxEnabled) return;
    if (sfxType === 'buff')    SoundManager.playSfx(SND_SFX_BUFF,   sfxVol);
    else if (sfxType === 'debuff') SoundManager.playSfx(SND_SFX_DEBUFF, sfxVol);
    else if (sfxType === 'coin')   SoundManager.playSfx(SND_SFX_COIN,   sfxVol);
    else SoundManager.playSfx(SND_SFX_BUTTON, sfxVol);
  },[feedbackAnim,feedbackY,deathPhase,settings.sfxEnabled,settings.sfxVolume]);

  const formatGameTime=useCallback((totalMin:number)=>{
    const day=Math.floor(totalMin/GAME_MINUTES_PER_DAY)+1;
    const rem=totalMin%GAME_MINUTES_PER_DAY;
    return`${String(Math.floor(rem/60)).padStart(2,'0')}:${String(Math.floor(rem%60)).padStart(2,'0')} (Day ${day})`;
  },[]);

  // ── BGM 管理 ────────────────────────────────────────────────
  useEffect(() => {
    if (!settings.bgmEnabled) { SoundManager.stopBgm(); return; }
    const vol = settings.bgmVolume;
    // 死亡シーンのBGMを優先
    if (deathPhase !== null) {
      if (deathPhase === 2 || deathPhase === 'petted') {
        SoundManager.playBgm(SND_BGM_DEATH1, vol);
      } else if (deathPhase === 3 || deathPhase === 'succession') {
        SoundManager.playBgm(SND_BGM_DEATH2, vol);
      } else {
        // deathPhase === 1 (前哨シーン) → BGM0
        SoundManager.playBgm(SND_BGM_DEATH1, vol);
      }
      return;
    }
    switch (screen) {
      case 'title': case 'prologue': case 'nameEntry':
      case 'settings': case 'collection': case 'familyTree': case 'puppySelect':
        SoundManager.playBgm(SND_BGM_TOP, vol); break;
      case 'main': case 'closet': case 'shop': {
        const stage = getLifecycleStage(dog.totalGameMin);
        if (stage === 'puppy') SoundManager.playBgm(SND_BGM_PUPPY, vol);
        else if (stage === 'senior') SoundManager.playBgm(SND_BGM_SENIOR, vol);
        else SoundManager.playBgm(SND_BGM_ADULT, vol);
        break;
      }
      case 'walk':
        SoundManager.playBgm(SND_BGM_WALK, vol); break;
      case 'contestSelect':
        SoundManager.playBgm(SND_BGM_CONTEST_TOP, vol); break;
      case 'contestPhysical':
        SoundManager.playBgm(SND_BGM_PHYSICAL, vol); break;
      case 'contestBeauty':
        SoundManager.playBgm(SND_BGM_BEAUTY, vol); break;
      case 'contestNosework':
        SoundManager.playBgm(SND_BGM_NOSEWORK, vol); break;
      case 'contestResult':
        SoundManager.playBgm(SND_BGM_RESULT, vol); break;
      default:
        SoundManager.playBgm(SND_BGM_TOP, vol); break;
    }
  }, [screen, dog.totalGameMin, deathPhase, settings.bgmEnabled, settings.bgmVolume]);

  // BGM音量のリアルタイム更新
  useEffect(() => {
    SoundManager.setBgmVolume(settings.bgmVolume);
  }, [settings.bgmVolume]);

  // SFX設定グローバル参照を同期
  useEffect(() => {
    _sfxSettings = { enabled: settings.sfxEnabled, volume: settings.sfxVolume };
  }, [settings.sfxEnabled, settings.sfxVolume]);

  // ── グローバル統計の保存 & トロフィーチェック
  const saveGlobalStatsAndCheckTrophies = useCallback((
    dog: DogState,
    playCount: Partial<Record<string,number>>,
    careCount: Partial<Record<string,number>>,
    shopSpend: number,
    dailyShopSpend: number,
    itemsPickedUp: number,
    currentEarnedIds: string[],
    cpParticipation: { physical:number; beauty:number; nosework:number },
    cpPlacements: { physical:number; beauty:number; nosework:number },
    cdcAllPlacements: { physical:boolean; beauty:boolean; nosework:boolean },
  ) => {
    const globalStats: GlobalStats = {
      earnedTrophyIds: currentEarnedIds,
      playCount,
      careCount,
      totalShopSpend: shopSpend,
      dailyShopSpend,
      contestParticipation: cpParticipation,
      contestPlacements: cpPlacements,
      itemsPickedUp,
      totalDogs: dog.generation ?? 1,
      currentDogContestAllPlacements: cdcAllPlacements,
      currentDogContestMinAppearances: {
        physical: cpParticipation.physical,
        beauty: cpParticipation.beauty,
        nosework: cpParticipation.nosework,
      },
    };
    // チェック & 新規取得
    const newlyEarned: string[] = [];
    for(const t of TROPHY_LIST){
      if(!currentEarnedIds.includes(t.id)){
        try {
          if(t.check(dog, globalStats)) newlyEarned.push(t.id);
        } catch(_) {}
      }
    }
    const nextEarnedIds = newlyEarned.length > 0 ? [...currentEarnedIds, ...newlyEarned] : currentEarnedIds;
    if(newlyEarned.length > 0){
      setEarnedTrophyIds(nextEarnedIds);
      globalStats.earnedTrophyIds = nextEarnedIds;
      // 「ワンダフル・ライフ」も再チェック（earnedIds更新後）
      if(!nextEarnedIds.includes('special_50trophies') && nextEarnedIds.length >= 50){
        nextEarnedIds.push('special_50trophies');
        setEarnedTrophyIds([...nextEarnedIds]);
      }
    }
    try {
      localStorage.setItem('dogGlobalStats', JSON.stringify({
        playCount, careCount, shopSpend, dailyShopSpend, itemsPickedUp,
        earnedTrophyIds: nextEarnedIds,
        contestParticipation: cpParticipation,
        contestPlacements: cpPlacements,
        currentDogContestAllPlacements: cdcAllPlacements,
      }));
    } catch(_) {}
  }, []);

  // ── 起動時 localStorage からセーブロード & 設定復元
  useEffect(()=>{
    const slots:(SaveSlot|null)[]=[null,null,null];
    let hasSave = false;
    for(let i=0;i<3;i++){
      try{const raw=localStorage.getItem(`dogSave_${i}`);if(raw){slots[i]=JSON.parse(raw) as SaveSlot;hasSave=true;}}catch(_){}
    }
    setSaveSlots(slots);
    setIsFirstLaunch(!hasSave);
    try{
      const rawSettings=localStorage.getItem('dogSettings');
      if(rawSettings){
        const saved=JSON.parse(rawSettings) as Partial<GameSettings>;
        setSettings(prev=>({...prev,...saved}));
        if(saved.realMinPerDay){setRealMinPerDay(saved.realMinPerDay);setInputText(String(saved.realMinPerDay));}
      }
    }catch(_){}
    try{const raw=localStorage.getItem('dogGlobalStats');if(raw){const g=JSON.parse(raw);
      if(g.playCount) setGlobalPlayCount(g.playCount);
      if(g.careCount) setGlobalCareCount(g.careCount);
      if(g.shopSpend != null) setGlobalShopSpend(g.shopSpend);
      if(g.dailyShopSpend != null) setGlobalDailyShopSpend(g.dailyShopSpend);
      if(g.itemsPickedUp != null) setGlobalItemsPickedUp(g.itemsPickedUp);
      if(g.earnedTrophyIds) setEarnedTrophyIds(g.earnedTrophyIds);
      if(g.contestParticipation) setContestParticipation(g.contestParticipation);
      if(g.contestPlacements) setContestPlacements(g.contestPlacements);
      if(g.currentDogContestAllPlacements) setCurrentDogContestAllPlacements(g.currentDogContestAllPlacements);
    }}catch(_){}
  },[]);

  useEffect(()=>{
    if(!running)return;
    const delta=(TICK_REAL_MS/60000/realMinPerDay)*GAME_MINUTES_PER_DAY;
    const timer=setInterval(()=>{
      setDog(prev=>{
        const next=tickDogState(prev,delta);
        setGameTimeText(formatGameTime(next.totalGameMin));
        return next;
      });
    },TICK_REAL_MS);
    return()=>clearInterval(timer);
  },[running,realMinPerDay,formatGameTime]);

  // ── 悟りスロット解放時のスキル抽選付与
  useEffect(() => {
    const slots  = dog.satoriSlotsUnlocked ?? 0;
    const bonuses = dog.satoriBonuses ?? [];
    if (slots <= bonuses.length) return;
    setDog(prev => {
      const newBonuses = [...(prev.satoriBonuses ?? [])];
      const targetSlots = prev.satoriSlotsUnlocked ?? 0;
      while (newBonuses.length < targetSlots) {
        const drawn = drawSatoriSkill(newBonuses, contestParticipation);
        if (!drawn) break;
        newBonuses.push(drawn);
      }
      if (newBonuses.length === (prev.satoriBonuses ?? []).length) return prev;
      // 福徳の悟り: 幸運+10（初回習得時に即時適用）
      let newAbilities = prev.abilities;
      if (newBonuses.includes('fukutoku') && !(prev.satoriBonuses ?? []).includes('fukutoku')) {
        newAbilities = { ...newAbilities, luck: Math.min(100, newAbilities.luck + 10) };
      }
      const newSkillIds = newBonuses.filter(id => !(prev.satoriBonuses ?? []).includes(id));
      const skillNames  = newSkillIds.map(id => SATORI_SKILLS.find(s => s.id === id)?.name ?? id).join('、');
      return {
        ...prev,
        satoriBonuses: newBonuses,
        abilities:     newAbilities,
        log: addLog(prev.log, `✨ 悟りの境地「${skillNames}」を開いた！`),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog.satoriSlotsUnlocked]);

  // アイテム取得数トラッキング（散歩中にインベントリが増えたとき）
  const prevInventoryLenRef = React.useRef(dog.inventory.length);
  useEffect(()=>{
    const cur = dog.inventory.length;
    const prev = prevInventoryLenRef.current;
    if(cur > prev) {
      const gained = cur - prev;
      setGlobalItemsPickedUp(prevCount => {
        const next = prevCount + gained;
        saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, globalCareCount, globalShopSpend, globalDailyShopSpend, next, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
        return next;
      });
    }
    prevInventoryLenRef.current = cur;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dog.inventory.length]);

  // v13: 終焉シーケンス検知
  useEffect(()=>{
    if(dog.pendingDeath && deathPhase === null && !dog.isRetired) {
      setRunning(false);
      setDeathPhase(1);
    }
  },[dog.pendingDeath, dog.isRetired, deathPhase]);

  // 終焉: しっぽアニメ（pettedフェーズ）
  useEffect(()=>{
    if(deathPhase === 'petted'){
      Animated.loop(
        Animated.sequence([
          Animated.timing(tailWagAnim,{toValue:1, duration:220, useNativeDriver:true}),
          Animated.timing(tailWagAnim,{toValue:-1,duration:220, useNativeDriver:true}),
          Animated.timing(tailWagAnim,{toValue:0, duration:220, useNativeDriver:true}),
        ])
      ).start();
      return ()=>{ tailWagAnim.stopAnimation(); tailWagAnim.setValue(0); };
    }
  },[deathPhase]);

  // 終焉: 星上昇アニメーション（フェーズ3）
  useEffect(()=>{
    if(deathPhase === 3){
      setDeathStarStep(0);
      setConstellationVisible(false);
      setGhostBlurred(false);
      constellationOpa.setValue(0);
      starAnimVals.forEach(v=>v.setValue(0));
      const skills = dog.satoriBonuses ?? [];
      const count  = Math.min(skills.length, 7);
      const timers: ReturnType<typeof setTimeout>[] = [];
      for(let i=0;i<count;i++){
        timers.push(setTimeout(()=>{
          Animated.timing(starAnimVals[i],{toValue:1,duration:600,useNativeDriver:true}).start();
          setDeathStarStep(i+1);
        }, i*900+400));
      }
      // 悟りスキルの有無にかかわらず、一定時間後に犬の幽霊画像フェードを開始
      timers.push(setTimeout(()=>setConstellationVisible(true), count*900+800));
      return ()=>timers.forEach(t=>clearTimeout(t));
    }
  },[deathPhase]);

  // 終焉: 犬の幽霊画像 — まず鮮明に表示、2秒後にぼかしながらフェードアウト
  useEffect(()=>{
    if(!constellationVisible) return;
    setGhostBlurred(false);
    constellationOpa.setValue(1.0);
    const timer = setTimeout(()=>{
      setGhostBlurred(true);
      Animated.timing(constellationOpa,{toValue:0,duration:2000,useNativeDriver:true}).start();
    }, 2000);
    return ()=>clearTimeout(timer);
  },[constellationVisible]);

  const applyRealMinInput=()=>{
    const v=parseFloat(inputText);
    if(!isNaN(v)&&v>=MIN_REAL_MINUTES)setRealMinPerDay(v);
    else setInputText(String(realMinPerDay));
  };
  const switchPreset=(p:DogPreset)=>{
    setSelectedPreset(p);setRunning(false);
    setDog(createInitialDogState(p));setGameTimeText('00:00 (Day 1)');setOpenMenu(null);
  };
  const reset=()=>{
    setRunning(false);setDog(createInitialDogState(selectedPreset));
    setGameTimeText('00:00 (Day 1)');setOpenMenu(null);
  };
  const toggleMenu=(m:'play'|'care'|'train')=>setOpenMenu(o=>o===m?null:m);

  // ─────────────────────────────
  // SE ヘルパー（子犬期 初回アクション判定）
  // ─────────────────────────────

  /** ケアアクションの初回SE計算。子犬期 & 未経験なら seGain=2、seLearned.care を更新 */
  const calcCareSeGain = (prev: DogState, key: string) => {
    const isPuppy  = getLifecycleStage(prev.totalGameMin) === 'puppy';
    const learned  = prev.seLearned ?? { care:[], play:[], areas:[], equippedSlots:0 };
    const isFirst  = isPuppy && !learned.care.includes(key);
    const seGain   = isFirst ? 2 : 0;
    const newSeLearned = isFirst
      ? { ...learned, care: [...learned.care, key] }
      : learned;
    return { seGain, newSeLearned };
  };

  /** 遊びアクションの初回SE計算。子犬期 & 未経験なら seGain=2、seLearned.play を更新 */
  const calcPlaySeGain = (prev: DogState, key: string) => {
    const isPuppy  = getLifecycleStage(prev.totalGameMin) === 'puppy';
    const learned  = prev.seLearned ?? { care:[], play:[], areas:[], equippedSlots:0 };
    const isFirst  = isPuppy && !learned.play.includes(key);
    const seGain   = isFirst ? 2 : 0;
    const newSeLearned = isFirst
      ? { ...learned, play: [...learned.play, key] }
      : learned;
    return { seGain, newSeLearned };
  };

  // ─────────────────────────────
  // 時間進行ヘルパー: dayTimeMin・totalGameMin・age を同期
  // ─────────────────────────────

  /** アクション時間を day + total に同時加算 */
  const advTime = (prev: DogState, deltaMin: number) => {
    return {
      dayTimeMin:   Math.min(NIGHT_START_MIN, prev.dayTimeMin + deltaMin),
      totalGameMin: prev.totalGameMin + deltaMin,
      age:          prev.age + deltaMin / GAME_MINUTES_PER_DAY,
    };
  };

  // ─────────────────────────────
  // ケアアクション
  // ─────────────────────────────

  const feed=()=>{
    triggerDogAnim('happy');
    setDog(prev=>{
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'feed');
      showFeedback(`🍖 空腹-45  愛着+1  (+${TIME_CARE}分)${seGain>0?' 🌱社会化+2':''}`,'#D4974E','buff');
      return{...prev,
        hunger:clamp(prev.hunger-45),
        attachment:clamp(prev.attachment+1),
        ...advTime(prev, TIME_CARE),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        log:addLog(prev.log,'ごはんをもらった！'),
      };
    });
  };

  const pat=()=>{
    triggerDogAnim('happy');
    setGlobalCareCount(prev => {
      const next = { ...prev, pet: (prev['pet'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, next, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev=>{
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'pat');
      showFeedback(`✋ 疲労-5  興奮度+5  愛着+1  (+${TIME_CARE}分)${seGain>0?' 🌱社会化+2':''}`,'#C96B8A');
      return{...prev,
        fatigue:  clamp(prev.fatigue - 5),
        arousal:  clamp(prev.arousal + 5),
        attachment: clamp(prev.attachment + 1),
        ...advTime(prev, TIME_CARE),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        log: addLog(prev.log,'撫でてもらって嬉しい♪'),
      };
    });
  };

  const toilet=()=>{
    setDog(prev=>{
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'toilet');
      showFeedback(`🚽 排泄-80  愛着+1  (+${TIME_CARE}分)${seGain>0?' 🌱社会化+2':''}`,'#8DAA91','buff');
      return{...prev,
        bladder:clamp(prev.bladder-80),
        attachment:clamp(prev.attachment+1),
        ...advTime(prev, TIME_CARE),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        log:addLog(prev.log,'トイレに連れて行ってもらった'),
      };
    });
  };

  const startWalkWithDest=(dest: WalkDestination)=>{
    setDog(prev=>{
      if(prev.walkingTicksLeft > 0) return prev; // 二重起動防止
      if(prev.abilities.physical.stamina < WALK_STAMINA_COST){
        showFeedback('⚠️ スタミナ不足で散歩できません！','#e74c3c');
        return prev;
      }
      // 目的地をセット
      const newStamina = clampAbility(prev.abilities.physical.stamina - WALK_STAMINA_COST);

      // 秘密の集い: 出発時に確定レアアイテム付与 + walkItemFired=true でミッドウォーク重複防止
      let secretItem: InventoryItem | null = null;
      let secretItemFired = false;
      if(dest === 'secret') {
        // 秘密の集い: Legendary:1% / Epic:50% / Rare:49%
        const secretPhase = getLifecycleStage(prev.totalGameMin);
        const secretPhasePool = WALK_ITEM_POOL.filter(i => !i.phases || i.phases[secretPhase] === true);
        const rSecret = Math.random();
        let secretPool = rSecret < 0.01
          ? secretPhasePool.filter(i => i.rarity === 'legendary')
          : rSecret < 0.51
          ? secretPhasePool.filter(i => i.rarity === 'epic')
          : secretPhasePool.filter(i => i.rarity === 'rare');
        if(secretPool.length === 0) secretPool = secretPhasePool.filter(i => i.rarity === 'rare');
        const tpl = secretPool[Math.floor(Math.random() * secretPool.length)];
        secretItem = {
          id: Date.now().toString(36) + 'secret',
          name: tpl.name, category: (tpl.category ?? 'accessory') as ItemCategory, rarity: tpl.rarity,
          bonuses: { ...tpl.bonuses }, flavorText: tpl.flavorText,
          source: 'event' as const, acquiredAt: prev.totalGameMin,
        };
        secretItemFired = true;
      }

      const newInv = secretItem ? [...prev.inventory, secretItem].slice(-50) : prev.inventory;
      const secretEvt = secretItem
        ? `✨ 秘密の集い出発！「${secretItem.name}」[${secretItem.rarity.toUpperCase()}]を入手した！`
        : undefined;
      const newWalkLog = secretEvt ? [secretEvt] : [];

      // 子犬期: 新規エリア到達 SE+2（初回のみ）
      const isPuppyWalk = getLifecycleStage(prev.totalGameMin) === 'puppy';
      const knownAreas  = prev.seLearned?.areas ?? [];
      const isNewArea   = isPuppyWalk && !knownAreas.includes(dest);
      const newAreas    = isNewArea ? [...knownAreas, dest] : knownAreas;
      const areaSeGain  = isNewArea ? 2 : 0;
      const newSocialExpWalk = Math.min(100, (prev.socialExp ?? 0) + areaSeGain);
      return{...prev,
        bladder: clamp(prev.bladder - 30),
        fatigue: clamp(prev.fatigue + 15),
        arousal: clamp(prev.arousal + 10),
        attachment: clamp(prev.attachment + 2),
        walkingTicksLeft: WALK_DIRT_TICKS,
        ...advTime(prev, TIME_WALK),
        walkEventLog: newWalkLog,
        walkPoopFired: false,
        walkItemFired: secretItemFired,
        walkStrollEventFired:   false,
        walkStrollEventMsg:     '',
        walkStrollEventPending: false,
        walkStrollEventStats:   '',
        walkDestination: dest,
        inventory: newInv,
        socialExp:  newSocialExpWalk,
        seLearned:  { ...(prev.seLearned ?? { care:[], play:[], areas:[], equippedSlots:0 }), areas: newAreas },
        abilities: {
          ...prev.abilities,
          physical: { ...prev.abilities.physical, stamina: newStamina },
        },
        log: addLog(prev.log,
          isNewArea
            ? `🐾 初めての${DEST_DEFS[dest].label}！社会化+2  スタミナ-${WALK_STAMINA_COST}`
            : secretEvt ?? `🐾 お散歩に出発！（スタミナ-${WALK_STAMINA_COST} 時間+${TIME_WALK}分）帰宅時に報酬あり`
        ),
      };
    });
    setScreen('walk');
    showFeedback(`🐾 散歩開始！ 愛着+2  時間+${TIME_WALK}分`, '#7A9E9F', 'button');
  };

  const walk=()=>{
    if(dog.walkingTicksLeft > 0) return;
    if(dog.abilities.physical.stamina < WALK_STAMINA_COST){
      showFeedback('⚠️ スタミナ不足で散歩できません！','#e74c3c');
      return;
    }
    setShowDestPicker(true);
  };

  const wakeUp=()=>{
    setDog(prev=>({...prev,isSleeping:false,sleepPhase:'awake',log:addLog(prev.log,'起こされた')}));
    showFeedback('🌅 起こした','#8C7B6E');
  };

  // ─────────────────────────────
  // コミュニケーション
  // ─────────────────────────────

  const speak=()=>setDog(prev=>{
    // 眠気≥80 で覚醒上昇 70% カット
    const sleepy=prev.sleepiness>=80;
    const ag=sleepy?Math.round(25*0.3):25;
    showFeedback(sleepy?`📢 覚醒+${ag}（眠気で抑制）`:`📢 覚醒+${ag}  愛着+4`,sleepy?'#B8AFA6':'#7A9E9F');
    return{...prev,arousal:clamp(prev.arousal+ag),attachment:clamp(prev.attachment+0.5),
      log:addLog(prev.log,sleepy?`眠くて反応が鈍い（覚醒+${ag}）`:'名前を呼ばれてこちらを向いた！')};
  });

  const brush=()=>{
    triggerDogAnim('happy');
    setGlobalCareCount(prev => {
      const next = { ...prev, brushing: (prev['brushing'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, next, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev=>{
      const newCoat = Math.min(100, prev.abilities.beauty.coat + Math.round(5 * satoriAbilityMult(prev.satoriBonuses ?? [], 'coat', true)));
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'brush');
      showFeedback(`🪮 汚れ-20  毛並み+5  疲労-2  愛着+1  (+${TIME_CARE}分)${seGain>0?' 🌱社会化+2':''}`,'#6B9070','buff');
      return{...prev,
        dirtiness:  clamp(prev.dirtiness - 20),
        fatigue:    clamp(prev.fatigue   - 2),
        attachment: clamp(prev.attachment + 1),
        ...advTime(prev, TIME_CARE),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          beauty: { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log,`ブラッシングしてもらった。毛並み+5（毛並み${newCoat}）さっぱり♪`),
      };
    });
  };

  // ─────────────────────────────
  // マッサージ（ケアサブメニュー Step2 改定）
  // ─────────────────────────────

  const massage=()=>{
    triggerDogAnim('happy');
    setGlobalCareCount(prev => {
      const next = { ...prev, massage: (prev['massage'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, next, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev=>{
      // 疲労 80以上 → 疲労回復・スタミナ回復ともに半減
      const overTired = prev.fatigue >= 80;
      const fatReduce   = overTired ? 10 : 20;
      const staminaGain = overTired ? 100 : 200;  // スタミナ 回復量
      const maxSt = prev.maxStamina ?? 300;
      const newStam = Math.min(maxSt, prev.abilities.physical.stamina + staminaGain);
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'massage');
      showFeedback(
        `💆 疲労-${fatReduce}  スタミナ+${staminaGain}  興奮度-10  愛着+1${overTired?' (疲労過多で半減)':''}  (+${TIME_CARE * 2}分)${seGain>0?' 🌱社会化+2':''}`,
        '#7D6E8A'
      );
      return{...prev,
        fatigue:    clamp(prev.fatigue  - fatReduce),
        arousal:    clamp(prev.arousal  - 10),
        attachment: clamp(prev.attachment + 1),
        ...advTime(prev, TIME_CARE * 2),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          physical: {
            ...prev.abilities.physical,
            stamina: newStam,
          },
        },
        log: addLog(prev.log, `マッサージ！疲労-${fatReduce} スタミナ+${staminaGain}${overTired?' (疲労過多で半減)':''}`),
      };
    });
  };

  // ─────────────────────────────
  // お風呂（新コマンド v6 Step2）
  // ─────────────────────────────

  const bath=()=>{
    triggerDogAnim('happy');
    setGlobalCareCount(prev => {
      const next = { ...prev, bath: (prev['bath'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, next, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev=>{
      // お風呂: 汚れ-100, 毛並み+10, 疲労+5（入浴の疲れ）, 愛着+1
      const newCoat = Math.min(100, prev.abilities.beauty.coat + Math.round(10 * satoriAbilityMult(prev.satoriBonuses ?? [], 'coat', true)));
      const wasDebuff = prev.poopDebuff;
      const { seGain, newSeLearned } = calcCareSeGain(prev, 'bath');
      showFeedback(`🛁 汚れ-100  毛並み+10  愛着+1${wasDebuff?' ✨うんちデバフ解除':''}${seGain>0?' 🌱社会化+2':''}`, '#7A9E9F', 'buff');
      return{...prev,
        dirtiness:  clamp(prev.dirtiness  - 100),
        fatigue:    clamp(prev.fatigue    + 5),
        attachment: clamp(prev.attachment + 1),
        ...advTime(prev, TIME_CARE * 4), // お風呂は30分
        poopDebuff:          false,
        poopDebuffWalksLeft: 0,
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          beauty: { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log,
          `お風呂に入れてもらった！🛁 ピカピカ！毛並み${newCoat}${wasDebuff?' うんちデバフ解除！':''}`
        ),
      };
    });
  };

  // ─────────────────────────────
  // 遊び サブメニュー（v6 Step2）
  // ─────────────────────────────

  // ─── アクティビティ統合 (v11) ─── //

  /** 共通: アクティビティのスタミナコスト計算 */
  const calcActivityStaminaCost = () =>
    ACTIVITY_STAMINA_COST_BASE + Math.floor(Math.random() * ACTIVITY_STAMINA_COST_RAND);

  /** ひっぱりっこ: 規律+8, スピード+8, 興奮度+20, スタミナ-100〜150, 毛並み-3 */
  const activityRopePull = () => {
    triggerDogAnim('excited');
    setGlobalPlayCount(prev => {
      const next = { ...prev, ropePull: (prev['ropePull'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, next, globalCareCount, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev => {
      const cost = calcActivityStaminaCost();
      const successRate  = prev.abilities.intelligence * 0.00025;
      const isBigSuccess = Math.random() < successRate;
      const mult = isBigSuccess ? 1.5 : 1.0;
      const gain8base = Math.round(8 * mult);
      const _rpSb = prev.satoriBonuses ?? [];
      const gain8disc  = Math.max(1, Math.round(applyBreedGain(gain8base, prev.breed, 'discipline') * satoriAbilityMult(_rpSb, 'discipline', true)));
      const gain8speed = Math.max(1, Math.round(applyBreedGain(gain8base, prev.breed, 'speed')      * satoriAbilityMult(_rpSb, 'speed',      true)));
      const newDisc  = clampAbility(prev.abilities.physical.discipline + gain8disc);
      const newSpeed = clampAbility(prev.abilities.physical.speed + gain8speed);
      const newStam  = clampAbility(prev.abilities.physical.stamina - cost);
      const newCoat  = Math.max(0, prev.abilities.beauty.coat - Math.round(3 * satoriAbilityMult(_rpSb, 'coat', false)));
      const { seGain, newSeLearned } = calcPlaySeGain(prev, 'ropePull');
      const bigLabel = isBigSuccess ? ' ✨大成功！' : '';
      showFeedback(
        `🪢 規律+${gain8disc}  スピード+${gain8speed}  興奮度+20  スタミナ-${cost}  毛並み-3${seGain>0?' 🌱社会化+2':''}${bigLabel}`,
        isBigSuccess ? '#FFD700' : '#C07840'
      );
      return { ...prev,
        arousal:    clamp(prev.arousal + 20),
        fatigue:    clamp(prev.fatigue + 12),
        dirtiness:  clamp(prev.dirtiness + 12),
        ...advTime(prev, TIME_PLAY),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          physical: { ...prev.abilities.physical, discipline: newDisc, speed: newSpeed, stamina: newStam },
          beauty:   { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log, `ひっぱりっこ！規律+${gain8disc}(→${newDisc}) スピード+${gain8speed}(→${newSpeed}) 興奮度↑${isBigSuccess?' ✨大成功':''}`,),
      };
    });
  };

  /** フリスビー: バネ+10, 興奮度+25, スタミナ-100〜150, 毛並み-3, 稀にmaxStamina+1 */
  const activityFrisbee = () => {
    triggerDogAnim('excited');
    setGlobalPlayCount(prev => {
      const next = { ...prev, frisbee: (prev['frisbee'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, next, globalCareCount, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev => {
      const cost = calcActivityStaminaCost();
      const successRate  = prev.abilities.intelligence * 0.00025;
      const isBigSuccess = Math.random() < successRate;
      const mult = isBigSuccess ? 1.5 : 1.0;
      const gain10base = Math.round(10 * mult);
      const _fbSb = prev.satoriBonuses ?? [];
      const gain10spring = Math.max(1, Math.round(applyBreedGain(gain10base, prev.breed, 'spring') * satoriAbilityMult(_fbSb, 'spring', true)));
      const newSpring = clampAbility(prev.abilities.physical.spring + gain10spring);
      const newStam   = clampAbility(prev.abilities.physical.stamina - cost);
      const newCoat   = Math.max(0, prev.abilities.beauty.coat - Math.round(3 * satoriAbilityMult(_fbSb, 'coat', false)));
      const maxStBonus = Math.random() < 0.05;
      const newMaxSt   = maxStBonus ? (prev.maxStamina ?? 300) + 1 : (prev.maxStamina ?? 300);
      const { seGain, newSeLearned } = calcPlaySeGain(prev, 'frisbee');
      const bigLabel = isBigSuccess ? ' ✨大成功！' : '';
      showFeedback(
        `🥏 バネ+${gain10spring}  興奮度+25  スタミナ-${cost}  毛並み-3` +
        (maxStBonus ? '  ✨スタミナ上限+1！' : '') +
        (seGain>0?' 🌱社会化+2':'') + bigLabel,
        isBigSuccess ? '#FFD700' : '#e67e22'
      );
      return { ...prev,
        arousal:    clamp(prev.arousal + 25),
        fatigue:    clamp(prev.fatigue + 14),
        dirtiness:  clamp(prev.dirtiness + 15),
        maxStamina: newMaxSt,
        ...advTime(prev, TIME_PLAY),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          physical: { ...prev.abilities.physical, spring: newSpring, stamina: newStam },
          beauty:   { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log,
          `フリスビー！バネ+${gain10spring}(→${newSpring}) 興奮度↑${maxStBonus ? ' スタミナ上限UP！' : ''}${isBigSuccess?' ✨大成功':''}`
        ),
      };
    });
  };

  /** たからさがし: 知性+10, 集中力+8, 興奮度-10, スタミナ-100〜150, 毛並み-3 */
  const activityTreasureHunt = () => {
    triggerDogAnim('happy');
    setGlobalPlayCount(prev => {
      const next = { ...prev, treasureHunt: (prev['treasureHunt'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, next, globalCareCount, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev => {
      const cost = calcActivityStaminaCost();
      const successRate  = prev.abilities.intelligence * 0.00025;
      const isBigSuccess = Math.random() < successRate;
      const mult = isBigSuccess ? 1.5 : 1.0;
      const gain10base2 = Math.round(10 * mult);
      const gain8base2  = Math.round(8 * mult);
      const _thSb = prev.satoriBonuses ?? [];
      const gain10int   = Math.max(1, Math.round(applyBreedGain(gain10base2, prev.breed, 'intelligence') * satoriAbilityMult(_thSb, 'intelligence', true)));
      const gain8focus  = Math.max(1, Math.round(applyBreedGain(gain8base2,  prev.breed, 'focus')        * satoriAbilityMult(_thSb, 'focus',        true)));
      const newInt   = clampAbility(prev.abilities.intelligence + gain10int);
      const newFocus = clampAbility((prev.abilities.physical.focus ?? 0) + gain8focus);
      const newStam  = clampAbility(prev.abilities.physical.stamina - cost);
      const newCoat  = Math.max(0, prev.abilities.beauty.coat - Math.round(3 * satoriAbilityMult(_thSb, 'coat', false)));
      const { seGain, newSeLearned } = calcPlaySeGain(prev, 'treasureHunt');
      const bigLabel = isBigSuccess ? ' ✨大成功！' : '';
      showFeedback(
        `🔍 知性+${gain10int}  集中力+${gain8focus}  興奮度-10  スタミナ-${cost}  毛並み-3${seGain>0?' 🌱社会化+2':''}${bigLabel}`,
        isBigSuccess ? '#FFD700' : '#7D6E8A'
      );
      return { ...prev,
        arousal:    clamp(prev.arousal - 10),
        fatigue:    clamp(prev.fatigue + 10),
        dirtiness:  clamp(prev.dirtiness + 8),
        ...advTime(prev, TIME_PLAY),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          intelligence: newInt,
          physical: { ...prev.abilities.physical, focus: newFocus, stamina: newStam },
          beauty:   { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log, `たからさがし！知性+${gain10int}(→${newInt}) 集中力+${gain8focus}(→${newFocus})${isBigSuccess?' ✨大成功':''}`),
      };
    });
  };

  /** まて！ゲーム: 規律+10, 集中力+10, 興奮度-15, スタミナ-100〜150, 毛並み-3 */
  const activityWaitGame = () => {
    triggerDogAnim('happy');
    setGlobalPlayCount(prev => {
      const next = { ...prev, waitGame: (prev['waitGame'] ?? 0) + 1 };
      saveGlobalStatsAndCheckTrophies(dog, next, globalCareCount, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setDog(prev => {
      const cost = calcActivityStaminaCost();
      const successRate  = prev.abilities.intelligence * 0.00025;
      const isBigSuccess = Math.random() < successRate;
      const mult = isBigSuccess ? 1.5 : 1.0;
      const gain10d = Math.round(10 * mult);
      const gain10f = Math.round(10 * mult);
      const _wgSb = prev.satoriBonuses ?? [];
      const newDisc  = clampAbility(prev.abilities.physical.discipline + Math.round(gain10d * satoriAbilityMult(_wgSb, 'discipline', true)));
      const newFocus = clampAbility((prev.abilities.physical.focus ?? 0) + Math.round(gain10f * satoriAbilityMult(_wgSb, 'focus',      true)));
      const newStam  = clampAbility(prev.abilities.physical.stamina - cost);
      const newCoat  = Math.max(0, prev.abilities.beauty.coat - Math.round(3 * satoriAbilityMult(_wgSb, 'coat', false)));
      const { seGain, newSeLearned } = calcPlaySeGain(prev, 'waitGame');
      const bigLabel = isBigSuccess ? ' ✨大成功！' : '';
      showFeedback(
        `🤚 規律+${gain10d}  集中力+${gain10f}  興奮度-15  スタミナ-${cost}  毛並み-3${seGain>0?' 🌱社会化+2':''}${bigLabel}`,
        isBigSuccess ? '#FFD700' : '#8DAA91'
      );
      return { ...prev,
        arousal:    clamp(prev.arousal - 15),
        fatigue:    clamp(prev.fatigue + 8),
        dirtiness:  clamp(prev.dirtiness + 6),
        ...advTime(prev, TIME_PLAY),
        socialExp: Math.min(100, (prev.socialExp ?? 0) + seGain),
        seLearned: newSeLearned,
        abilities: {
          ...prev.abilities,
          physical: { ...prev.abilities.physical, discipline: newDisc, focus: newFocus, stamina: newStam },
          beauty:   { ...prev.abilities.beauty, coat: newCoat },
        },
        log: addLog(prev.log, `まて！ゲーム！規律+${gain10d}(→${newDisc}) 集中力+${gain10f}(→${newFocus}) 落ち着いた${isBigSuccess?' ✨大成功':''}`),
      };
    });
  };

  // (旧かくれんぼ代替 - 削除済み、上記アクティビティに統合)
  const playHideSeek_UNUSED = () => {}; // eslint-disable-line

  // (旧 playRopePull / playChasing / playTrick → activityRopePull / activityFrisbee に統合済み)

  // ─────────────────────────────
  // 旧トレーニング（v11でアクティビティに統合 - 互換性のため残存）
  // ─────────────────────────────

  /** @deprecated v11: activityWaitGame / activityTreasureHunt に統合 */
  const trainObedience=()=>setDog(prev=>{ // eslint-disable-line
    // 規律 ability + trainability（旧システム互換）も同時更新
    const arousalZoneNow = prev.arousal >= AROUSAL_RED_THRESHOLD;
    // 赤ゾーン時は成功率 -20% → 効果が0.8倍
    const arousalMult = arousalZoneNow ? (1 - AROUSAL_RED_PENALTY) : 1.0;
    // 誠実性補正: C≥0.6→×1.5, C≥0.4→×1.0, C<0.4→×0.7
    const consciMult = prev.personality.conscientiousness >= 0.6 ? 1.5
                     : prev.personality.conscientiousness >= 0.4 ? 1.0 : 0.7;
    const discGain  = Math.round(15 * arousalMult * consciMult);
    const trainGain = Math.round(5  * arousalMult * consciMult);
    const fatCost   = 10;
    const newDisc   = clampAbility(prev.abilities.physical.discipline + discGain);
    const reduction = calcTrainReduction(prev.trainability, clamp(prev.trainability + trainGain));
    showFeedback(
      `🎓 規律+${discGain}  疲労+${fatCost}  興奮度-5\n悪行動スコア -${reduction}%`
      + (arousalZoneNow ? ' ⚠️ 赤ゾーン↓' : '')
      + (consciMult > 1 ? ' 📐誠実性↑' : consciMult < 1 ? ' 📐誠実性↓' : ''),
      arousalZoneNow ? '#e67e22' : '#8DAA91'
    );
    return{...prev,
      trainability: clamp(prev.trainability + trainGain),
      fatigue:      clamp(prev.fatigue      + fatCost),
      arousal:      clamp(prev.arousal      - 5),
      attachment:   clamp(prev.attachment   + 3),
      ...advTime(prev, TIME_TRAIN),
      abilities: {
        ...prev.abilities,
        physical: { ...prev.abilities.physical, discipline: newDisc, stamina: clampAbility(prev.abilities.physical.stamina - 80) },
        beauty: { ...prev.abilities.beauty, coat: Math.max(0, prev.abilities.beauty.coat - WALK_COAT_PENALTY) },
      },
      log: addLog(prev.log,
        `【服従訓練】規律+${discGain}(→${newDisc}) 悪行動-${reduction}%`
        + (arousalZoneNow ? ' (赤ゾーンで効果減)' : '')
      ),
    };
  });

  // (旧 trainCallName / trainObstacle → v11でアクティビティに統合済み・削除)

  // ─────────────────────────────
  // おもちゃ サブメニュー（v5）
  // ─────────────────────────────

  const throwBall=()=>setDog(prev=>{
    const m=prev.presetName==='random'
      ?0.5+prev.personality.extraversion*prev.personality.openness*1.5
      :PRESETS[prev.presetName].toyFetchMult;
    const fg=Math.round(15*m),sd=Math.round(5*m);
    // 外向性微増（ボール遊びで社交性UP）
    const newE=Math.min(1,prev.personality.extraversion+0.002*m);
    showFeedback(`🎾 ×${m.toFixed(1)} 疲労+${fg}  覚醒+25  E微増`,'#C07840','button');
    return{...prev,
      fatigue:clamp(prev.fatigue+fg),
      arousal:clamp(prev.arousal+25),
      attachment:clamp(prev.attachment+Math.round(1*m)),
      bladder:clamp(prev.bladder+sd),  // 運動 → 排泄欲求微増
      personality:{...prev.personality,extraversion:newE},
      log:addLog(prev.log,`ボールで遊んだ！（×${m.toFixed(1)} 疲労+${fg}）`),
    };
  });

  const giveChew=()=>setDog(prev=>{
    const m=prev.presetName==='random'?1.0:prev.presetName==='timid'?1.5:0.5;
    const fr=Math.round(3*m);
    // 開放性微増（咀嚼で好奇心UP）
    const newO=Math.min(1,prev.personality.openness+0.001*m);
    showFeedback(`🦴 ×${m.toFixed(1)} 疲労-${fr}  覚醒-5  O微増`,'#795548','button');
    return{...prev,
      fatigue:clamp(prev.fatigue-fr),    // 咀嚼でリラックス
      arousal:clamp(prev.arousal-5),
      attachment:clamp(prev.attachment+Math.round(0.5*m)),
      personality:{...prev.personality,openness:newO},
      log:addLog(prev.log,`ガムを与えた（×${m.toFixed(1)} 疲労-${fr}）`),
    };
  });

  // ─────────────────────────────
  // 叱る
  // ─────────────────────────────

  const scold=()=>setDog(prev=>{
    const highTrust=prev.attachment>=50;
    if(highTrust){
      showFeedback('🗣️ 叱る → 鎮静！しつけ+3','#8DAA91');
      return{...prev,
        trainability:clamp(prev.trainability+3),
        attachment:clamp(prev.attachment-3),
        statsScoldSuccess:prev.statsScoldSuccess+1,
        log:addLog(prev.log,'叱られて行動を止めた。（信頼があるから伝わった）'),
      };
    }else{
      showFeedback('🗣️ 叱る → 恐怖！信頼が低い','#e74c3c');
      return{...prev,
        attachment:clamp(prev.attachment-10),
        fearfulTicksLeft:FEARFUL_TICKS,
        statsScoldFear:prev.statsScoldFear+1,
        log:addLog(prev.log,'叱られて怯えて震えている... (信頼度が低すぎた)'),
      };
    }
  });

  // ─────────────────────────────
  // 装備・解除ハンドラ（クローゼット）
  // ─────────────────────────────

  /** アイテムをスロットに装備する */
  const equipItem=(slot: EquipSlotKey, item: InventoryItem)=>{
    setDog(prev=>{
      const newEq: EquipmentSlots = { ...prev.equipment, [slot]: item };
      const newStyle = Math.min(100, calcStyleScore(newEq) + ((prev.satoriBonuses ?? []).includes('myousou') ? 10 : 0));
      const eqb = calcEquipmentBonuses(newEq);
      // 子犬期: 新規スロット埋没 SE+1（スロットが初めて埋まった場合かつ上限6まで）
      const isPuppy      = getLifecycleStage(prev.totalGameMin) === 'puppy';
      const wasEmpty     = prev.equipment[slot] === null;
      const learned      = prev.seLearned ?? { care:[], play:[], areas:[], equippedSlots:0 };
      const filledSoFar  = learned.equippedSlots ?? 0;
      const isNewSlot    = isPuppy && wasEmpty && filledSoFar < 6;
      const slotSeGain   = isNewSlot ? 1 : 0;
      const newSeLearned = isNewSlot
        ? { ...learned, equippedSlots: filledSoFar + 1 }
        : learned;
      showFeedback(
        `✅「${item.name}」を${SLOT_DEFS.find(s=>s.key===slot)?.label}に装備！\nスタイル: ${newStyle}  毛並み+${eqb.beauty_coat}  愛嬌+${eqb.beauty_charm}${isNewSlot?' 🌱社会化+1':''}`,
        '#C96B8A'
      );
      return{...prev, equipment: newEq, style: newStyle,
        socialExp: Math.min(100, (prev.socialExp ?? 0) + slotSeGain),
        seLearned: newSeLearned,
        log: addLog(prev.log, `【装備】「${item.name}」→ ${SLOT_DEFS.find(s=>s.key===slot)?.label}スロット  スタイル→${newStyle}`),
      };
    });
  };

  /** スロットのアイテムを解除する */
  const unequipItem=(slot: EquipSlotKey)=>{
    setDog(prev=>{
      const old = prev.equipment[slot];
      if(!old) return prev;
      const newEq: EquipmentSlots = { ...prev.equipment, [slot]: null };
      const newStyle = Math.min(100, calcStyleScore(newEq) + ((prev.satoriBonuses ?? []).includes('myousou') ? 10 : 0));
      showFeedback(`❌「${old.name}」を外した  スタイル: ${newStyle}`,'#8C7B6E');
      return{...prev, equipment: newEq, style: newStyle,
        log: addLog(prev.log, `【解除】「${old.name}」を外した  スタイル→${newStyle}`),
      };
    });
  };

  // ─────────────────────────────
  // 翌朝スキップ
  // ─────────────────────────────
  const skipToMorning = () => {
    if(isNightAnimating) return;
    const wasRunning = running;
    setRunning(false);
    setIsNightAnimating(true);

    // dayTimeMin を 22:00 (1320) から 翌 06:00 (360) まで 30 ステップでアニメーション
    const startMin = dog.dayTimeMin;
    // 終点: 翌日の 06:00 = 1440 + 360 = 1800 (modulo 1440 = 360)
    const endMin = 1440 + MORNING_SKIP_MIN;
    const totalSteps = 30;
    let step = 0;

    if(nightAnimRef.current) clearInterval(nightAnimRef.current);
    nightAnimRef.current = setInterval(() => {
      step++;
      const fraction = step / totalSteps;
      const rawMin = Math.round(startMin + (endMin - startMin) * fraction);
      const displayMin = rawMin % 1440;

      if(step < totalSteps) {
        // アニメーション中: 時刻だけ進める（犬は眠ったまま）
        setDog(prev => ({
          ...prev,
          dayTimeMin: displayMin,
          isSleeping: true,
          currentAction: 'sleeping' as const,
        }));
      } else {
        // アニメーション完了: 朝の効果を適用
        clearInterval(nightAnimRef.current!);
        nightAnimRef.current = null;
        const elapsed = (endMin - startMin);
        setDog(prev => ({
          ...prev,
          dayTimeMin:   MORNING_SKIP_MIN,
          totalGameMin: prev.totalGameMin + elapsed,
          age:          prev.age + elapsed / GAME_MINUTES_PER_DAY,
          isSleeping:   false,
          sleepPhase:   'awake' as const,
          hunger:       clamp(prev.hunger    + elapsed * 0.04),
          bladder:      clamp(prev.bladder   + elapsed * 0.03),
          fatigue:      clamp(prev.fatigue   - 35),
          sleepiness:   clamp(prev.sleepiness - 50),
          arousal:      clamp(prev.arousal   - 20),
          log: addLog(prev.log, `☀️ 翌朝6:00へスキップ（${Math.round(elapsed/60)}時間経過）`),
        }));
        setIsNightAnimating(false);
        if(wasRunning) setRunning(true);
        showFeedback('☀️ 翌朝になりました！', '#D4974E');
      }
    }, 80); // 80ms × 30ステップ = 約2.4秒のアニメーション
  };

  // ─────────────────────────────
  // ショップ: 購入・売却
  // ─────────────────────────────
  const buyItem = (item: ShopItem) => {
    if (settings.sfxEnabled) SoundManager.playSfx(SND_SFX_COIN, settings.sfxVolume);
    // ショップ支出トラッキング
    setGlobalShopSpend(prev => {
      const next = prev + item.cost;
      const nextDaily = globalDailyShopSpend + item.cost;
      saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, globalCareCount, next, nextDaily, globalItemsPickedUp, earnedTrophyIds, contestParticipation, contestPlacements, currentDogContestAllPlacements);
      return next;
    });
    setGlobalDailyShopSpend(prev => prev + item.cost);
    setDog(prev => {
      if(prev.coins < item.cost){
        showFeedback(`💰 コイン不足！（所持: ${prev.coins} / 必要: ${item.cost}）`, '#e74c3c', 'debuff');
        return prev;
      }
      const newCoins = prev.coins - item.cost;
      if(item.category === 'food'){
        // ── v12: 安楽死
        if (item.isEuthanasia) {
          showFeedback('😔 安らかに…', '#8C7B6E');
          return { ...prev, coins: newCoins, pendingDeath: true,
            log: addLog(prev.log, '😔 安楽死により、愛犬は安らかに旅立ちました…') };
        }
        // ── v12: 延命手術（生涯1度）
        if (item.isSurgery) {
          if (prev.surgeryUsed) {
            showFeedback('⚠️ 延命手術は生涯1度のみです', '#e74c3c');
            return prev;
          }
          const newLifespan = Math.min(1000, (prev.lifespan ?? 1000) + (item.lifespanBonus ?? 500));
          showFeedback('🏥 延命手術成功！寿命+500', '#8DAA91');
          return { ...prev, coins: newCoins, lifespan: newLifespan, surgeryUsed: true,
            log: addLog(prev.log, `🏥 延命手術実施！（-${item.cost}コイン）寿命+${item.lifespanBonus}`) };
        }
        const newHunger  = clamp(prev.hunger   - (item.hungerRestore ?? 0));
        const newFatigue = item.fatigueRestore ? clamp(prev.fatigue - item.fatigueRestore) : prev.fatigue;
        let newStamina = prev.abilities.physical.stamina;
        const maxSt = prev.maxStamina ?? 300;
        if(item.staminaRestorePercent) {
          const gain = Math.round(maxSt * item.staminaRestorePercent);
          newStamina = Math.min(maxSt, prev.abilities.physical.stamina + gain);
        } else if(item.staminaBonus) {
          newStamina = Math.min(maxSt, prev.abilities.physical.stamina + item.staminaBonus);
        }
        // v12: 寿命・認知能力回復
        const newLifespan2  = item.lifespanBonus  ? Math.min(1000, (prev.lifespan  ?? 1000) + item.lifespanBonus)  : (prev.lifespan  ?? 1000);
        const newCognition2 = item.cognitionBonus ? Math.min(1000, (prev.cognition ?? 500)  + item.cognitionBonus) : (prev.cognition ?? 500);
        showFeedback(`🍖「${item.name}」使用！ -${item.cost}コイン`, '#e67e22');
        return{...prev, coins:newCoins, hunger:newHunger, fatigue:newFatigue,
          lifespan: newLifespan2, cognition: newCognition2,
          abilities:{ ...prev.abilities, physical:{ ...prev.abilities.physical, stamina:newStamina } },
          log: addLog(prev.log, `🛒「${item.name}」購入・使用（-${item.cost}コイン）`)};
      }
      if(item.category === 'shampoo'){
        const newDirt = clamp(prev.dirtiness - (item.dirtRemove ?? 80));
        const newCoat = Math.min(100, prev.abilities.beauty.coat + (item.coatBonus ?? 0));
        showFeedback(`🛁「${item.name}」使用！ 毛並み+${item.coatBonus ?? 0}`, '#7A9E9F', 'buff');
        return{...prev, coins:newCoins, dirtiness:newDirt,
          abilities:{ ...prev.abilities, beauty:{ ...prev.abilities.beauty, coat:newCoat } },
          log: addLog(prev.log, `🛒「${item.name}」購入・使用（-${item.cost}コイン）汚れ-${item.dirtRemove}`)};
      }
      // equipment → inventory へ追加
      const newInvItem: InventoryItem = {
        id:         Date.now().toString(36) + Math.random().toString(36).slice(2,5),
        name:       item.name,
        category:   item.subCategory ?? 'accessory',
        rarity:     item.rarity,
        bonuses:    item.bonuses ?? {},
        flavorText: item.flavorText,
        source:     'shop',
        acquiredAt: prev.totalGameMin,
      };
      showFeedback(`🛍️「${item.name}」購入！クローゼットへ`, '#C96B8A', 'coin');
      return{...prev, coins:newCoins,
        inventory: [...prev.inventory, newInvItem].slice(-50),
        log: addLog(prev.log, `🛒「${item.name}」購入（-${item.cost}コイン）→クローゼットに追加`)};
    });
  };

  const sellItem = (item: InventoryItem) => {
    if (settings.sfxEnabled) SoundManager.playSfx(SND_SFX_COIN, settings.sfxVolume);
    const price = item.rarity === 'epic' ? 35 : item.rarity === 'rare' ? 18 : 8;
    setDog(prev => ({
      ...prev,
      coins: prev.coins + price,
      inventory: prev.inventory.filter(i => i.id !== item.id),
      equipment: Object.fromEntries(
        Object.entries(prev.equipment).map(([k,v]) => [k, (v as InventoryItem|null)?.id === item.id ? null : v])
      ) as EquipmentSlots,
      log: addLog(prev.log, `💰「${item.name}」売却（+${price}コイン）`),
    }));
    showFeedback(`💰「${item.name}」売却 +${price}コイン`, '#8DAA91', 'coin');
  };

  // ─────────────────────────────────────────────────────────────────────
  // ミートアップ ハンドラ（v9: NPC behavioral states + 5-choice meetup）
  // ─────────────────────────────────────────────────────────────────────

  // ── NPCの様子ラベル
  const NPC_STATE_LABELS: Record<NpcMeetupState, string> = {
    aggressive: '毛を逆立て、直視している（威嚇）🦷',
    playbow:    '前足を下げ、お尻を上げている（プレイボウ）🎉',
    explore:    'あちこちの匂いを嗅いでいる（探索）👃',
    anxious:    '耳を伏せ、体を低くしている（不安）😰',
  };

  // なだめる（目をそらす）
  const meetupSoothe = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      const { npc, npcState } = prev.walkMeetup;
      const isMatch = npcState === 'aggressive';
      let intimacyGain = isMatch ? 10 : 3;
      const updatedNpc: NpcDog = { ...npc, intimacy: Math.min(100, npc.intimacy + intimacyGain), metCount: npc.metCount + 1 };
      const knownDogs = prev.knownDogs.find(d => d.id === npc.id)
        ? prev.knownDogs.map(d => d.id === npc.id ? updatedNpc : d)
        : [...prev.knownDogs, updatedNpc];
      // 威嚇相手になだめる→ストレス大幅減
      const newStress = isMatch ? clamp(prev.stress - 15) : prev.stress;
      const rewardLog = isMatch
        ? `✅ 目をそらしてなだめた！ ストレス-15  親密度+${intimacyGain}`
        : `👀 目をそらした。親密度+${intimacyGain}`;
      const evt = `${isMatch ? '😌' : '👀'} ${npc.name}に対してなだめた。${rewardLog}`;
      return {
        ...prev, knownDogs, stress: newStress,
        walkMeetup: { ...prev.walkMeetup, npc: updatedNpc, phase: 'react', intimacyGain, rewardLog },
        walkEventLog: [...prev.walkEventLog, evt].slice(-20),
      };
    });
    showFeedback('👀 なだめた', '#8C7B6E');
  };

  // 一緒に遊ぶ
  const meetupPlayTogether = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      const { npc, npcState } = prev.walkMeetup;
      const isMatch = npcState === 'playbow';
      // 外向性補正
      const extraversionMult = prev.personality.extraversion >= 0.7 ? 1.5
                              : prev.personality.extraversion >= 0.5 ? 1.2 : 1.0;
      const oppositeGender = npc.gender !== prev.gender;
      const charmBonus = oppositeGender
        ? Math.round((prev.abilities.beauty.coat + prev.abilities.beauty.charm) / 10) : 0;
      const baseGain = isMatch ? 20 : 10;
      const intimacyGain = Math.round(baseGain * extraversionMult) + charmBonus;
      const updatedNpc: NpcDog = { ...npc, intimacy: Math.min(100, npc.intimacy + intimacyGain), metCount: npc.metCount + 1 };
      const knownDogs = prev.knownDogs.find(d => d.id === npc.id)
        ? prev.knownDogs.map(d => d.id === npc.id ? updatedNpc : d)
        : [...prev.knownDogs, updatedNpc];
      // プレイボウ一致時: アイテムコピー（NPCの装備から1つ）
      const equippedItems = Object.values(npc.equipment).filter((e): e is InventoryItem => e !== null);
      const giftItem: InventoryItem | null = isMatch && equippedItems.length > 0
        ? { ...equippedItems[Math.floor(Math.random() * equippedItems.length)], id: Date.now().toString(36) + 'g', source: 'event' as const, acquiredAt: prev.totalGameMin }
        : null;
      const newInv = giftItem ? [...prev.inventory, giftItem].slice(-50) : prev.inventory;
      const rewardLog = isMatch
        ? `✅ 完璧なタイミング！ 親密度+${intimacyGain}${giftItem?` 🎁「${giftItem.name}」を貰った`:''}${charmBonus>0?` 💕魅力+${charmBonus}`:''}`
        : `⚡ 一緒に遊んだ。親密度+${intimacyGain}${charmBonus>0?` 💕魅力+${charmBonus}`:''}`;
      const evt = `⚡ ${npc.name}と一緒に遊んだ！ ${rewardLog}`;
      return {
        ...prev, knownDogs, inventory: newInv,
        arousal: clamp(prev.arousal + 15), happiness: clamp(prev.happiness + 10),
        walkMeetup: { ...prev.walkMeetup, npc: updatedNpc, phase: 'react', giftItem, intimacyGain, rewardLog },
        walkEventLog: [...prev.walkEventLog, evt].slice(-20),
        log: addLog(prev.log, evt),
      };
    });
    showFeedback('⚡ 一緒に遊んだ！', '#D4974E');
  };

  // 嗅ぎ合う
  const meetupSniff = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      const { npc, npcState } = prev.walkMeetup;
      const isMatch = npcState === 'explore';
      const intimacyGain = isMatch ? 8 : 3;
      const newIntel = isMatch ? clampAbility(prev.abilities.intelligence + 5) : prev.abilities.intelligence;
      const updatedNpc: NpcDog = { ...npc, intimacy: Math.min(100, npc.intimacy + intimacyGain), metCount: npc.metCount + 1 };
      const knownDogs = prev.knownDogs.find(d => d.id === npc.id)
        ? prev.knownDogs.map(d => d.id === npc.id ? updatedNpc : d)
        : [...prev.knownDogs, updatedNpc];
      // 探索一致時: 知性+5 + 秘密の集いの情報獲得
      const newHasSecret = isMatch ? true : prev.hasSecretInfo;
      const rewardLog = isMatch
        ? `✅ 深く嗅ぎ合った！ 知性+5  秘密の集いの情報を入手！${newHasSecret?' 🗺️次の散歩で秘密の集いへ行ける！':''}`
        : `👃 嗅ぎ合った。親密度+${intimacyGain}`;
      const evt = `👃 ${npc.name}と嗅ぎ合った。${rewardLog}`;
      return {
        ...prev, knownDogs,
        hasSecretInfo: newHasSecret,
        abilities: { ...prev.abilities, intelligence: newIntel },
        walkMeetup: { ...prev.walkMeetup, npc: updatedNpc, phase: 'react', intimacyGain, rewardLog },
        walkEventLog: [...prev.walkEventLog, evt].slice(-20),
        log: addLog(prev.log, evt),
      };
    });
    showFeedback('👃 嗅ぎ合った！', '#7D6E8A');
  };

  // 優しく接する（セルフハンディキャップ）
  const meetupSelfHandicap = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      const { npc, npcState } = prev.walkMeetup;
      const isMatch = npcState === 'anxious';
      const intimacyGain = isMatch ? 12 : 4;
      const newDisc = isMatch ? clampAbility(prev.abilities.physical.discipline + 8) : prev.abilities.physical.discipline;
      const updatedNpc: NpcDog = { ...npc, intimacy: Math.min(100, npc.intimacy + intimacyGain), metCount: npc.metCount + 1 };
      const knownDogs = prev.knownDogs.find(d => d.id === npc.id)
        ? prev.knownDogs.map(d => d.id === npc.id ? updatedNpc : d)
        : [...prev.knownDogs, updatedNpc];
      // 不安一致時: 規律+8 + アイテムコピー
      const equippedItems = Object.values(npc.equipment).filter((e): e is InventoryItem => e !== null);
      const giftItem: InventoryItem | null = isMatch && equippedItems.length > 0
        ? { ...equippedItems[Math.floor(Math.random() * equippedItems.length)], id: Date.now().toString(36) + 'h', source: 'event' as const, acquiredAt: prev.totalGameMin }
        : null;
      const newInv = giftItem ? [...prev.inventory, giftItem].slice(-50) : prev.inventory;
      const rewardLog = isMatch
        ? `✅ 優しく接して安心させた！ 規律+8  親密度+${intimacyGain}${giftItem?` 🎁「${giftItem.name}」を貰った`:''}`
        : `🤗 優しく接した。親密度+${intimacyGain}`;
      const evt = `🤗 ${npc.name}に優しく接した。${rewardLog}`;
      return {
        ...prev, knownDogs, inventory: newInv,
        abilities: { ...prev.abilities, physical: { ...prev.abilities.physical, discipline: newDisc } },
        walkMeetup: { ...prev.walkMeetup, npc: updatedNpc, phase: 'react', giftItem, intimacyGain, rewardLog },
        walkEventLog: [...prev.walkEventLog, evt].slice(-20),
        log: addLog(prev.log, evt),
      };
    });
    showFeedback('🤗 優しく接した', '#8DAA91');
  };

  // 横を通り過ぎる
  const meetupPassBy = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      return { ...prev, walkMeetup: { ...prev.walkMeetup, phase: 'done' } };
    });
  };

  // farewell: またね
  const meetupAgain = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      const { npc } = prev.walkMeetup;
      // 番登録（成犬期のみ）
      const currentStageForMate = getLifecycleStage(prev.totalGameMin);
      if(npc.intimacy >= MATE_INTIMACY_THRESHOLD && npc.gender !== prev.gender && !prev.mate && currentStageForMate === 'adult'){
        const mate: FamilyMember = {
          id: npc.id, name: npc.name, gender: npc.gender, generation: 1,
          abilities: npc.abilities, tournamentWins: 0, preset: 'random',
          breed: npc.breed,
        };
        const evt = `💞 ${npc.name}と番になった！`;
        return {
          ...prev, mate,
          walkMeetup: { ...prev.walkMeetup, phase: 'done' },
          walkEventLog: [...prev.walkEventLog, evt].slice(-20),
          log: addLog(prev.log, `💞 ${npc.name}と番になった！ 家系図から繁殖できます`),
        };
      }
      // 成犬期以外のとき（条件は満たしているが期を外れている場合）はログのみ
      if(npc.intimacy >= MATE_INTIMACY_THRESHOLD && npc.gender !== prev.gender && !prev.mate && currentStageForMate !== 'adult'){
        const evt2 = `💕 ${npc.name}との絆が深まった。成犬になれば番になれるかも…`;
        return {
          ...prev,
          walkMeetup: { ...prev.walkMeetup, phase: 'done' },
          walkEventLog: [...prev.walkEventLog, evt2].slice(-20),
          log: addLog(prev.log, evt2),
        };
      }
      const updatedNpcAgain: NpcDog = {
        ...npc, reencounterBonus: Math.min(80, (npc.reencounterBonus ?? 0) + 5)
      };
      const knownDogsAgain = prev.knownDogs.find(d => d.id === npc.id)
        ? prev.knownDogs.map(d => d.id === npc.id ? updatedNpcAgain : d)
        : [...prev.knownDogs, updatedNpcAgain];
      showFeedback('👋 またね！ 再会率+5%', '#8DAA91');
      return { ...prev, knownDogs: knownDogsAgain, walkMeetup: { ...prev.walkMeetup, phase: 'done' } };
    });
  };

  // farewell: バイバイ
  const meetupBye = () => {
    setDog(prev => {
      if(!prev.walkMeetup) return prev;
      return { ...prev, walkMeetup: { ...prev.walkMeetup, phase: 'done' } };
    });
  };

  // ── 散歩を続ける → 目的地選択画面に戻る
  const continueWalk = () => {
    setScreen('main');
    setShowDestPicker(true);
  };

  // ─────────────────────────────────────────────────────────────────────
  // 繁殖・世代交代（v8）
  // ─────────────────────────────────────────────────────────────────────

  const breedWithMate = () => {
    if(!dog.mate) return;
    const mateDog = {
      abilities:      dog.mate.abilities,
      peakAbilities:  dog.mate.abilities, // 番の peak は現在能力で代用
      tournamentWins: dog.mate.tournamentWins,
      cognition:      500, // 番の認知は中央値
    };
    const count = 1 + Math.floor(Math.random() * 2); // 1〜2匹
    // 番の推定性格（mate.preset から近似）
    const matePersonality = PRESETS[dog.mate.preset]?.personality ?? randomPersonality();
    // 犬種選択ロジック: 父40% 母40% その他20%
    const allBreedIds = BREED_DEFS.map(b => b.id);
    const fatherBreed = dog.breed;
    const motherBreed = dog.mate.breed ?? allBreedIds[Math.floor(Math.random() * allBreedIds.length)];
    const otherBreeds = allBreedIds.filter(b => b !== fatherBreed && b !== motherBreed);
    const pickPuppyBreed = (): string => {
      const r = Math.random();
      if (r < 0.4) return fatherBreed;
      if (r < 0.8) return motherBreed;
      return otherBreeds.length > 0
        ? otherBreeds[Math.floor(Math.random() * otherBreeds.length)]
        : fatherBreed;
    };
    const puppies: FamilyMember[] = Array.from({ length: count }, (_, i) => {
      const offspring = breedDogs(dog, mateDog);
      const offspringPersonality = breedPersonality(dog.personality, matePersonality);
      const pg: Gender = Math.random() < 0.5 ? 'male' : 'female';
      return {
        id:   Date.now().toString(36) + '_p' + i,
        name: `子犬${i + 1}`,
        gender:         pg,
        generation:     dog.generation + 1,
        abilities:      offspring,
        tournamentWins: 0,
        preset:         'random',
        personality:    offspringPersonality,
        breed:          pickPuppyBreed(),
      };
    });
    setDog(prev => ({
      ...prev, puppies,
      log: addLog(prev.log, `🐶 ${count}匹の子犬が生まれた！家系図から次の主人公を選んでください`),
    }));
    setScreen('puppySelect');
    showFeedback(`🐶 ${count}匹誕生！`, '#C96B8A');
  };

  const selectPuppy = (puppy: FamilyMember) => {
    setDog(prev => {
      const parentRecord: LineageRecord = {
        generation:          prev.generation,
        name:                prev.dogName,
        gender:              prev.gender,
        tournamentWins:      prev.tournamentWins,
        tournamentPlacements: (prev as any).tournamentPlacements ?? 0,
        abilities:           prev.abilities,
        peakAbilities:       prev.peakAbilities ?? prev.abilities,
        satoriBonuses:       prev.satoriBonuses ?? [],
      };
      const base = createInitialDogState(puppy.preset ?? 'random', puppy.breed ?? 'shibainu');
      // 悟りスキル引き継ぎ: P = 親の認知能力/1000 per slot
      const cogFactor = Math.max(0, Math.min(1, (prev.cognition ?? 500) / 1000));
      const inheritedSatori = (prev.satoriBonuses ?? []).filter(() => Math.random() < cogFactor);
      // v13+: 引き継ぎアイテムの整理
      // ・装備スロットに身につけていた最大6つのアイテム → 全て引き継ぐ
      // ・クローゼット（inventory）内のEpicアイテム → 全て引き継ぐ
      // ・Rare以下のアイテム → 消失
      const equippedItems2 = Object.values(prev.equipment ?? {})
        .filter((v): v is InventoryItem => v !== null);
      const epicInventoryItems = (prev.inventory ?? []).filter(item => item.rarity === 'epic' || item.rarity === 'legendary');
      const inheritedInventory = [...equippedItems2, ...epicInventoryItems].slice(-50);
      // 形見の品: 装備品の最後 → Epicアイテム → 旧heirloomItemId の順で決定
      const parentHeirloom =
        equippedItems2.length > 0
          ? equippedItems2[equippedItems2.length - 1].name
          : epicInventoryItems.length > 0
            ? epicInventoryItems[0].name
            : (prev.heirloomItemId ?? null);
      return {
        ...base,
        dogId:        puppy.id,
        dogName:      puppy.name,
        gender:       puppy.gender,
        generation:   puppy.generation,
        breed:        puppy.breed ?? base.breed,
        abilities:    puppy.abilities,
        personality:  puppy.personality ?? base.personality,
        lineage:      [parentRecord, ...prev.lineage].slice(0, 5),
        coins:        prev.coins,
        inventory:    inheritedInventory,
        children:     prev.children,
        mate:         null,
        knownDogs:    prev.knownDogs,
        satoriBonuses: inheritedSatori,
        heirloomItemId: parentHeirloom, // 形見を引き継ぐ
        log: [`🌱 ${puppy.name}（第${puppy.generation}世代）の育成を開始！`, `💍 引き継いだアイテム: 装備品${equippedItems2.length}個 + Epic${epicInventoryItems.length}個`],
      };
    });
    setScreen('main');
    showFeedback(`🌱 ${puppy.name}の育成スタート！`, '#8DAA91');
  };

  const renamePuppy = (puppyId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setDog(prev => ({
      ...prev,
      puppies: prev.puppies.map(p => p.id === puppyId ? { ...p, name: trimmed } : p),
    }));
  };

  // ─────────────────────────────────────────────────────────────────────
  // 育て直し（祖先選択→子孫抹消）（v8）
  // ─────────────────────────────────────────────────────────────────────

  const restartFromAncestor = (ancestor: LineageRecord, idx: number) => {
    setDog(prev => {
      const base = createInitialDogState('random');
      // lineage は idx より前（より古い祖先）のみ残す
      const olderLineage = prev.lineage.slice(idx + 1);
      return {
        ...base,
        dogId:         Date.now().toString(36) + '_restart',
        dogName:       ancestor.name,
        generation:    ancestor.generation,
        abilities:     { ...ancestor.abilities,
          physical: { ...ancestor.abilities.physical },
          beauty:   { ...ancestor.abilities.beauty },
        },
        tournamentWins: ancestor.tournamentWins,
        lineage:        olderLineage,
        coins:          Math.floor(prev.coins / 4), // コインは1/4引き継ぎ
        knownDogs:      [],   // 子孫との出会いはリセット
        mate:           null,
        children:       [],
        puppies:        [],
        log: [`🔄 ${ancestor.name}（第${ancestor.generation}世代）から育て直し開始！`],
      };
    });
    setScreen('main');
    setRunning(false);
    showFeedback(`🔄 ${ancestor.name}から育て直し！`, '#e74c3c');
  };

  // ─────────────────────────────────────────────────────────────────────
  // 引退処理（v8）
  // ─────────────────────────────────────────────────────────────────────

  const retireDog = () => {
    setDog(prev => ({
      ...prev,
      isRetired: true,
      log: addLog(prev.log, `🏁 ${prev.dogName}が引退した。子犬の育成が解放されました！`),
    }));
    showFeedback('🏁 引退しました！子犬を選べます', '#e74c3c');
    setScreen('puppySelect');
  };

  // ─────────────────────────────────────────────────────────────────────
  // セーブ・ロード（v8）
  // ─────────────────────────────────────────────────────────────────────

  const saveGame = (slotId: number) => {
    const label = `${dog.dogName} 第${dog.generation}世代 Day${Math.floor(dog.totalGameMin/1440)+1} 規律${dog.abilities.physical.discipline}`;
    const slot: SaveSlot = { slotId, savedAt: Date.now(), dog: { ...dog }, label };
    setSaveSlots(prev => { const next = [...prev]; next[slotId] = slot; return next; });
    try{ localStorage.setItem(`dogSave_${slotId}`, JSON.stringify(slot)); }catch(_){}
    showFeedback(`💾 スロット${slotId + 1}に保存`, '#8DAA91');
  };

  const loadGame = (slotId: number) => {
    const slot = saveSlots[slotId];
    if(!slot) return;
    // v10: 旧セーブデータとの互換性パッチ
    const raw = slot.dog as any;
    // 旧 rivalScores 形式 → 新 participants 形式 へ変換
    let pendingResult: ContestResult | null = raw.contestPendingResult ?? null;
    if(pendingResult && !(pendingResult as any).participants) {
      const oldScores: number[] = (pendingResult as any).rivalScores ?? [];
      pendingResult = {
        ...pendingResult,
        participants: oldScores.map((s, i) => ({ name: `ライバル${i+1}`, score: s, type: 'npc' as const })),
        bonusItem: null,
      };
    }
    // v11: 旧セーブデータとの互換性パッチ（focus / maxStamina）
    const physicalPatch = {
      ...raw.abilities?.physical,
      focus: raw.abilities?.physical?.focus ?? 100,  // v11追加、なければデフォルト100
    };
    const abilitiesPatch = raw.abilities
      ? { ...raw.abilities, physical: physicalPatch }
      : undefined;
    const loadedDog: DogState = {
      ...slot.dog,
      ...(abilitiesPatch ? { abilities: abilitiesPatch } : {}),
      maxStamina:           raw.maxStamina           ?? 300,   // v11追加、なければデフォルト300
      lastContestRunMonth:  raw.lastContestRunMonth  ?? -1,
      contestPendingResult: pendingResult,
      lineageType:          raw.lineageType          ?? 'show', // 血統タイプ、なければデフォルトshow
      breed:                raw.breed                ?? 'shibainu', // 犬種、なければデフォルト柴犬
    };
    setDog(loadedDog);
    setRunning(true);
    setScreen('main');
    showFeedback(`📂 ${slot.label} ロード完了`, '#7A9E9F');
  };

  // ── 派生値
  const emotionIcon    =getEmotionIcon(dog);
  const statusText     =getStatusText(dog);
  const personalityType=derivePersonalityType(dog.personality);
  const trustLabel     =getTrustLabel(dog.attachment);
  const ageStr         =`${Math.floor(dog.age)}日 (${Math.floor(dog.age/365)}歳)`;
  const speedX         =(realMinPerDay/GAME_MINUTES_PER_DAY*60).toFixed(2);
  const discountPct    =((1-attachmentDiscount(dog.attachment))*100).toFixed(0);
  const isHighStress   =dog.stress>=STRESS_BARK_THRESHOLD;
  const canScold       =dog.currentAction==='excessive_barking'||dog.currentAction==='destructive';
  // v6
  const autoModeOn     = isAutoMode(dog);
  // v6 Step3: 装備ボーナス
  const eqBonuses      = calcEquipmentBonuses(dog.equipment ?? emptyEquipment());
  const styleScore     = calcStyleScore(dog.equipment ?? emptyEquipment());
  // v7: 時間・夜間
  const dayHour        = Math.floor((dog.dayTimeMin ?? DAY_START_MIN) / 60);
  const dayMinute      = (dog.dayTimeMin ?? DAY_START_MIN) % 60;
  const isNight        = (dog.dayTimeMin ?? DAY_START_MIN) >= NIGHT_START_MIN;
  const dayPhase: 'morning'|'noon'|'evening'|'night'|'midnight' =
    dayHour >= 6  && dayHour < 10 ? 'morning' :
    dayHour >= 10 && dayHour < 17 ? 'noon'    :
    dayHour >= 17 && dayHour < 20 ? 'evening' :
    dayHour >= 20 && dayHour < 22 ? 'night'   : 'midnight';
  const dayPhaseBg:Record<typeof dayPhase,string> = {
    morning:'#F9F7F2', noon:'#e3f2fd', evening:'#fff3e0', night:'#e8eaf6', midnight:'#eceff1'
  };
  const dayPhaseLabel:Record<typeof dayPhase,string> = {
    morning:'🌅 朝', noon:'☀️ 昼', evening:'🌇 夕方', night:'🌙 夜', midnight:'🌌 深夜'
  };
  const timeStr = `${String(dayHour).padStart(2,'0')}:${String(Math.floor(dayMinute)).padStart(2,'0')}`;
  // v13: 形見バフ（先祖と同じアイテムを装備中なら幸運+1）
  const heirloomEquipped = (dog.heirloomItemId ?? null) !== null &&
    Object.values(dog.equipment ?? {}).some(v => v !== null && (v as InventoryItem).name === dog.heirloomItemId);
  const effectiveLuck = Math.max(0, dog.abilities.luck + eqBonuses.luck - (dog.poopDebuff ? POOP_LUCK_PENALTY : 0) + (heirloomEquipped ? 1 : 0));
  const effDisc        = calcEffectiveDiscipline(dog.abilities.physical.discipline, dog.arousal);
  const intelWindow    = calcIntelligenceWindow(dog.abilities.intelligence);
  const arousalZone    = dog.arousal>=AROUSAL_RED_THRESHOLD?'red':
                         (dog.arousal>=AROUSAL_GREEN_MIN&&dog.arousal<=AROUSAL_GREEN_MAX)?'green':'normal';
  // v8: ポーズ中はすべての時間消費アクションをロック
  const isActionLocked = !running;
  // 夜間（22:00-06:00）は強制睡眠表示
  const isNightSleep   = isNight || (!running && dog.isSleeping);

  // ── ステータスパネル用ミニバー（透過ダークパネル内で使用）
  const PANEL_TIPS: Record<string, string> = {
    '空腹':   '① 効能: 100になると空腹状態。ご飯を与えないとストレスが増加。\n② 変動: 時間経過で上昇。餌をやるで大きく低下。',
    '汚れ':   '① 効能: 100になると不衛生状態。ストレス・愛着に悪影響。\n② 変動: 時間経過で上昇。ブラッシング・お風呂で低下。',
    '排泄':   '① 効能: 100になると我慢限界。ストレス上昇・粗相リスク。\n② 変動: 時間経過・食事後に上昇。トイレ誘導で低下。',
    '興奮':   '① 効能: 40-70がOptimalゾーン（フィジカル×1.1）。高すぎると規律-20%。\n② 変動: 遊び・声かけで上昇。散歩・マッサージで低下。',
    '幸福感': '① 効能: 高いほどコンテスト好印象・愛着が増えやすい。\n② 変動: 遊び・ケアで上昇。欲求不満・ストレスで低下。',
    '眠気':   '① 効能: 100に近づくと自動睡眠。夜22時以降は強制就寝。\n② 変動: 活動・時間経過で上昇。睡眠で大きく低下。',
    '疲労':   '① 効能: 高いとスタミナ回復が遅くなりコンテストに不利。\n② 変動: 激しい運動・コンテストで上昇。睡眠・マッサージで低下。',
    '活力':   '① 効能: ストレス逆指標。低いと問題行動（吠え・破壊）が発生。\n② 変動: 欲求が満たされると上昇。空腹・汚れ放置で低下。',
    '規律':   '① 効能: コンテスト（服従）の基礎スコア。高いほど命令精度が上がる。\n② 変動: しつけトレーニング・まて遊びで上昇。',
    '速度':   '① 効能: フライボール・アジリティのタイム短縮に直結。\n② 変動: ロープ引き・フリスビー・ランで上昇。',
    'スタミナ': '① 効能: 長距離散歩・持久力コンテストの基礎値。\n② 変動: ジョギング・散歩で上昇。運動不足で低下。',
    'バネ':   '① 効能: ジャンプ力・フライボールの飛距離に影響。\n② 変動: フリスビー・ジャンプ系トレーニングで上昇。',
    '集中力': '① 効能: 命令成功率・コンテスト精度に影響。老犬期に特に重要。\n② 変動: まて・宝探しゲームで上昇。疲労が高いと低下。',
    '毛並み': '① 効能: ビューティーコンテストの主要得点源。\n② 変動: ブラッシング・お風呂で上昇。時間経過で徐々に低下。',
    '愛嬌':   '① 効能: ビューティーコンテストの印象点に影響。\n② 変動: 遊び・声かけ・愛着が高いほど向上。',
    'スタイル': '① 効能: 装備品の組み合わせから算出するビジュアルスコア。\n② 変動: クローゼットで装備をコーデするほど上昇。',
    '知性':   '① 効能: 宝探し・ノーズワークの正答率アップ。遺伝に影響。\n② 変動: 宝探しゲーム・ノーズワーク・探索散歩で上昇。\n③ 知性ボーナス: 知性1000で老犬期に悟りスロット+1。遊びアクション時に大成功確率（知性×0.025%）が発動し、上昇ステータスが1.5倍になる。',
    '幸運':   '① 効能: コンテスト判定のランダム補正。入賞確率が微増。\n② 変動: アイテム・悟りスキルで加算。基本値は変化しない。',
    '愛着':   '① 効能: ストレス耐性バフ（最大-50%）。信頼度が高いほど懐く。\n② 変動: 毎日のケア・遊び・声かけの積み重ねで上昇。',
    '社会化': '① 効能: 子犬期終了時のSEに応じ成長係数（×0.95/1.0/1.1）が決まる。\n② 変動: 新しいケア/遊び/エリア初体験・子犬教室・他の犬との遭遇で+2〜+20。欲求放置で-1。',
    '認知能力': '① 効能: 老犬期の遺伝ボーナス率・悟りスキル継承確率を決める（÷1000）。\n② 変動: 遊び・探索散歩で+。コンテスト入賞で+5。老犬期に自然低下。',
    '寿命':   '① 効能: 0になると終焉シーケンスが始まる。\n② 変動: 老犬期に1日(year-10)ずつ自然低下。シニアサプリ・老犬マッサージ・延命手術で回復。',
  };
  const panelBar = (icon: string, label: string, value: number, max: number, color: string) => (
    <View key={label} style={{flexDirection:'row', alignItems:'center', gap:4, marginBottom:5}}>
      <Text style={{fontSize:11, width:14, textAlign:'center'}}>{icon}</Text>
      <Text style={{fontSize:9, color:'rgba(255,255,255,0.65)', width:38, flexShrink:0}}>{label}</Text>
      {PANEL_TIPS[label] ? (
        <TouchableOpacity
          style={{width:13,height:13,borderRadius:7,backgroundColor:'rgba(255,255,255,0.25)',
            alignItems:'center',justifyContent:'center'}}
          onPress={()=>setPanelTooltip(panelTooltip === label ? null : label)}
        >
          <Text style={{fontSize:8,color:'#fff',fontWeight:'800',lineHeight:12}}>?</Text>
        </TouchableOpacity>
      ) : <View style={{width:13}}/>}
      <View style={{flex:1, height:4, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:2, overflow:'hidden'}}>
        <View style={{height:'100%', borderRadius:2, backgroundColor:color, width:`${Math.min(100,(value/max)*100)}%` as any}}/>
      </View>
      <Text style={{fontSize:9, color:'rgba(255,255,255,0.5)', width:24, textAlign:'right'}}>{Math.round(value)}</Text>
    </View>
  );
  const panelTipBubble = panelTooltip && PANEL_TIPS[panelTooltip] ? (
    <View style={{
      backgroundColor:'rgba(30,20,10,0.92)', borderRadius:8, padding:8,
      marginBottom:6, marginHorizontal:2,
      borderLeftWidth:2, borderLeftColor:'rgba(201,169,110,0.7)',
    }}>
      <Text style={{fontSize:10,color:'rgba(255,255,255,0.85)',lineHeight:15,fontWeight:'600',marginBottom:2}}>
        📖 {panelTooltip}
      </Text>
      <Text style={{fontSize:10,color:'rgba(255,255,255,0.70)',lineHeight:15}}>
        {PANEL_TIPS[panelTooltip]}
      </Text>
    </View>
  ) : null;

  // ── v13: 終焉シーケンス（最優先表示）
  if(deathPhase !== null) {
    // 最も訪問回数の多いエリアの背景
    const ws = dog.walkStats ?? {};
    const topDest = (['city','park','beach','mountain','secret'] as WalkDestination[])
      .reduce<WalkDestination>((best, d2) => (ws[d2] ?? 0) > (ws[best] ?? 0) ? d2 : best, 'park');
    const destBg = topDest === 'city' ? IMG_BG_TOWN
      : topDest === 'beach'    ? IMG_BG_BEACH
      : topDest === 'mountain' ? IMG_BG_TRAIL
      : IMG_BG_PARK;
    // 装備中の形見アイテム（継承候補）
    const equippedNames = Object.values(dog.equipment ?? {})
      .filter((v): v is InventoryItem => v !== null)
      .map(v => v.name);
    const heirloomName = equippedNames.length > 0 ? equippedNames[equippedNames.length - 1] : null;

    const handlePhaseAdvance = () => {
      if(deathPhase === 1)        { setDeathPhase(2); }
      else if(deathPhase === 2)   { setDeathPhase('petted'); }
      else if(deathPhase === 'petted') { setDeathPhase(3); }
      else if(deathPhase === 3)   { setDeathPhase('succession'); }
    };
    const handleSuccession = () => {
      // 引退フラグを立てて子犬選択へ
      setDog(prev => ({
        ...prev,
        isRetired: true,
        pendingDeath: false,
        log: addLog(prev.log, `🌟 ${prev.dogName}は深い眠りにつきました。次の世代へ…`),
      }));
      setDeathPhase(null);
      setScreen('puppySelect');
    };
    const handleSuccessionWithHeirloom = () => {
      setDog(prev => ({
        ...prev,
        isRetired:    true,
        pendingDeath: false,
        // heirloomItemId は子犬選択時に渡す（selectPuppy で上書き）
        log: addLog(prev.log, `🌟 ${prev.dogName}は深い眠りにつきました。形見の品が受け継がれる…`),
      }));
      setDeathPhase(null);
      setScreen('puppySelect');
    };

    return (
      <PhoneContainer>
        <View style={{flex:1, backgroundColor:'#0a0a12'}}>
          {/* ── フェーズ1: 別れの予兆 ── */}
          {deathPhase === 1 && (
            <View style={{flex:1, justifyContent:'center', alignItems:'center', padding:32}}>
              <Text style={{fontSize:48, marginBottom:24}}>🐾</Text>
              <Text style={{
                fontSize:20, color:'#D9C8A8', fontWeight:'700',
                textAlign:'center', lineHeight:30, marginBottom:16,
              }}>
                {dog.dogName}がどこかに{'\n'}行きたがっている…
              </Text>
              <Text style={{fontSize:13, color:'rgba(255,255,255,0.45)', textAlign:'center', marginBottom:48}}>
                齢 {Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY / 365 * 7 + 3)} 週 / {dog.generation}世代
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor:'rgba(201,169,110,0.25)', borderRadius:24,
                  paddingHorizontal:36, paddingVertical:14,
                  borderWidth:1, borderColor:'rgba(201,169,110,0.5)',
                }}
                onPress={handlePhaseAdvance}
              >
                <Text style={{color:'#D9C8A8', fontSize:15, fontWeight:'600'}}>ついていく…</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── フェーズ2: 最後の場所 ── */}
          {deathPhase === 2 && (
            <View style={{flex:1}}>
              <ImageBackground source={destBg} style={{flex:1}} resizeMode="contain" imageStyle={{opacity:0.35}}>
                <View style={{flex:1, justifyContent:'center', alignItems:'center', padding:28, paddingBottom:48}}>
                  <Text style={{
                    fontSize:16, color:'#D9C8A8', fontWeight:'600',
                    textAlign:'center', lineHeight:28, marginBottom:36,
                  }}>
                    ここは{dog.dogName}と一番たくさん歩いた場所です。{'\n\n'}
                    懐かしい匂いと風に包まれて、{'\n'}
                    {dog.dogName}はとても安心しているようです
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor:'rgba(201,169,110,0.30)', borderRadius:20,
                      paddingHorizontal:40, paddingVertical:14, alignItems:'center',
                      borderWidth:1, borderColor:'rgba(201,169,110,0.6)',
                    }}
                    onPress={handlePhaseAdvance}
                  >
                    <Text style={{color:'#D9C8A8', fontSize:16, fontWeight:'700'}}>そっとなでる</Text>
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </View>
          )}

          {/* ── フェーズ2b: なでた後（pettedフェーズ）── */}
          {deathPhase === 'petted' && (
            <View style={{flex:1}}>
              {/* 画像全体を contain で表示（coverだと幅501pxが~390px画面で両端42pxずつ切れるため） */}
              <Image
                source={IMG_BG_END}
                style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%', opacity:0.40}}
                resizeMode="contain"
              />
              <View style={{flex:1, justifyContent:'center', alignItems:'center', padding:28, paddingBottom:48}}>
                  <Text style={{
                    fontSize:15, color:'#D9C8A8', fontWeight:'600',
                    textAlign:'center', lineHeight:28, marginBottom:36,
                  }}>
                    あなたの手のぬくもりを感じて、{'\n'}
                    {dog.dogName}は満足そうに目を細めました。{'\n\n'}
                    あなたに会えて、本当によかった……。{'\n'}
                    そう伝えている気がします
                  </Text>
                  <TouchableOpacity
                    style={{
                      backgroundColor:'rgba(138,100,180,0.30)', borderRadius:20,
                      paddingHorizontal:40, paddingVertical:14, alignItems:'center',
                      borderWidth:1, borderColor:'rgba(180,140,220,0.5)',
                    }}
                    onPress={handlePhaseAdvance}
                  >
                    <Text style={{color:'#D9B8FF', fontSize:15, fontWeight:'600'}}>次へ…</Text>
                  </TouchableOpacity>
                </View>
            </View>
          )}

          {/* ── フェーズ3: 星空と昇天 ── */}
          {deathPhase === 3 && (
            <View style={{flex:1, justifyContent:'space-between', padding:28, paddingTop:56}}>
              <View style={{alignItems:'center'}}>
                <Text style={{fontSize:14, color:'rgba(255,255,255,0.35)', marginBottom:12, letterSpacing:4}}>
                  ✦  ✦    ✦       ✦  ✦
                </Text>
                <Text style={{
                  fontSize:16, color:'#E8D9B8', fontWeight:'700',
                  textAlign:'center', lineHeight:26, marginBottom:8,
                }}>
                  {dog.dogName}は、深い眠りにつきました。
                </Text>
                <Text style={{
                  fontSize:13, color:'rgba(255,255,255,0.60)',
                  textAlign:'center', lineHeight:22, marginBottom:20,
                }}>
                  その心には、あなたと過ごした数々の思い出と、{'\n'}
                  長い年月で得た『悟り』が刻まれています。
                </Text>

                {/* 悟りスキルが星として上昇するアニメーション */}
                <View style={{alignItems:'center', minHeight:120}}>
                  {(dog.satoriBonuses ?? []).map((sid, i) => {
                    const sk = SATORI_SKILLS.find(s => s.id === sid);
                    if(!sk) return null;
                    return (
                      <Animated.Text
                        key={sid}
                        style={{
                          fontSize:14, color:'#D9B8FF', marginBottom:6,
                          opacity: starAnimVals[i],
                          transform:[{translateY: starAnimVals[i].interpolate({
                            inputRange:[0,1],
                            outputRange:[40, 0],
                          })}],
                        }}
                      >
                        ⭐ {sk.name}　{sk.desc}
                      </Animated.Text>
                    );
                  })}
                </View>

                {/* 犬の幽霊画像：薄く・ぼかして浮かび上がり消えていく */}
                {constellationVisible && (() => {
                  const sleepImg = BREED_IMAGES[dog.breed]?.sleep;
                  if(!sleepImg) return null;
                  return (
                    <Animated.Image
                      source={sleepImg}
                      style={{
                        width: 200, height: 200,
                        opacity: constellationOpa,
                        marginTop: 16,
                        // Web: ぼかしはフェードアウト開始時に適用（CSS transitionで滑らかに）
                        ...(typeof window !== 'undefined' ? {
                          filter: ghostBlurred ? 'blur(8px) grayscale(0.6)' : 'none',
                          transition: 'filter 2s ease',
                        } as any : {}),
                      }}
                      resizeMode="contain"
                    />
                  );
                })()}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor:'rgba(138,100,180,0.30)', borderRadius:20,
                  paddingVertical:14, alignItems:'center',
                  borderWidth:1, borderColor:'rgba(180,140,220,0.5)',
                  marginTop:16,
                }}
                onPress={handlePhaseAdvance}
              >
                <Text style={{color:'#D9B8FF', fontSize:15, fontWeight:'600'}}>次の世代へ…</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── 継承画面 ── */}
          {deathPhase === 'succession' && (
            <ScrollView contentContainerStyle={{padding:28, paddingTop:60, paddingBottom:48}}>
              {/* 犬の記録 */}
              <View style={{
                backgroundColor:'rgba(255,255,255,0.08)', borderRadius:16,
                padding:20, marginBottom:20,
                borderWidth:1, borderColor:'rgba(255,255,255,0.15)',
              }}>
                <Text style={{fontSize:18, color:'#E8D9B8', fontWeight:'800', marginBottom:4}}>
                  {dog.dogName}の記録
                </Text>
                <Text style={{fontSize:12, color:'rgba(255,255,255,0.50)', marginBottom:12}}>
                  第{dog.generation}世代 / 大会優勝: {dog.tournamentWins}回
                </Text>
                <View style={{gap:4}}>
                  {[
                    ['規律', Math.round(dog.abilities.physical.discipline)],
                    ['速度', Math.round(dog.abilities.physical.speed)],
                    ['スタミナ', Math.round(dog.abilities.physical.stamina)],
                    ['知性', Math.round(dog.abilities.intelligence)],
                    ['毛並み', Math.round(dog.abilities.beauty.coat)],
                  ].map(([label, val]) => (
                    <Text key={String(label)} style={{fontSize:12, color:'rgba(255,255,255,0.65)'}}>
                      {label}: {val}
                    </Text>
                  ))}
                </View>
                {(dog.satoriBonuses ?? []).length > 0 && (
                  <View style={{marginTop:12}}>
                    <Text style={{fontSize:11, color:'#D9B8FF', fontWeight:'700', marginBottom:4}}>
                      ✦ 悟りスキル
                    </Text>
                    {(dog.satoriBonuses ?? []).map(sid => {
                      const sk = SATORI_SKILLS.find(s => s.id === sid);
                      return sk ? (
                        <Text key={sid} style={{fontSize:11, color:'#D9B8FF', marginBottom:2}}>
                          {sk.name}　{sk.desc}
                        </Text>
                      ) : null;
                    })}
                    <Text style={{fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:4}}>
                      継承確率: {Math.round((dog.cognition ?? 500) / 10)}%（認知能力 {Math.round(dog.cognition ?? 500)}/1000）
                    </Text>
                  </View>
                )}
              </View>

              {/* 形見アイテム */}
              {heirloomName && (
                <View style={{
                  backgroundColor:'rgba(201,169,110,0.12)', borderRadius:12,
                  padding:14, marginBottom:20,
                  borderWidth:1, borderColor:'rgba(201,169,110,0.35)',
                }}>
                  <Text style={{fontSize:13, color:'#D9C8A8', fontWeight:'700', marginBottom:4}}>
                    💍 形見の品: {heirloomName}
                  </Text>
                  <Text style={{fontSize:11, color:'rgba(255,255,255,0.50)'}}>
                    子孫がこのアイテムを装備すると、先祖の加護が宿ります（幸運+1）
                  </Text>
                </View>
              )}

              <Text style={{
                fontSize:16, color:'#E8D9B8', fontWeight:'700',
                textAlign:'center', marginBottom:24, lineHeight:24,
              }}>
                {dog.dogName}の意志を継ぐ{'\n'}子犬を育てますか？
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor:'rgba(138,180,100,0.35)', borderRadius:20,
                  paddingVertical:16, alignItems:'center',
                  borderWidth:1, borderColor:'rgba(160,210,120,0.6)',
                  marginBottom:12,
                }}
                onPress={heirloomName ? handleSuccessionWithHeirloom : handleSuccession}
              >
                <Text style={{color:'#C8E8A8', fontSize:16, fontWeight:'800'}}>
                  {dog.puppies.length > 0 ? '✦ 子孫を選んで育てる' : '✦ 新しい子犬から始める'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </PhoneContainer>
    );
  }

  if(screen==='prologue'){
    return <PhoneContainer><PrologueScreen onComplete={()=>setScreen('title')} /></PhoneContainer>;
  }
  if(screen==='title'){
    return <PhoneContainer><TitleScreen
      saveSlots={saveSlots}
      isFirstLaunch={isFirstLaunch}
      onContinue={()=>{ setRunning(true); setScreen('main'); }}
      onNewGame={()=>{ setScreen('nameEntry'); }}
      onLoadSlot={loadGame}
      onFamilyTree={()=>setScreen('familyTree')}
      onSettings={()=>setScreen('settings')}
      onCollection={()=>{ setCollectionBackTarget('title'); setScreen('collection'); }}
      onDebugSenior={()=>{
        setDog(createDebugSeniorDog());
        setDeathPhase(null);
        setRunning(true);
        setScreen('main');
      }}
    /></PhoneContainer>;
  }
  if(screen==='nameEntry'){
    return <PhoneContainer><NameEntryScreen
      onComplete={(name, breed)=>{
        const d = createInitialDogState('random', breed);
        d.dogName = name;
        setDog(d);
        setRunning(true);
        setScreen('main');
        setIsFirstLaunch(false);
      }}
    /></PhoneContainer>;
  }
  if(screen==='familyTree'){
    return <PhoneContainer><FamilyTreeScreen
      dog={dog}
      onBack={()=>setScreen('main')}
      onBreed={breedWithMate}
      onSelectPuppy={selectPuppy}
      onRestart={restartFromAncestor}
      onRetire={retireDog}
      onRenamePuppy={renamePuppy}
    /></PhoneContainer>;
  }
  if(screen==='puppySelect'){
    if(!dog.isRetired){
      return (
        <PhoneContainer>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark"/>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.closetHeader}>
              <TouchableOpacity style={styles.closetBackBtn} onPress={()=>setScreen('main')}>
                <Text style={styles.closetBackText}>← 戻る</Text>
              </TouchableOpacity>
              <Text style={[styles.closetTitle,{color:'#C07840'}]}>🐶 子犬選択</Text>
              <View style={{width:60}}/>
            </View>
            <View style={[styles.card,{backgroundColor:'#fff9e6',borderLeftWidth:4,borderLeftColor:'#D4974E'}]}>
              <Text style={{fontSize:15,fontWeight:'700',color:'#C07840',marginBottom:8}}>🔒 まだ引退できません</Text>
              <Text style={{fontSize:12,color:'#8C7B6E',lineHeight:18}}>
                現在の子犬の育成を開始するには、親犬が引退する必要があります。{'\n'}
                家系図画面の「引退する」ボタンで引退できます。
              </Text>
              <TouchableOpacity style={[styles.btn,{backgroundColor:'#e67e22',marginTop:12}]} onPress={()=>setScreen('familyTree')}>
                <Text style={styles.btnText}>📜 家系図へ</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
        </PhoneContainer>
      );
    }
    return <PhoneContainer><FamilyTreeScreen
      dog={dog}
      onBack={()=>setScreen('main')}
      onBreed={breedWithMate}
      onSelectPuppy={selectPuppy}
      onRestart={restartFromAncestor}
      onRetire={retireDog}
      onRenamePuppy={renamePuppy}
    /></PhoneContainer>;
  }
  if(screen==='closet'){
    return <PhoneContainer><ClosetScreen dog={dog} onEquip={equipItem} onUnequip={unequipItem}
      onBack={()=>setScreen('main')} onShop={()=>setScreen('shop')}
      onItemChange={()=>triggerDogAnim('happy')}
      feedbackMsg={feedbackMsg}
      feedbackAnim={feedbackAnim} feedbackY={feedbackY} feedbackColor={feedbackColor}/></PhoneContainer>;
  }
  if(screen==='shop'){
    return <PhoneContainer><ShopScreen dog={dog} onBuy={buyItem} onSell={sellItem}
      onBack={()=>setScreen('main')} onCloset={()=>setScreen('closet')}
      feedbackMsg={feedbackMsg}
      feedbackAnim={feedbackAnim} feedbackY={feedbackY} feedbackColor={feedbackColor}/></PhoneContainer>;
  }
  if(screen==='walk'){
    return <PhoneContainer><WalkScreen dog={dog}
      onBack={()=>{
        const wasDate = isDateWalk;
        setIsDateWalk(false);
        setDog(prev=>({...prev,walkMeetup:null}));
        setScreen('main');
        if(wasDate && dog.mate){
          setTimeout(breedWithMate, 50);
        }
      }}
      onSoothe={meetupSoothe}
      onPlayTogether={meetupPlayTogether}
      onSniff={meetupSniff}
      onSelfHandicap={meetupSelfHandicap}
      onPassBy={meetupPassBy}
      onBye={meetupBye}
      onAgain={meetupAgain}
      onContinue={continueWalk}
      onEventDismiss={()=>setDog(prev=>({...prev, walkStrollEventPending: false}))}
      feedbackMsg={feedbackMsg}
      feedbackAnim={feedbackAnim} feedbackY={feedbackY} feedbackColor={feedbackColor}/></PhoneContainer>;
  }
  if(screen==='settings'){
    return <PhoneContainer><SettingsScreen
      settings={settings}
      realMinPerDay={realMinPerDay}
      onChangeSettings={(patch)=>{
        const next = {...settings,...patch};
        setSettings(next);
        if(patch.realMinPerDay){ setRealMinPerDay(patch.realMinPerDay); setInputText(String(patch.realMinPerDay)); }
        try{ localStorage.setItem('dogSettings', JSON.stringify(next)); }catch(_){}
      }}
      onBack={()=>setScreen('title')}
    /></PhoneContainer>;
  }
  if(screen==='collection'){
    return <PhoneContainer><CollectionScreen
      dog={dog}
      earnedTrophyIds={earnedTrophyIds}
      onBack={()=>setScreen(collectionBackTarget)}
    /></PhoneContainer>;
  }

  if(screen === 'contestSelect') {
    return (
      <PhoneContainer>
      <View style={{flex:1, backgroundColor:'#0a0a18'}}>
        {/* 背景画像：全体が映るようにcontain */}
        <Image
          source={IMG_BG_ARENA}
          style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%'}}
          resizeMode="contain"
        />
        {/* 半透明オーバーレイ（可読性確保） */}
        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.30)'}} pointerEvents="none"/>

        <SafeAreaView style={{flex:1}}>
          {/* 戻るボタン：左上・SafeAreaView内でやや下 */}
          <TouchableOpacity
            style={{
              marginTop:14, marginLeft:16, alignSelf:'flex-start',
              backgroundColor:'rgba(90,90,90,0.80)', borderRadius:20,
              paddingVertical:8, paddingHorizontal:16,
              flexDirection:'row', alignItems:'center', gap:4,
              borderWidth:1, borderColor:'rgba(200,200,200,0.35)',
            }}
            onPress={()=>setScreen('main')}
          >
            <Text style={{color:'#E8E8E8', fontWeight:'700', fontSize:14}}>← 戻る</Text>
          </TouchableOpacity>

          {/* タイトル */}
          <Text style={{
            textAlign:'center', fontSize:22, fontWeight:'900', color:'#fff',
            marginTop:14, marginBottom:4,
            textShadowColor:'rgba(0,0,0,0.9)', textShadowOffset:{width:0,height:2}, textShadowRadius:8,
          }}>🏆 大会選択</Text>

          {/* 3ボタン：画面中央に縦並び */}
          <View style={{flex:1, justifyContent:'center', alignItems:'center', gap:24, paddingHorizontal:36}}>

            {/* フィジカル */}
            {(settings.physicalContestEnabled ?? true) ? (
              <TouchableOpacity style={{width:'100%', alignItems:'center'}} onPress={()=>setScreen('contestPhysical')} activeOpacity={0.75}>
                <View style={{
                  backgroundColor:'#D85C28',
                  borderRadius:36,
                  borderWidth:4, borderColor:'#F0A070',
                  paddingVertical:2, paddingHorizontal:2,
                  shadowColor:'#D85C28', shadowOpacity:0.7, shadowRadius:10, elevation:8,
                  width:'90%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.70)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#fff', letterSpacing:2,
                      textShadowColor:'rgba(100,20,0,0.5)', textShadowOffset:{width:1,height:1}, textShadowRadius:3}}>
                      🏃 フィジカル
                    </Text>
                    <Text style={{fontSize:10, color:'rgba(255,235,220,0.90)', marginTop:2, letterSpacing:1}}>
                      オビディエンス・ハイジャンプ・ロングラン
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{width:'90%', opacity:0.4}}>
                <View style={{
                  backgroundColor:'#555', borderRadius:36, borderWidth:4, borderColor:'#777',
                  paddingVertical:2, paddingHorizontal:2, width:'100%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.30)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#aaa', letterSpacing:2}}>🏃 フィジカル</Text>
                    <Text style={{fontSize:10, color:'#999', marginTop:2}}>設定でOFFになっています</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ビューティー */}
            {(settings.beautyContestEnabled ?? true) ? (
              <TouchableOpacity style={{width:'100%', alignItems:'center'}} onPress={()=>setScreen('contestBeauty')} activeOpacity={0.75}>
                <View style={{
                  backgroundColor:'#C84878',
                  borderRadius:36,
                  borderWidth:4, borderColor:'#F090B8',
                  paddingVertical:2, paddingHorizontal:2,
                  shadowColor:'#C84878', shadowOpacity:0.7, shadowRadius:10, elevation:8,
                  width:'90%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.70)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#fff', letterSpacing:2,
                      textShadowColor:'rgba(80,0,40,0.5)', textShadowOffset:{width:1,height:1}, textShadowRadius:3}}>
                      📸 ビューティー
                    </Text>
                    <Text style={{fontSize:10, color:'rgba(255,225,240,0.90)', marginTop:2, letterSpacing:1}}>
                      3回のシャッターで最高のアピールを
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{width:'90%', opacity:0.4}}>
                <View style={{
                  backgroundColor:'#555', borderRadius:36, borderWidth:4, borderColor:'#777',
                  paddingVertical:2, paddingHorizontal:2, width:'100%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.30)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#aaa', letterSpacing:2}}>📸 ビューティー</Text>
                    <Text style={{fontSize:10, color:'#999', marginTop:2}}>設定でOFFになっています</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ノーズワーク */}
            {(settings.noseworkContestEnabled ?? true) ? (
              <TouchableOpacity style={{width:'100%', alignItems:'center'}} onPress={()=>setScreen('contestNosework')} activeOpacity={0.75}>
                <View style={{
                  backgroundColor:'#3A8840',
                  borderRadius:36,
                  borderWidth:4, borderColor:'#80C880',
                  paddingVertical:2, paddingHorizontal:2,
                  shadowColor:'#3A8840', shadowOpacity:0.7, shadowRadius:10, elevation:8,
                  width:'90%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.70)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#fff', letterSpacing:2,
                      textShadowColor:'rgba(0,40,0,0.5)', textShadowOffset:{width:1,height:1}, textShadowRadius:3}}>
                      👃 ノーズワーク
                    </Text>
                    <Text style={{fontSize:10, color:'rgba(215,245,215,0.90)', marginTop:2, letterSpacing:1}}>
                      6つのポイントから正解を嗅ぎ当てろ！
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{width:'90%', opacity:0.4}}>
                <View style={{
                  backgroundColor:'#555', borderRadius:36, borderWidth:4, borderColor:'#777',
                  paddingVertical:2, paddingHorizontal:2, width:'100%',
                }}>
                  <View style={{
                    borderRadius:30, borderWidth:2, borderColor:'rgba(255,255,255,0.30)',
                    paddingVertical:12, paddingHorizontal:16, alignItems:'center',
                  }}>
                    <Text style={{fontSize:20, fontWeight:'900', color:'#aaa', letterSpacing:2}}>👃 ノーズワーク</Text>
                    <Text style={{fontSize:10, color:'#999', marginTop:2}}>設定でOFFになっています</Text>
                  </View>
                </View>
              </View>
            )}

          </View>
        </SafeAreaView>
      </View>
      </PhoneContainer>
    );
  }

  // 副賞計算ヘルパー（大会景品プールから: Legendary:1%/Epic:79%/Rare:20%）
  const calcContestBonus = (rank: number) => {
    if (rank > 2) return null;
    const contestPhase = getLifecycleStage(dog.totalGameMin);
    const contestPhasePool = CONTEST_ITEM_POOL.filter(i => !i.phases || i.phases[contestPhase] === true);
    const rc = Math.random();
    let rar: 'legendary'|'epic'|'rare';
    if(rc < 0.01) rar = 'legendary';
    else if(rc < 0.80) rar = 'epic';
    else rar = 'rare';
    let pool = contestPhasePool.filter(i => i.rarity === rar);
    if(!pool.length) pool = contestPhasePool.filter(i => i.rarity === 'rare');
    if(!pool.length) return null;
    const tpl = pool[Math.floor(Math.random() * pool.length)];
    return { name: tpl.name, rarity: rar, category: tpl.category, bonuses: tpl.bonuses, flavorText: tpl.flavorText };
  };
  const applyContestResult = (rank: number, score: number, logEmoji: string, entries: ContestResultEntry[]) => {
    const prizeTable = [2000, 1000, 500, 100, 50, 0];
    const coins = prizeTable[(rank-1)] ?? 0;
    const won = rank === 1;
    const placed = rank <= 2; // 2位以上
    const bonus = calcContestBonus(rank);
    // 大会種別判定
    const contestType: 'physical' | 'beauty' | 'nosework' =
      logEmoji.includes('トライアスロン') ? 'physical'
      : logEmoji.includes('フォトセッション') ? 'beauty'
      : 'nosework';
    setDog(prev => {
      const newInv = bonus
        ? [...(prev.inventory ?? []), { id: Date.now().toString(36)+'c', name: bonus.name,
            category:(bonus.category ?? 'accessory') as ItemCategory, rarity: bonus.rarity,
            bonuses: bonus.bonuses ?? {}, flavorText: bonus.flavorText ?? '',
            source:'event' as const, acquiredAt: prev.totalGameMin }]
        : (prev.inventory ?? []);
      return {
        ...prev,
        coins: (prev.coins ?? 0) + coins,
        tournamentWins: won ? (prev.tournamentWins ?? 0) + 1 : (prev.tournamentWins ?? 0),
        inventory: newInv,
        log: addLog(prev.log, `${logEmoji}第${rank}位！スコア${score} 賞金${coins}💰${bonus ? ` 副賞「${bonus.name}」獲得！` : ''}`),
      };
    });
    // コンテスト参加数 & 連帯数をインクリメント
    setContestParticipation(prev => ({ ...prev, [contestType]: prev[contestType] + 1 }));
    if(placed){
      setContestPlacements(prev => ({ ...prev, [contestType]: prev[contestType] + 1 }));
      // 現在犬の全連帯フラグを更新
      setCurrentDogContestAllPlacements(prev => ({ ...prev, [contestType]: true }));
    }
    // グローバル統計を保存
    const newParticipation = { ...contestParticipation, [contestType]: contestParticipation[contestType] + 1 };
    const newPlacements = placed ? { ...contestPlacements, [contestType]: contestPlacements[contestType] + 1 } : contestPlacements;
    const newAllPlacements = placed ? { ...currentDogContestAllPlacements, [contestType]: true } : currentDogContestAllPlacements;
    saveGlobalStatsAndCheckTrophies(dog, globalPlayCount, globalCareCount, globalShopSpend, globalDailyShopSpend, globalItemsPickedUp, earnedTrophyIds, newParticipation, newPlacements, newAllPlacements);
    setContestBonusItem(bonus);
    setContestResultEntries(entries);
    setScreen('contestResult');
  };

  if(screen === 'contestPhysical') {
    return <PhoneContainer><ContestPhysicalScreen dog={dog}
      onResult={(rank, score, commentary, entries) => applyContestResult(rank, score, '🏃 トライアスロン', entries)}
      onBack={()=>setScreen('contestSelect')}/></PhoneContainer>;
  }

  if(screen === 'contestBeauty') {
    return <PhoneContainer><ContestBeautyScreen dog={dog}
      onResult={(rank, score, commentary, entries) => applyContestResult(rank, score, '📸 フォトセッション', entries)}
      onBack={()=>setScreen('contestSelect')}/></PhoneContainer>;
  }

  if(screen === 'contestNosework') {
    return <PhoneContainer><ContestNoseworkScreen dog={dog}
      onResult={(rank, score, _commentary, entries) => applyContestResult(rank, score, '👃 ノーズワーク', entries)}
      onBack={()=>setScreen('contestSelect')}/></PhoneContainer>;
  }

  if(screen === 'contestResult') {
    return <PhoneContainer><ContestResultScreen
      entries={contestResultEntries}
      bonusItem={contestBonusItem}
      onClose={()=>{ setContestBonusItem(null); setScreen('contestSelect'); }}
    /></PhoneContainer>;
  }

  return(
    <PhoneContainer>
    <SafeAreaView style={{flex:1, backgroundColor:'#1E2830'}}>
      <StatusBar style="light"/>

      {/* 散歩目的地選択モーダル */}
      <DestinationPickerModal
        dog={dog}
        visible={showDestPicker}
        onSelect={(dest) => {
          setShowDestPicker(false);
          setIsDateWalk(false);
          startWalkWithDest(dest);
        }}
        onDateSelect={(dest) => {
          setShowDestPicker(false);
          setIsDateWalk(true);
          startWalkWithDest(dest);
        }}
        onCancel={() => setShowDestPicker(false)}
      />

      <View style={{flex:1}}>
        {/* 背景画像（絶対配置） */}
        <Image
          source={
            dog.walkingTicksLeft > 0 && dog.walkDestination
              ? dog.walkDestination === 'city'     ? IMG_BG_TOWN
              : dog.walkDestination === 'park'     ? IMG_BG_PARK
              : dog.walkDestination === 'beach'    ? IMG_BG_BEACH
              : dog.walkDestination === 'mountain' ? IMG_BG_TRAIL
              : IMG_BG_MAIN
              : IMG_BG_MAIN
          }
          resizeMode={dog.walkingTicksLeft > 0 && dog.walkDestination ? 'cover' : 'contain'}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            opacity: dog.walkingTicksLeft > 0 ? 0.75 : 0.60,
          }}
        />
        {/* 暗オーバーレイ */}
        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0, backgroundColor:'rgba(20,12,8,0.32)'}} pointerEvents="none"/>

        {/* フローティングフィードバック */}
        {feedbackMsg!==''&&(
          <Animated.View
            style={[styles.floatingFeedback,{opacity:feedbackAnim,transform:[{translateY:feedbackY}]}]}
            pointerEvents="none"
          >
            <Text style={[styles.floatingFeedbackText,{color:feedbackColor}]}>{feedbackMsg}</Text>
          </Animated.View>
        )}

        {/* ══ TOP HUD ══ */}
        <View style={{
          position:'absolute', top:0, left:0, right:0,
          flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start',
          paddingTop:50, paddingHorizontal:12, zIndex:20,
        }}>
          {/* 左列: 木製プレート（針時計付き） + ステータスボタン */}
          <View style={{gap:5, flex:1, marginRight:10, maxWidth:230}}>
            {/* 木製プレート（犬名・日時 + 針時計） */}
            <View style={{
              backgroundColor:'rgba(74,63,53,0.88)',
              borderRadius:14, paddingVertical:8, paddingHorizontal:12,
              borderWidth:1.5, borderColor:'rgba(201,169,110,0.5)',
              flexDirection:'row', alignItems:'center', gap:8,
            }}>
              {/* テキスト情報 */}
              <View style={{flex:1}}>
                <Text style={{fontSize:13,fontWeight:'900',color:'#F9F7F2',lineHeight:18}}>
                  {dog.gender==='male'?'🐶':'🐩'} {dog.dogName}
                  <Text style={{fontSize:10,fontWeight:'400',color:'#C9A96E'}}> 第{dog.generation}世代</Text>
                  {dog.dogName==='老犬テスト' && (
                    <Text style={{fontSize:9,fontWeight:'800',color:'#FF8080'}}> 🧪DEBUG</Text>
                  )}
                </Text>
                {(()=>{
                  const cal = gameCalendar(dog.totalGameMin, GAME_MINUTES_PER_DAY);
                  return (
                    <Text style={{fontSize:11,color:'#C9A96E',marginTop:2}}>
                      {cal.year}年目 {cal.month}月{cal.day}日　{timeStr}
                    </Text>
                  );
                })()}
                <Text style={{fontSize:10,color:'#D0C4B8',marginTop:1}}>{dayPhaseLabel[dayPhase]}　{ageStr}</Text>
              </View>
              {/* 針時計 */}
              <AnalogClock dayTimeMin={dog.dayTimeMin ?? DAY_START_MIN}/>
            </View>

            {/* ライフサイクルバッジ */}
            {(()=>{
              const lcStage = getLifecycleStage(dog.totalGameMin);
              const lcLabel = lcStage === 'puppy' ? '子犬期🐾' : lcStage === 'senior' ? '老犬期🌸' : '成犬期🐕';
              const lcColor = lcStage === 'puppy' ? '#C96B8A' : lcStage === 'senior' ? '#8C6B9E' : '#6B9070';
              return (
                <View style={{
                  backgroundColor: `${lcColor}DD`, borderRadius:8,
                  paddingVertical:3, paddingHorizontal:8, alignSelf:'flex-start',
                }}>
                  <Text style={{fontSize:10, fontWeight:'800', color:'#FFF'}}>{lcLabel}</Text>
                </View>
              );
            })()}
            {/* 社会化経験値バー（子犬期のみ） */}
            {getLifecycleStage(dog.totalGameMin) === 'puppy' && (
              <View style={{
                backgroundColor:'rgba(74,63,53,0.85)', borderRadius:8,
                paddingVertical:5, paddingHorizontal:8, gap:3,
              }}>
                <Text style={{fontSize:9, color:'#F9C5D5', fontWeight:'800'}}>🌱 社会化 {Math.round(dog.socialExp ?? 0)}/100</Text>
                <View style={{height:5, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:3}}>
                  <View style={{
                    width: `${Math.min(100, dog.socialExp ?? 0)}%`,
                    height:5, backgroundColor:'#C96B8A', borderRadius:3,
                  }}/>
                </View>
              </View>
            )}
            {/* 寿命・認知能力バー（老犬期のみ） */}
            {getLifecycleStage(dog.totalGameMin) === 'senior' && (
              <View style={{
                backgroundColor:'rgba(74,63,53,0.85)', borderRadius:8,
                paddingVertical:5, paddingHorizontal:8, gap:3,
              }}>
                <Text style={{fontSize:9, color:'#D9B8FF', fontWeight:'800'}}>❤️ 寿命 {Math.round(dog.lifespan ?? 1000)}/1000</Text>
                <View style={{height:5, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:3}}>
                  <View style={{
                    width:`${Math.min(100, (dog.lifespan ?? 1000) / 10)}%`,
                    height:5, backgroundColor:'#8C6B9E', borderRadius:3,
                  }}/>
                </View>
                <Text style={{fontSize:9, color:'#B8D4FF', fontWeight:'800'}}>🧠 認知 {Math.round(dog.cognition ?? 500)}/1000</Text>
                <View style={{height:5, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:3}}>
                  <View style={{
                    width:`${Math.min(100, (dog.cognition ?? 500) / 10)}%`,
                    height:5, backgroundColor:'#7A9E9F', borderRadius:3,
                  }}/>
                </View>
              </View>
            )}
            {/* 形見バフ表示（先祖のアイテム装備中） */}
            {heirloomEquipped && (
              <View style={{
                backgroundColor:'rgba(201,169,110,0.25)', borderRadius:8,
                paddingVertical:4, paddingHorizontal:7,
                borderWidth:1, borderColor:'rgba(201,169,110,0.5)',
              }}>
                <Text style={{fontSize:9, color:'#D9C8A8', fontWeight:'700'}}>
                  💍 先祖に見守られている気がする
                </Text>
              </View>
            )}
            {/* ステータスパネル開閉ボタン */}
            <TouchableOpacity
              style={{
                backgroundColor: drawerOpen ? 'rgba(201,169,110,0.85)' : 'rgba(74,63,53,0.80)',
                borderRadius:8, paddingVertical:4, paddingHorizontal:10,
                borderWidth:1, borderColor:'rgba(201,169,110,0.4)',
                alignSelf:'flex-start', flexDirection:'row', alignItems:'center', gap:4,
              }}
              onPress={toggleDrawer}
              activeOpacity={0.8}
            >
              <Text style={{fontSize:10, fontWeight:'800', color: drawerOpen ? '#3A2F25' : '#C9A96E'}}>
                {drawerOpen ? '◀ 閉じる' : '📊 ステータス'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 右列: クローゼット・ショップ + コイン + ポーズ */}
          <View style={{alignItems:'flex-end',gap:6}}>
            {/* クローゼット・ショップ クイックアクセス */}
            <View style={{flexDirection:'row',gap:6}}>
              <TouchableOpacity
                style={{backgroundColor:'rgba(201,107,138,0.85)',borderRadius:14,
                  paddingVertical:7,paddingHorizontal:11,alignItems:'center'}}
                onPress={()=>setScreen('closet')}
              >
                <Text style={{fontSize:19}}>👗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{backgroundColor:'rgba(122,158,159,0.85)',borderRadius:14,
                  paddingVertical:7,paddingHorizontal:11,alignItems:'center'}}
                onPress={()=>setScreen('shop')}
              >
                <Text style={{fontSize:19}}>🏪</Text>
              </TouchableOpacity>
            </View>
            {/* コイン */}
            <View style={{
              backgroundColor:'rgba(74,63,53,0.88)',
              borderRadius:14, paddingVertical:6, paddingHorizontal:10,
              borderWidth:1.5, borderColor:'rgba(201,169,110,0.5)',
            }}>
              <Text style={{fontSize:14,fontWeight:'900',color:'#C9A96E'}}>💰 {dog.coins}</Text>
            </View>
            {/* ポーズ */}
            <TouchableOpacity
              style={{backgroundColor: running ? '#e67e22' : '#8DAA91',borderRadius:20,paddingVertical:5,paddingHorizontal:12}}
              onPress={()=>setRunning(r=>!r)}
            >
              <Text style={{color:'#fff',fontSize:11,fontWeight:'800'}}>{running ? '⏸' : '▶ 再開'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ パネル外タップで閉じるオーバーレイ ══ */}
        {(activeTab !== null || drawerOpen) && (
          <TouchableOpacity
            style={{position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:18}}
            onPress={() => {
              if (activeTab !== null) setActiveTab(null);
              if (drawerOpen) toggleDrawer();
            }}
            activeOpacity={1}
          />
        )}

        {/* ══ CENTER DOG ══ */}
        <View style={{flex:1, alignItems:'center', paddingTop:270, paddingBottom:100}}>
          {/* ステータステキスト（TVの位置に合わせて中央寄り） */}
          <View style={{
            backgroundColor:'rgba(74,63,53,0.82)',
            borderRadius:12, paddingVertical:4, paddingHorizontal:12,
            alignItems:'center', maxWidth:260,
          }}>
            <Text style={{fontSize:12,fontWeight:'800',color:'#F9F7F2',textAlign:'center'}}>
              {emotionIcon} {statusText}
            </Text>
            <Text style={{fontSize:11,color:'#C9A96E',marginTop:3,textAlign:'center'}}>
              行動: {ACTION_JP[dog.currentAction]}
              {dog.isSleeping?`  [${dog.sleepPhase}]`:''}
              {dog.walkingTicksLeft>0?'  🏃散歩中':''}
            </Text>
            {arousalZone!=='normal'&&(
              <Text style={{fontSize:11,marginTop:4,color:arousalZone==='green'?'#8DAA91':'#e74c3c',fontWeight:'700'}}>
                {arousalZone==='green'
                  ? `⚡ Optimal ×${AROUSAL_GREEN_BUFF} バフ中`
                  : `🔴 赤ゾーン — 規律-${Math.round(AROUSAL_RED_PENALTY*100)}%`}
              </Text>
            )}
            {autoModeOn&&(
              <Text style={{fontSize:10,color:'#8DAA91',marginTop:2}}>🤖 自律行動モード ON</Text>
            )}
          </View>

          {/* 大会結果ポップアップ (pending) */}
          {dog.contestPendingResult && (()=>{
            const r = dog.contestPendingResult!;
            const rankEmoji = r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':'🏅';
            const borderColor = r.won ? '#C9A96E' : r.rank<=3 ? '#7A9E9F' : '#8C7B6E';
            return (
              <View style={{
                marginTop:10, backgroundColor:'rgba(249,247,242,0.95)',
                borderRadius:16, padding:16, width:280,
                borderLeftWidth:4, borderLeftColor:borderColor,
              }}>
                <Text style={{fontSize:15,fontWeight:'900',color:r.won?'#C07840':'#4A3F35',marginBottom:6}}>
                  {rankEmoji} 大会結果: 第{r.rank}位 / スコア{r.score}
                </Text>
                <TouchableOpacity
                  style={{backgroundColor:borderColor,borderRadius:20,paddingVertical:8,alignItems:'center'}}
                  onPress={()=>setDog(prev=>({...prev,contestPendingResult:null}))}
                >
                  <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>✓ 確認した</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* 散歩エントリー通知 (contestPending) */}
          {(()=>{
            const totalDaysNow = Math.floor(dog.totalGameMin / GAME_MINUTES_PER_DAY);
            const dayOfMonthNow = (totalDaysNow % CONTEST_CYCLE_DAYS) + 1;
            const currentMonthNow = Math.floor(totalDaysNow / CONTEST_CYCLE_DAYS);
            const isEntryWindow = dayOfMonthNow >= CONTEST_ENTRY_START_DAY && dayOfMonthNow <= CONTEST_ENTRY_END_DAY;
            const alreadyResponded = dog.contestEntryMonth === currentMonthNow;
            if(!isEntryWindow || alreadyResponded) return null;
            const contestTypeIdx = currentMonthNow % 3;
            const nextContestType = contestTypeIdx === 0 ? 'フィジカル' : contestTypeIdx === 1 ? 'ビューティー' : 'ノーズワーク';
            const contestEmoji = contestTypeIdx === 0 ? '🏃' : contestTypeIdx === 1 ? '📸' : '👃';
            return (
              <View style={{
                marginTop:10, backgroundColor:'rgba(249,247,242,0.95)',
                borderRadius:14, padding:12, width:280,
                borderLeftWidth:4, borderLeftColor:'#D4974E',
              }}>
                <Text style={{fontSize:13,fontWeight:'800',color:'#C07840',marginBottom:6}}>
                  {contestEmoji} 来月1日に{nextContestType}開催！エントリー受付中
                </Text>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity
                    style={{flex:1,backgroundColor:'#e67e22',borderRadius:20,paddingVertical:8,alignItems:'center'}}
                    onPress={()=>setDog(prev=>({...prev, contestEntryMonth:currentMonthNow, contestEntered:true,
                      log:addLog(prev.log,`🏆 ${nextContestType}にエントリーした！`)}))}
                  >
                    <Text style={{color:'#fff',fontWeight:'800',fontSize:12}}>✅ エントリー</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{flex:1,backgroundColor:'#C5BDB5',borderRadius:20,paddingVertical:8,alignItems:'center'}}
                    onPress={()=>setDog(prev=>({...prev, contestEntryMonth:currentMonthNow, contestEntered:false,
                      log:addLog(prev.log,'今月の大会はスキップした。')}))}
                  >
                    <Text style={{color:'#fff',fontWeight:'800',fontSize:12}}>⏭ スキップ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* 犬立ち絵（下に配置：背景のベッドの位置に合わせやや下寄り） */}
          <View style={{flex:1, justifyContent:'flex-end', alignItems:'center', paddingBottom:102}}>
            <TouchableOpacity activeOpacity={0.9} onPress={()=>openTab(activeTab === 'care' ? null : 'care')}>
              <Image
                source={getDogImage(dog, dogImageOverride)}
                style={{width:220,height:220,backgroundColor:'transparent'}}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ 夜間バナー ══ */}
        {isNight && (
          <View style={{
            position:'absolute', top:175, left:16, right:16,
            backgroundColor:'rgba(30,20,15,0.88)', borderRadius:14,
            padding:12, alignItems:'center', zIndex:22,
          }}>
            <Text style={{color:'#C9A96E',fontWeight:'800',fontSize:13}}>
              🌙 22:00 就寝時間 — 遊び・訓練・散歩はロック中
            </Text>
            <TouchableOpacity
              style={[styles.skipMorningBtn,{marginTop:8},isNightAnimating&&{opacity:0.5}]}
              onPress={skipToMorning} disabled={isNightAnimating}
            >
              <Text style={styles.skipMorningBtnText}>{isNightAnimating?'🌙 スキップ中...':'☀️ 翌朝までスキップ'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══ ステータス引き出しパネル ══ */}
        <Animated.View style={{
          position:'absolute', left:0, top:0, bottom:0, width:250,
          backgroundColor:'rgba(0,0,0,0.62)',
          borderRightWidth:1, borderRightColor:'rgba(255,255,255,0.10)',
          zIndex:25,
          transform:[{translateX: drawerAnim.interpolate({
            inputRange:[0,1], outputRange:[-250,0]
          })}],
        }}>
          {/* 閉じるボタン */}
          <TouchableOpacity
            style={{position:'absolute',top:10,right:10,zIndex:5,
              backgroundColor:'rgba(255,255,255,0.15)',borderRadius:16,paddingHorizontal:9,paddingVertical:3}}
            onPress={toggleDrawer}
          >
            <Text style={{color:'rgba(255,255,255,0.85)',fontWeight:'800',fontSize:11}}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={{padding:10,paddingTop:36,paddingBottom:32}}>
            {/* ── コンディション ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>コンディション</Text>
            {panelBar('🍖','空腹',dog.hunger,100,'#e67e22')}
            {panelBar('🧼','汚れ',dog.dirtiness,100,'#a0785a')}
            {panelBar('💦','排泄',dog.bladder,100,'#7A9E9F')}
            {panelBar('⚡','興奮',dog.arousal,100,arousalZone==='red'?'#e74c3c':arousalZone==='green'?'#8DAA91':'#D4974E')}
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── メンタル・バイタル ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>メンタル・バイタル</Text>
            {panelBar('😊','幸福感',dog.happiness,100,'#C9A96E')}
            {panelBar('😴','眠気',dog.sleepiness,100,'#7A9E9F')}
            {panelBar('💪','疲労',dog.fatigue,100,'#607d8b')}
            {panelBar('❤️','活力',100-dog.stress,100,dog.stress>60?'#e74c3c':dog.stress>35?'#D4974E':'#8DAA91')}
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── フィジカル ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>フィジカル</Text>
            {panelBar('📐','規律',dog.abilities.physical.discipline,abilityGaugeMax(dog.abilities.physical.discipline),'#7D6E8A')}
            {panelBar('💨','速度',dog.abilities.physical.speed,abilityGaugeMax(dog.abilities.physical.speed),'#7A9E9F')}
            {(()=>{
              const stVal = dog.abilities.physical.stamina;
              const stMax = dog.maxStamina ?? 300;
              const gaugeMax = abilityGaugeMax(stMax);
              return (
                <View key="スタミナ" style={{flexDirection:'row', alignItems:'center', gap:4, marginBottom:5}}>
                  <Text style={{fontSize:11, width:14, textAlign:'center'}}>💪</Text>
                  <Text style={{fontSize:9, color:'rgba(255,255,255,0.65)', width:38, flexShrink:0}}>スタミナ</Text>
                  <View style={{width:13}}/>
                  <View style={{flex:1, height:4, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:2, overflow:'hidden'}}>
                    <View style={{height:'100%', borderRadius:2, backgroundColor:'#8DAA91', width:`${Math.min(100,(stVal/gaugeMax)*100)}%` as any}}/>
                  </View>
                  <Text style={{fontSize:9, color:'rgba(255,255,255,0.5)', width:48, textAlign:'right'}}>{Math.round(stVal)}/{stMax}</Text>
                </View>
              );
            })()}
            {panelBar('🦵','バネ',dog.abilities.physical.spring,abilityGaugeMax(dog.abilities.physical.spring),'#e67e22')}
            {panelBar('🎯','集中力',dog.abilities.physical.focus??0,abilityGaugeMax(dog.abilities.physical.focus??0),'#7D6E8A')}
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── 外見・魅力 ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>外見・魅力</Text>
            {panelBar('✨','毛並み',dog.abilities.beauty.coat,100,'#C96B8A')}
            {panelBar('😊','愛嬌',dog.abilities.beauty.charm,100,'#D4974E')}
            {panelBar('👗','スタイル',styleScore,100,'#7D6E8A')}
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── ポテンシャル ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>ポテンシャル</Text>
            {panelBar('🧠','知性',dog.abilities.intelligence,abilityGaugeMax(dog.abilities.intelligence),'#6B9070')}
            {panelBar('🍀','幸運',effectiveLuck,100,'#8DAA91')}
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── 信頼 ── */}
            <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>信頼</Text>
            {panelBar('🤝','愛着',dog.attachment,100,'#C96B8A')}
            <Text style={{fontSize:9,color:'rgba(255,255,255,0.40)',marginTop:3}}>
              {personalityType}　信頼:{trustLabel}
            </Text>
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>

            {/* ── ライフサイクル ── */}
            {(()=>{
              const lcStage = getLifecycleStage(dog.totalGameMin);
              return (
                <>
                  <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginBottom:5}}>ライフサイクル</Text>
                  {lcStage === 'puppy' && (
                    <>
                      {panelBar('🌱','社会化',dog.socialExp ?? 0,100,'#C96B8A')}
                      <Text style={{fontSize:9,color:'rgba(255,255,255,0.40)',marginTop:2}}>
                        成長係数: ×{(dog.socialMultiplier ?? 1.0).toFixed(2)}
                        {dog.seTransitioned ? ' (確定)' : ' (未確定)'}
                      </Text>
                    </>
                  )}
                  {(lcStage === 'adult' || lcStage === 'senior') && (
                    <>
                      <Text style={{fontSize:9,color:'rgba(255,255,255,0.40)',marginTop:2}}>
                        社会化結果: ×{(dog.socialMultiplier ?? 1.0).toFixed(2)}
                      </Text>
                      {panelBar('🧠','認知能力',dog.cognition ?? 500,1000,'#7A9E9F')}
                    </>
                  )}
                  {lcStage === 'senior' && (
                    <>
                      {panelBar('❤️','寿命',dog.lifespan ?? 1000,1000,'#8C6B9E')}
                      <Text style={{fontSize:9,color:'rgba(255,255,255,0.40)',marginTop:2}}>
                        悟りスロット: {dog.satoriSlotsUnlocked ?? 0}解放
                      </Text>
                    </>
                  )}
                  {/* 悟りスキル */}
                  {(dog.satoriBonuses ?? []).length > 0 && (
                    <>
                      <Text style={{color:'rgba(255,255,255,0.40)',fontSize:9,fontWeight:'800',letterSpacing:1.5,marginTop:6,marginBottom:3}}>悟りスキル</Text>
                      {(dog.satoriBonuses ?? []).map(sid => {
                        const skill = SATORI_SKILLS.find(s => s.id === sid);
                        return skill ? (
                          <Text key={sid} style={{fontSize:10,color:'#D9B8FF',marginBottom:2}}>
                            ✦ {skill.name}　{skill.desc}
                          </Text>
                        ) : null;
                      })}
                    </>
                  )}
                  <View style={{height:1,backgroundColor:'rgba(255,255,255,0.10)',marginVertical:6}}/>
                </>
              );
            })()}

            {/* ── ステータス説明バブル ── */}
            {panelTipBubble}

            {/* セーブ・タイトルボタン */}
            <View style={{flexDirection:'row',gap:6,marginTop:8}}>
              <TouchableOpacity
                style={{flex:1,backgroundColor:'rgba(201,169,110,0.65)',borderRadius:12,paddingVertical:7,alignItems:'center'}}
                onPress={()=>saveGame(0)}
              >
                <Text style={{color:'#fff',fontSize:10,fontWeight:'800'}}>💾 保存</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{flex:1,backgroundColor:'rgba(74,63,53,0.65)',borderRadius:12,paddingVertical:7,alignItems:'center'}}
                onPress={()=>setScreen('title')}
              >
                <Text style={{color:'#fff',fontSize:10,fontWeight:'800'}}>🏠 TOP</Text>
              </TouchableOpacity>
            </View>

            {/* ── 🧪 デバッグ（老犬テスト） ── */}
            <View style={{marginTop:10, gap:6}}>
              <Text style={{fontSize:9,color:'rgba(255,100,100,0.50)',textAlign:'center',letterSpacing:1}}>
                ── 🧪 老犬期テスト ──
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor:'rgba(200,50,50,0.40)', borderRadius:10,
                  paddingVertical:8, alignItems:'center',
                  borderWidth:1, borderColor:'rgba(255,80,80,0.45)',
                }}
                onPress={()=>{
                  setRunning(false);
                  setDog(prev=>({...prev, lifespan:0, pendingDeath:true,
                    log:[`🧪 [DEBUG] 強制終焉を実行`, ...prev.log].slice(0,10)}));
                }}
              >
                <Text style={{color:'#FFB8B8',fontSize:11,fontWeight:'800'}}>⚡ 強制終焉テスト</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor:'rgba(80,80,200,0.40)', borderRadius:10,
                  paddingVertical:8, alignItems:'center',
                  borderWidth:1, borderColor:'rgba(100,100,255,0.45)',
                }}
                onPress={()=>{
                  setDog(prev=>({...prev, lifespan: Math.max(0, (prev.lifespan ?? 150) - 50),
                    log:[`🧪 [DEBUG] 寿命-50 → ${Math.max(0,(prev.lifespan??150)-50)}`, ...prev.log].slice(0,10)}));
                }}
              >
                <Text style={{color:'#B8B8FF',fontSize:11,fontWeight:'800'}}>💉 寿命-50（段階テスト）</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>

        {/* ══ BOTTOM AREA ══ */}
        <View style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20}}>

          {/* アクションパネル（タブに応じて表示） */}
          {activeTab !== null && (
            <View style={{
              backgroundColor:'rgba(249,247,242,0.60)',
              borderTopLeftRadius:24, borderTopRightRadius:24,
              padding:16, paddingBottom:8,
              borderTopWidth:1.5, borderTopColor:'rgba(201,169,110,0.4)',
              maxHeight:320,
            }}>
              <ScrollView showsVerticalScrollIndicator={false}>

              {/* ── ケアパネル ── */}
              {activeTab === 'care' && (
                <>
                  {isActionLocked&&(
                    <Text style={{fontSize:11,color:'#B8AFA6',marginBottom:8,fontStyle:'italic'}}>⏸ ポーズ中 — 時間消費アクションはロックされています</Text>
                  )}
                  <Text style={styles.actionGroupLabel}>── 基本ケア ──</Text>
                  <View style={styles.actionGrid}>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:isActionLocked?'#C5BDB5':'#e67e22'}]}
                      onPress={isActionLocked?undefined:()=>{feed();setActiveTab(null);}} disabled={isActionLocked}>
                      <Text style={styles.actionBtnText}>🍖 餌をやる</Text>
                      <Text style={styles.actionBtnSub}>空腹-45</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn,{backgroundColor:(autoModeOn||isActionLocked)?'#C5BDB5':'#8DAA91'}]}
                      onPress={(autoModeOn||isActionLocked)?undefined:()=>{toilet();setActiveTab(null);}} disabled={autoModeOn||isActionLocked}>
                      <Text style={styles.actionBtnText}>{autoModeOn?'🤖 自律トイレ':'🚽 トイレ'}</Text>
                      <Text style={styles.actionBtnSub}>{autoModeOn?'規律≥700':'排泄-80  愛着+6'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#7A9E9F'}]} onPress={()=>{speak();setActiveTab(null);}}>
                      <Text style={styles.actionBtnText}>📢 声をかける</Text>
                      <Text style={styles.actionBtnSub}>覚醒↑</Text>
                    </TouchableOpacity>
                    {dog.isSleeping&&(
                      <TouchableOpacity style={[styles.actionBtn,{backgroundColor:autoModeOn?'#C5BDB5':'#8C7B6E'}]}
                        onPress={autoModeOn?undefined:()=>{wakeUp();setActiveTab(null);}} disabled={autoModeOn}>
                        <Text style={styles.actionBtnText}>{autoModeOn?'🤖 自律睡眠':'🌅 起こす'}</Text>
                        <Text style={styles.actionBtnSub}> </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.actionGroupLabel,{marginTop:10}]}>── グルーミング ──</Text>
                  <View style={styles.actionGrid}>
                    <SubMenuBtn emoji="✋" title="撫でる" sub="疲労-5  興奮度+5" color="#C96B8A" onPress={()=>{pat();setActiveTab(null);}} disabled={isActionLocked}/>
                    <SubMenuBtn emoji="🪮" title="ブラッシング" sub="汚れ-20  毛並み+5" color="#6B9070" onPress={()=>{brush();setActiveTab(null);}} disabled={isActionLocked}/>
                    <SubMenuBtn emoji="💆" title="マッサージ" sub="疲労-20  興奮-10" color="#7D6E8A" onPress={()=>{massage();setActiveTab(null);}} disabled={isActionLocked}/>
                    <SubMenuBtn emoji="🛁" title="お風呂" sub={isNight?"🌙 夜間ロック":"汚れ-100  毛並み+10"} color="#7A9E9F" onPress={()=>{bath();setActiveTab(null);}} disabled={isActionLocked||isNight}/>
                  </View>
                  {canScold&&(
                    <>
                      <Text style={[styles.actionGroupLabel,{marginTop:10,color:'#c0392b'}]}>── 問題行動対応 ──</Text>
                      <View style={styles.actionGrid}>
                        <TouchableOpacity style={[styles.actionBtn,{backgroundColor:dog.attachment>=50?'#c0392b':'#8C7B6E'}]} onPress={()=>{scold();setActiveTab(null);}}>
                          <Text style={styles.actionBtnText}>🗣️ 叱る</Text>
                          <Text style={styles.actionBtnSub}>{dog.attachment>=50?'信頼◎→鎮静':'信頼低⚠恐怖'}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* ── 遊びパネル ── */}
              {activeTab === 'play' && (
                <>
                  {(isNight||isActionLocked)&&(
                    <Text style={{fontSize:11,color:'#B8AFA6',marginBottom:8,fontStyle:'italic'}}>
                      {isNight?'🌙 夜間ロック':'⏸ ポーズ中'}
                    </Text>
                  )}
                  {dog.abilities.physical.stamina < ACTIVITY_STAMINA_COST_BASE&&(
                    <Text style={{fontSize:11,color:'#e74c3c',marginBottom:8}}>
                      ⚠️ スタミナ不足（{dog.abilities.physical.stamina}/{ACTIVITY_STAMINA_COST_BASE}以上必要）
                    </Text>
                  )}
                  {arousalZone==='red'&&(
                    <Text style={{fontSize:11,color:'#e74c3c',marginBottom:8}}>
                      ⚠️ 興奮過多（赤ゾーン）: 「まて！ゲーム」で興奮度を下げると◎
                    </Text>
                  )}
                  <Text style={styles.actionGroupLabel}>── アクティビティ ──</Text>
                  <View style={styles.actionGrid}>
                    <SubMenuBtn emoji="🪢" title="ひっぱりっこ" sub="規律+8  速度+8  興奮+20" color="#C07840"
                      onPress={()=>{activityRopePull();setActiveTab(null);}} disabled={isActionLocked||isNight||dog.abilities.physical.stamina<ACTIVITY_STAMINA_COST_BASE}/>
                    <SubMenuBtn emoji="🥏" title="フリスビー" sub="バネ+10  興奮+25  ✨上限+1(稀)" color="#e67e22"
                      onPress={()=>{activityFrisbee();setActiveTab(null);}} disabled={isActionLocked||isNight||dog.abilities.physical.stamina<ACTIVITY_STAMINA_COST_BASE}/>
                    <SubMenuBtn emoji="🔍" title="たからさがし" sub="知性+12  集中力+15  興奮-5" color="#7D6E8A"
                      onPress={()=>{activityTreasureHunt();setActiveTab(null);}} disabled={isActionLocked||isNight||dog.abilities.physical.stamina<ACTIVITY_STAMINA_COST_BASE}/>
                    <SubMenuBtn emoji="🤚" title="まて！ゲーム" sub="規律+10  集中力+10  興奮-15" color="#8DAA91"
                      onPress={()=>{activityWaitGame();setActiveTab(null);}} disabled={isActionLocked||isNight||dog.abilities.physical.stamina<ACTIVITY_STAMINA_COST_BASE}/>
                  </View>
                </>
              )}

              {/* ── その他パネル ── */}
              {activeTab === 'other' && (
                <>
                  <Text style={styles.actionGroupLabel}>── メニュー ──</Text>
                  <View style={styles.actionGrid}>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#7D6E8A'}]} onPress={()=>setScreen('familyTree')}>
                      <Text style={styles.actionBtnText}>🌳 家系図</Text>
                      <Text style={styles.actionBtnSub}>世代・子孫</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#8DAA91'}]} onPress={()=>setScreen('collection')}>
                      <Text style={styles.actionBtnText}>📖 図鑑</Text>
                      <Text style={styles.actionBtnSub}>コレクション</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#C9A96E'}]} onPress={()=>setScreen('contestSelect')}>
                      <Text style={styles.actionBtnText}>🏆 大会</Text>
                      <Text style={styles.actionBtnSub}>テスト参加</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#4A3F35'}]} onPress={()=>saveGame(0)}>
                      <Text style={styles.actionBtnText}>💾 セーブ</Text>
                      <Text style={styles.actionBtnSub}>データ保存</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#7A9E9F'}]} onPress={()=>setScreen('title')}>
                      <Text style={styles.actionBtnText}>🏠 タイトル</Text>
                      <Text style={styles.actionBtnSub}>トップへ戻る</Text>
                    </TouchableOpacity>
                  </View>
                  {/* ログ */}
                  <Text style={[styles.actionGroupLabel,{marginTop:10}]}>── 最新ログ ──</Text>
                  <View style={{backgroundColor:'rgba(74,63,53,0.08)',borderRadius:10,padding:8}}>
                    {dog.log.slice(0,5).map((entry,i)=>(
                      <Text key={i} style={[styles.logEntry,i===0&&styles.logEntryLatest,{fontSize:11}]}>{entry}</Text>
                    ))}
                  </View>
                </>
              )}

              </ScrollView>
            </View>
          )}

          {/* ボトムタブバー */}
          <View style={{
            flexDirection:'row',
            backgroundColor:'rgba(74,63,53,0.96)',
            paddingBottom:18, paddingTop:10, paddingHorizontal:4,
            borderTopWidth:1.5, borderTopColor:'rgba(201,169,110,0.35)',
          }}>
            {/* 散歩 */}
            <TouchableOpacity
              style={{flex:1,alignItems:'center',paddingVertical:2}}
              onPress={dog.walkingTicksLeft>0||isNight||isActionLocked||dog.abilities.physical.stamina<WALK_STAMINA_COST?undefined:walk}
              disabled={dog.walkingTicksLeft>0||isNight||isActionLocked||dog.abilities.physical.stamina<WALK_STAMINA_COST}
            >
              <View style={{width:30,height:30,borderRadius:8,alignItems:'center',justifyContent:'center',
                backgroundColor:dog.walkingTicksLeft>0?'rgba(141,170,145,0.35)':isNight||isActionLocked||dog.abilities.physical.stamina<WALK_STAMINA_COST?'rgba(140,123,110,0.2)':'rgba(212,151,78,0.85)',
                marginBottom:2}}>
                <Text style={{fontSize:19}}>🐾</Text>
              </View>
              <Text style={{fontSize:12,fontWeight:'800',marginTop:0,
                color:dog.walkingTicksLeft>0?'#8DAA91':isNight||isActionLocked||dog.abilities.physical.stamina<WALK_STAMINA_COST?'#8C7B6E':'#F9F7F2'}}>
                {dog.walkingTicksLeft>0?'散歩中':isNight?'夜間':'散歩'}
              </Text>
            </TouchableOpacity>

            {/* ケア */}
            <TouchableOpacity
              style={{flex:1,alignItems:'center',paddingVertical:2,
                borderTopWidth:activeTab==='care'?2.5:0,borderTopColor:'#C9A96E',marginTop:activeTab==='care'?-2.5:0}}
              onPress={()=>openTab('care')}
            >
              <Text style={{fontSize:26}}>🪥</Text>
              <Text style={{fontSize:12,fontWeight:'800',marginTop:3,
                color:activeTab==='care'?'#C9A96E':'#F9F7F2'}}>ケア</Text>
            </TouchableOpacity>

            {/* 遊び */}
            <TouchableOpacity
              style={{flex:1,alignItems:'center',paddingVertical:2,
                borderTopWidth:activeTab==='play'?2.5:0,borderTopColor:'#C9A96E',marginTop:activeTab==='play'?-2.5:0}}
              onPress={()=>openTab('play')}
            >
              <Text style={{fontSize:26}}>🦴</Text>
              <Text style={{fontSize:12,fontWeight:'800',marginTop:3,
                color:activeTab==='play'?'#C9A96E':'#F9F7F2'}}>遊び</Text>
            </TouchableOpacity>

            {/* その他 */}
            <TouchableOpacity
              style={{flex:1,alignItems:'center',paddingVertical:2,
                borderTopWidth:activeTab==='other'?2.5:0,borderTopColor:'#C9A96E',marginTop:activeTab==='other'?-2.5:0}}
              onPress={()=>openTab('other')}
            >
              <Text style={{fontSize:26}}>⋯</Text>
              <Text style={{fontSize:12,fontWeight:'800',marginTop:3,
                color:activeTab==='other'?'#C9A96E':'#F9F7F2'}}>その他</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </SafeAreaView>
    </PhoneContainer>
  );
}

// ─────────────────────────────────────────────
// スタイル
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// クローゼット画面コンポーネント（v6 Step3）
// ─────────────────────────────────────────────────────────────────────────

function ClosetScreen({
  dog, onEquip, onUnequip, onBack, onShop, onItemChange,
  feedbackMsg, feedbackAnim, feedbackY, feedbackColor,
}: {
  dog: DogState;
  onEquip: (slot: EquipSlotKey, item: InventoryItem) => void;
  onUnequip: (slot: EquipSlotKey) => void;
  onBack: () => void;
  onShop?: () => void;
  onItemChange?: () => void;
  feedbackMsg: string;
  feedbackAnim: Animated.Value;
  feedbackY: Animated.Value;
  feedbackColor: string;
}) {
  const [selectedSlot, setSelectedSlot] = useState<EquipSlotKey | null>(null);
  const equipment  = dog.equipment ?? emptyEquipment();
  const eqBonuses  = calcEquipmentBonuses(equipment);
  const styleScore = calcStyleScore(equipment);

  // 選択スロットに装備可能なアイテム（インベントリから）
  const compatibleItems: InventoryItem[] = selectedSlot
    ? dog.inventory.filter(item => item.category === slotToCategory(selectedSlot))
    : [];

  const rarityColor = (r: InventoryItem['rarity']) =>
    r==='epic' ? '#7D6E8A' : r==='rare' ? '#7A9E9F' : '#8C7B6E';

  const bonusLabel = (bonuses: ItemBonuses) =>
    Object.entries(bonuses)
      .filter(([, v]) => v)
      .map(([k,v])=>`${
        k==='beauty_coat'?'毛並み':k==='beauty_charm'?'愛嬌':k==='luck'?'幸運':
        k==='discipline'?'規律':k==='speed'?'速度':k==='stamina'?'スタミナ':
        k==='spring'?'バネ':k==='intelligence'?'知性':k==='style'?'スタイル':k
      }+${v}`).join('  ') || 'ボーナスなし';

  return(
    <SafeAreaView style={[styles.safe, {backgroundColor:'#F9F7F2'}]}>
      <StatusBar style="dark"/>

      {/* フローティングフィードバック */}
      {feedbackMsg!==''&&(
        <Animated.View
          style={[styles.floatingFeedback,{opacity:feedbackAnim,transform:[{translateY:feedbackY}]}]}
          pointerEvents="none"
        >
          <Text style={[styles.floatingFeedbackText,{color:feedbackColor}]}>{feedbackMsg}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── ヘッダー */}
        <View style={styles.closetHeader}>
          <TouchableOpacity onPress={onBack} style={styles.closetBackBtn}>
            <Text style={styles.closetBackText}>← メインへ</Text>
          </TouchableOpacity>
          <Text style={styles.closetTitle}>👗 クローゼット</Text>
          {onShop ? (
            <TouchableOpacity style={styles.shopEntryBtn} onPress={onShop}>
              <Text style={styles.shopEntryBtnText}>🏪 Shop</Text>
            </TouchableOpacity>
          ) : <View style={{width:60}}/>}
        </View>

        {/* ── 装備ボーナス */}
        <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#C96B8A',paddingVertical:10}]}>
          <Text style={styles.cardTitle}>🎁 装備ボーナス</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:6}}>
            {[
              ['✨毛並み', eqBonuses.beauty_coat],
              ['😊愛嬌',   eqBonuses.beauty_charm],
              ['🍀幸運',   eqBonuses.luck],
              ['💨速度',   eqBonuses.speed],
              ['💪スタミナ',eqBonuses.stamina],
              ['🦵バネ',   eqBonuses.spring],
              ['📐規律',   eqBonuses.discipline],
              ['🎯集中力', eqBonuses.focus],
              ['🧠知性',   eqBonuses.intelligence],
              ['👗スタイル',eqBonuses.style],
              ['❤️最大スタミナ',eqBonuses.maxStamina],
              ['⏳寿命',   eqBonuses.lifespan],
              ['🔮認知',   eqBonuses.cognition],
            ].filter(([,v])=>Number(v)>0).map(([l,v])=>(
              <View key={String(l)} style={{backgroundColor:'rgba(201,107,138,0.15)',borderRadius:12,paddingHorizontal:8,paddingVertical:3}}>
                <Text style={[styles.meta,{color:'#C96B8A',fontWeight:'700'}]}>{l} +{v}</Text>
              </View>
            ))}
            {Object.values(eqBonuses).every(v=>!v)&&(
              <Text style={styles.meta}>（装備なし — スロットに服を着せましょう）</Text>
            )}
          </View>
        </View>

        {/* ── 背景画像バナー（スタイルスコアと装備スロットの間、左右は画面端に沿わせる） */}
        <View style={{marginHorizontal:-12, height:130, overflow:'hidden', marginBottom:10}}>
          <Image
            source={IMG_BG_CLOSET}
            style={{width:'100%', height:'100%'}}
            resizeMode="cover"
          />
        </View>

        {/* ── 装備スロット 6枠 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧥 装備スロット（タップして装備するアイテムを選ぶ）</Text>
          <View style={styles.slotGrid}>
            {SLOT_DEFS.map(({ key, label, emoji })=>{
              const equipped = equipment[key];
              const isSelected = selectedSlot === key;
              const rc = equipped ? rarityColor(equipped.rarity) : '#C5BDB5';
              return(
                <TouchableOpacity
                  key={key}
                  style={[styles.slotBox, { borderColor: rc }, isSelected && styles.slotBoxSelected]}
                  onPress={()=>setSelectedSlot(isSelected ? null : key)}
                >
                  <Text style={styles.slotEmoji}>{equipped ? '✅' : emoji}</Text>
                  <Text style={styles.slotLabel}>{label}</Text>
                  {equipped ? (
                    <>
                      <Text style={[styles.slotEquippedName,{color:rc}]} numberOfLines={2}>{equipped.name}</Text>
                      <TouchableOpacity
                        style={styles.slotUnequipBtn}
                        onPress={e=>{ e.stopPropagation?.(); onUnequip(key); setSelectedSlot(null); onItemChange?.(); }}
                      >
                        <Text style={styles.slotUnequipText}>✕外す</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.slotEmpty}>空き</Text>
                  )}
                  {isSelected&&<View style={styles.slotSelectIndicator}/>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 装備選択パネル（スロット選択時） */}
        {selectedSlot&&(
          <View style={[styles.card,{borderLeftWidth:3,borderLeftColor:'#7A9E9F'}]}>
            <Text style={styles.cardTitle}>
              🎒 {SLOT_DEFS.find(s=>s.key===selectedSlot)?.label}に装備するアイテムを選択
            </Text>
            {compatibleItems.length===0 ? (
              <Text style={styles.meta}>
                このカテゴリのアイテムがありません。散歩に行くと小物が手に入ります！
              </Text>
            ) : (
              compatibleItems.map(item=>{
                const isEquipped = Object.values(equipment).some(e=>e?.id===item.id);
                const rc = rarityColor(item.rarity);
                return(
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.invItemRow,{borderLeftColor:rc,opacity:isEquipped?0.6:1}]}
                    onPress={()=>{ if(!isEquipped){ onEquip(selectedSlot!, item); setSelectedSlot(null); onItemChange?.(); }}}
                  >
                    <View style={[styles.itemRarityBadge,{backgroundColor:rc}]}>
                      <Text style={styles.itemRarityText}>{item.rarity.toUpperCase()}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[styles.itemName,{color:rc}]}>
                        {item.name}{isEquipped?' （装備済み）':''}
                      </Text>
                      <Text style={styles.itemBonuses}>{bonusLabel(item.bonuses)}</Text>
                      <Text style={[styles.itemBonuses,{color:'#C5BDB5',fontStyle:'italic'}]} numberOfLines={1}>
                        {item.flavorText}
                      </Text>
                    </View>
                    {!isEquipped&&(
                      <Text style={{fontSize:18,color:rc,marginLeft:4}}>▶</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ── インベントリ全一覧（独立スクロール） */}
        <View style={[styles.card,{paddingBottom:0}]}>
          <Text style={styles.cardTitle}>🎒 所持アイテム一覧（{dog.inventory.length} 件）</Text>
          {dog.inventory.length===0 ? (
            <Text style={[styles.meta,{marginBottom:14}]}>まだアイテムがありません。散歩に出かけましょう！</Text>
          ) : (
            <ScrollView
              style={{maxHeight:340}}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{paddingBottom:14}}
            >
              {[...dog.inventory].reverse().map(item=>{
                const isEquipped = Object.values(equipment).some(e=>e?.id===item.id);
                const equippedSlot = isEquipped
                  ? Object.entries(equipment).find(([,e])=>e?.id===item.id)?.[0]
                  : null;
                const rc = rarityColor(item.rarity);
                return(
                  <View key={item.id} style={[styles.invItemRow,{borderLeftColor:rc}]}>
                    <View style={[styles.itemRarityBadge,{backgroundColor:rc}]}>
                      <Text style={styles.itemRarityText}>{item.rarity.toUpperCase()}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[styles.itemName,{color:rc}]}>
                        {item.name}
                        {isEquipped&&<Text style={{fontSize:10,color:'#8DAA91'}}>  ✓{SLOT_DEFS.find(s=>s.key===equippedSlot)?.label}装備中</Text>}
                      </Text>
                      <Text style={styles.itemBonuses}>{bonusLabel(item.bonuses)}</Text>
                      <Text style={[styles.itemBonuses,{color:'#C5BDB5',fontStyle:'italic'}]} numberOfLines={1}>
                        {item.flavorText}
                      </Text>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                      <Text style={[styles.meta,{marginBottom:0}]}>
                        {item.source==='walk'?'🦮散歩':'🏪ショップ'}
                      </Text>
                      {isEquipped&&(
                        <TouchableOpacity
                          style={[styles.slotUnequipBtn,{marginTop:4}]}
                          onPress={()=>{ onUnequip(equippedSlot as EquipSlotKey); onItemChange?.(); }}
                        >
                          <Text style={styles.slotUnequipText}>✕外す</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 散歩目的地選択モーダル
// ─────────────────────────────────────────────────────────────────────────

function DestinationPickerModal({
  dog,
  visible,
  onSelect,
  onDateSelect,
  onCancel,
}: {
  dog: DogState;
  visible: boolean;
  onSelect: (dest: WalkDestination) => void;
  onDateSelect: (dest: WalkDestination) => void;
  onCancel: () => void;
}) {
  const [mapLayout, setMapLayout] = React.useState<{width:number;height:number}|null>(null);
  const [showDateMode, setShowDateMode] = React.useState(false);

  if(!visible) return null;

  // 地図上のタッチエリア（左上原点、比率で指定）
  const DEST_ZONES: Record<WalkDestination, {x:number;y:number;w:number;h:number;label:string;emoji:string;color:string}> = {
    city:    {x:0.05,y:0.05,w:0.42,h:0.40,label:'市街地',  emoji:'🏙️',color:'#7A9E9F'},
    park:    {x:0.55,y:0.05,w:0.42,h:0.40,label:'公園',    emoji:'🌳',color:'#8DAA91'},
    beach:   {x:0.55,y:0.55,w:0.42,h:0.38,label:'海辺',    emoji:'🏖️',color:'#D4974E'},
    mountain:{x:0.05,y:0.55,w:0.42,h:0.38,label:'山道',    emoji:'⛰️',color:'#795548'},
    secret:  {x:0.36,y:0.36,w:0.28,h:0.28,label:'秘密の集い',emoji:'✨',color:'#7D6E8A'},
  };

  const destinations: WalkDestination[] = ['city','park','beach','mountain'];
  if(dog.hasSecretInfo) destinations.push('secret');

  return (
    <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:999}}>
      {/* 地図画像（全画面） */}
      <Image
        source={IMG_MAP_FULLSCREEN}
        style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}
        resizeMode="cover"
        onLayout={e=>setMapLayout({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})}
      />
      {/* 半透明オーバーレイ（上部タイトル用） */}
      <View style={{position:'absolute',top:0,left:0,right:0,paddingTop:48,paddingBottom:12,paddingHorizontal:16,
        backgroundColor:'rgba(0,0,0,0.55)'}}>
        <Text style={{color:'#fff',fontSize:18,fontWeight:'800',textAlign:'center'}}>
          🐾 散歩の目的地を選ぼう
        </Text>
        <Text style={{color:'rgba(255,255,255,0.7)',fontSize:11,textAlign:'center',marginTop:2}}>
          スタミナ: {dog.abilities.physical.stamina} / 1000　{showDateMode && dog.mate ? '💞 デートモード' : ''}
        </Text>
      </View>

      {/* 各目的地タッチエリア */}
      {mapLayout && destinations.map(dest => {
        const z = DEST_ZONES[dest];
        return (
          <TouchableOpacity
            key={dest}
            style={{
              position:'absolute',
              left: mapLayout.width * z.x,
              top:  mapLayout.height * z.y,
              width: mapLayout.width * z.w,
              height: mapLayout.height * z.h,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: z.color,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={()=>{
              if(showDateMode && dog.mate) onDateSelect(dest);
              else onSelect(dest);
            }}
          >
            <Text style={{fontSize: dest==='secret'?22:28}}>{z.emoji}</Text>
            <Text style={{color:'#fff',fontWeight:'800',fontSize:12,
              textShadowColor:'rgba(0,0,0,0.8)',textShadowOffset:{width:1,height:1},textShadowRadius:3}}>
              {z.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* 秘密の集いがロック中 */}
      {!dog.hasSecretInfo && mapLayout && (()=>{
        const z = DEST_ZONES.secret;
        return (
          <View style={{
            position:'absolute',
            left: mapLayout.width * z.x, top: mapLayout.height * z.y,
            width: mapLayout.width * z.w, height: mapLayout.height * z.h,
            borderRadius:12, borderWidth:2, borderColor:'#B8AFA6',
            backgroundColor:'rgba(0,0,0,0.35)', alignItems:'center', justifyContent:'center',
          }}>
            <Text style={{fontSize:22}}>🔒</Text>
            <Text style={{color:'rgba(255,255,255,0.6)',fontSize:10,textAlign:'center',paddingHorizontal:4}}>
              他の犬から情報を聞き出すと解放
            </Text>
          </View>
        );
      })()}

      {/* 下部: デートボタン + キャンセル */}
      <View style={{position:'absolute',bottom:0,left:0,right:0,
        backgroundColor:'rgba(0,0,0,0.55)',paddingBottom:32,paddingHorizontal:16,paddingTop:12,
        flexDirection:'row',gap:10}}>
        {dog.mate !== null && (
          <TouchableOpacity
            style={{flex:1,borderRadius:20,paddingVertical:10,alignItems:'center',
              backgroundColor: showDateMode ? '#C96B8A' : 'rgba(201,107,138,0.3)',
              borderWidth:1.5,borderColor:'#C96B8A'}}
            onPress={()=>setShowDateMode(v=>!v)}
          >
            <Text style={{color:'#fff',fontWeight:'800',fontSize:12}}>
              {showDateMode ? '💞 デートモード ON' : `💞 ${dog.mate.name}をデートに誘う`}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={{flex:1,borderRadius:20,paddingVertical:10,alignItems:'center',
            backgroundColor:'rgba(100,100,100,0.6)',borderWidth:1,borderColor:'rgba(255,255,255,0.3)'}}
          onPress={onCancel}
        >
          <Text style={{color:'#fff',fontWeight:'700',fontSize:13}}>✕ キャンセル</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 散歩画面コンポーネント（v7）
// ─────────────────────────────────────────────────────────────────────────

const NPC_STATE_LABELS: Record<NpcMeetupState, string> = {
  aggressive: '毛を逆立て、直視している（威嚇）🦷',
  playbow:    '前足を下げ、お尻を上げている（プレイボウ）🎉',
  explore:    'あちこちの匂いを嗅いでいる（探索）👃',
  anxious:    '耳を伏せ、体を低くしている（不安）😰',
};

function WalkScreen({
  dog, onBack, onSoothe, onPlayTogether, onSniff, onSelfHandicap, onPassBy, onBye, onAgain, onContinue, onEventDismiss,
  feedbackMsg, feedbackAnim, feedbackY, feedbackColor,
}: {
  dog: DogState;
  onBack:          () => void;
  onSoothe:        () => void;
  onPlayTogether:  () => void;
  onSniff:         () => void;
  onSelfHandicap:  () => void;
  onPassBy:        () => void;
  onBye:           () => void;
  onAgain:         () => void;
  onContinue:      () => void;
  onEventDismiss:  () => void;
  feedbackMsg: string;
  feedbackAnim: Animated.Value;
  feedbackY: Animated.Value;
  feedbackColor: string;
}) {
  const isLoopDone = dog.walkingTicksLeft === 0;
  const hasMeetup  = dog.walkMeetup !== null && dog.walkMeetup.phase !== 'done';
  const meetup     = dog.walkMeetup;
  const progress   = isLoopDone ? 1 : (WALK_DIRT_TICKS - dog.walkingTicksLeft) / WALK_DIRT_TICKS;
  const canContinue = isLoopDone && !hasMeetup
    && dog.abilities.physical.stamina >= WALK_STAMINA_CONTINUE_MIN
    && (dog.dayTimeMin ?? 0) < NIGHT_START_MIN;

  const npcIntimacyBar = (v: number) => (
    <View style={{height:6,backgroundColor:'#F0EDE7',borderRadius:3,marginTop:4,overflow:'hidden'}}>
      <View style={{height:'100%',borderRadius:3,backgroundColor:'#C96B8A',width:`${v}%`}}/>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark"/>
      {feedbackMsg !== '' && (
        <Animated.View
          style={[styles.floatingFeedback,{opacity:feedbackAnim,transform:[{translateY:feedbackY}]}]}
          pointerEvents="none"
        >
          <Text style={[styles.floatingFeedbackText,{color:feedbackColor}]}>{feedbackMsg}</Text>
        </Animated.View>
      )}
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── 行先イメージ ── */}
        {dog.walkDestination && (
          <View style={{height:180, overflow:'hidden', marginHorizontal:-12, marginTop:-12, marginBottom:12}}>
            <Image
              source={
                dog.walkDestination === 'city'     ? IMG_BG_TOWN  :
                dog.walkDestination === 'park'     ? IMG_BG_PARK  :
                dog.walkDestination === 'beach'    ? IMG_BG_BEACH :
                IMG_BG_TRAIL
              }
              style={{width:'100%', height:'100%'}}
              resizeMode="cover"
            />
            <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(0,0,0,0.20)'}} pointerEvents="none"/>
            <View style={{position:'absolute',bottom:10,left:16}}>
              <Text style={{fontSize:20,fontWeight:'900',color:'#fff',
                textShadowColor:'rgba(0,0,0,0.8)',textShadowOffset:{width:0,height:1},textShadowRadius:4}}>
                {dog.walkDestination === 'city'     ? '🏙️ 街'   :
                 dog.walkDestination === 'park'     ? '🌳 公園' :
                 dog.walkDestination === 'beach'    ? '🏖️ 海岸' : '🌲 山道'}
              </Text>
              <Text style={{fontSize:12,color:'rgba(255,255,255,0.85)',marginTop:2,
                textShadowColor:'rgba(0,0,0,0.6)',textShadowOffset:{width:0,height:1},textShadowRadius:3}}>
                {isLoopDone ? '🎉 散歩完了！' : `🏃 散歩中… ${Math.round(progress*100)}%`}
              </Text>
            </View>
          </View>
        )}

        {/* ── 進捗ヘッダー ── */}
        <View style={[styles.card,{backgroundColor:'#D5E8E8',borderLeftWidth:4,borderLeftColor:'#7A9E9F'}]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <Text style={{fontSize:32}}>{isLoopDone?'🏠':'🐾'}</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:16,fontWeight:'800',color:'#4A3F35'}}>
                {isLoopDone ? '散歩完了🎉' : '散歩中…🏃'}
                {'  '}
                <Text style={{fontSize:11,color:'#8C7B6E'}}>
                  {dog.walkLoopCount ?? 0}周目
                </Text>
              </Text>
              <Text style={{fontSize:11,color:'#8C7B6E',marginTop:2}}>
                スタミナ {dog.abilities.physical.stamina} / 1000
                {isLoopDone && !hasMeetup ? '  → 続けますか？' : hasMeetup && !isLoopDone ? '  🐕 犬と出会った！' : ''}
              </Text>
            </View>
          </View>
          <View style={{marginTop:10}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:3}}>
              <Text style={{fontSize:11,color:'#4A3F35',fontWeight:'600'}}>散歩進捗</Text>
              <Text style={{fontSize:11,color:'#4A3F35',fontWeight:'700'}}>{Math.round(progress*100)}%</Text>
            </View>
            <View style={{height:14,backgroundColor:'#F0EDE7',borderRadius:7,overflow:'hidden'}}>
              <View style={{height:'100%',borderRadius:7,
                backgroundColor: isLoopDone ? '#8DAA91' : '#7A9E9F',
                width:`${Math.round(progress*100)}%`}}/>
            </View>
          </View>
        </View>

        {/* ── うんちデバフ ── */}
        {dog.poopDebuff && (
          <View style={[styles.card,{backgroundColor:'#fff9e6',borderLeftWidth:4,borderLeftColor:'#D4974E'}]}>
            <Text style={{fontSize:12,fontWeight:'700',color:'#C07840'}}>
              💩 うんちデバフ中  幸運-{POOP_LUCK_PENALTY}
              {'  '}残り{dog.poopDebuffWalksLeft}回or風呂で解除
            </Text>
          </View>
        )}

        {/* ══ ミートアップ UI ══ */}
        {hasMeetup && meetup && (

          <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#C96B8A',backgroundColor:'#fdf0f8'}]}>
            {/* NPC情報 */}
            <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
              <Text style={{fontSize:32}}>{meetup.npc.gender==='male'?'🐶':'🐩'}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:15,fontWeight:'800',color:'#c0392b'}}>
                  {meetup.npc.name} <Text style={{fontWeight:'400',fontSize:11,color:'#8C7B6E'}}>({meetup.npc.breed})</Text>
                </Text>
                <Text style={{fontSize:11,color:'#8C7B6E'}}>
                  {meetup.npc.gender==='male'?'オス':'メス'}  遭遇{meetup.npc.metCount}回目
                </Text>
                <Text style={{fontSize:11,color:'#C96B8A',fontWeight:'700'}}>
                  親密度 {meetup.npc.intimacy}/100
                </Text>
                {npcIntimacyBar(meetup.npc.intimacy)}
                {meetup.npc.intimacy >= MATE_INTIMACY_THRESHOLD && meetup.npc.gender !== dog.gender && !dog.mate && (
                  <Text style={{fontSize:11,color:'#C96B8A',fontWeight:'700',marginTop:3}}>
                    💞 番登録が可能です！
                  </Text>
                )}
              </View>
            </View>

            {/* phase: encounter — NPC様子 + 5択 */}
            {meetup.phase === 'encounter' && (
              <>
                {/* NPC の様子表示 */}
                <View style={{backgroundColor:'#F5EDD5',borderRadius:8,padding:8,marginBottom:10}}>
                  <Text style={{fontSize:13,fontWeight:'700',color:'#856404'}}>
                    📍 {meetup.npc.name}の様子:
                  </Text>
                  <Text style={{fontSize:12,color:'#533f03',marginTop:2}}>
                    {NPC_STATE_LABELS[meetup.npcState]}
                  </Text>
                </View>
                <Text style={{fontSize:12,color:'#8C7B6E',marginBottom:8}}>
                  どうする？（様子に合った行動をすると特別な効果が得られる）
                </Text>
                <View style={{gap:6}}>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#e74c3c'}]} onPress={onSoothe}>
                    <Text style={styles.btnText}>😌 なだめる（目をそらす）</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#C96B8A'}]} onPress={onPlayTogether}>
                    <Text style={styles.btnText}>⚡ 一緒に遊ぶ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#7D6E8A'}]} onPress={onSniff}>
                    <Text style={styles.btnText}>👃 嗅ぎ合う</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#8DAA91'}]} onPress={onSelfHandicap}>
                    <Text style={styles.btnText}>🤗 優しく接する（セルフハンディキャップ）</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#C5BDB5'}]} onPress={onPassBy}>
                    <Text style={styles.btnText}>🚶 横を通り過ぎる</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* phase: react — 行動結果 */}
            {meetup.phase === 'react' && (
              <>
                <View style={{backgroundColor:'#F0EDE7',borderRadius:8,padding:10,marginBottom:10}}>
                  <Text style={{fontSize:13,color:'#6B9070',lineHeight:18}}>
                    {meetup.rewardLog}
                  </Text>
                </View>
                {meetup.giftItem && (
                  <View style={{backgroundColor:'#F9F7F2',borderRadius:8,padding:8,marginBottom:8}}>
                    <Text style={{fontSize:12,fontWeight:'700',color:'#C07840'}}>
                      🎁 {meetup.npc.name}から「{meetup.giftItem.name}」をもらった！
                    </Text>
                    <Text style={{fontSize:11,color:'#8C7B6E'}}>{meetup.giftItem.flavorText}</Text>
                  </View>
                )}
                <Text style={{fontSize:13,color:'#4A3F35',marginBottom:10}}>
                  {meetup.npc.name}との別れ際…
                </Text>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#8DAA91',flex:1}]} onPress={onAgain}>
                    <Text style={styles.btnText}>
                      {meetup.npc.intimacy >= MATE_INTIMACY_THRESHOLD && meetup.npc.gender !== dog.gender && !dog.mate
                        ? '💞 番になる' : '💕 またね！'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#C5BDB5',flex:1}]} onPress={onBye}>
                    <Text style={styles.btnText}>👋 バイバイ</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* phase: farewell (legacy, keep for compatibility) */}
            {meetup.phase === 'farewell' && (
              <>
                {meetup.giftItem && (
                  <View style={{backgroundColor:'#F9F7F2',borderRadius:8,padding:8,marginBottom:8}}>
                    <Text style={{fontSize:12,fontWeight:'700',color:'#C07840'}}>
                      🎁 {meetup.npc.name}から「{meetup.giftItem.name}」をもらった！
                    </Text>
                    <Text style={{fontSize:11,color:'#8C7B6E'}}>{meetup.giftItem.flavorText}</Text>
                  </View>
                )}
                <Text style={{fontSize:13,color:'#4A3F35',marginBottom:10}}>
                  {meetup.npc.name}との別れ際…
                </Text>
                <View style={{flexDirection:'row',gap:8}}>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#8DAA91',flex:1}]} onPress={onAgain}>
                    <Text style={styles.btnText}>💕 またね！</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn,{backgroundColor:'#C5BDB5',flex:1}]} onPress={onBye}>
                    <Text style={styles.btnText}>👋 バイバイ</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── ループ完了後アクション（ミートアップなし or done）── */}
        {isLoopDone && !hasMeetup && (
          <View style={[styles.card,{backgroundColor:'#F0EDE7',borderLeftWidth:4,borderLeftColor:'#8DAA91'}]}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#6B9070',marginBottom:8}}>
              🐾 このループ完了！どうする？
            </Text>
            <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
              {canContinue && (
                <TouchableOpacity style={[styles.btn,{backgroundColor:'#7A9E9F',flex:1}]} onPress={onContinue}>
                  <Text style={styles.btnText}>🏃 散歩を続ける</Text>
                  <Text style={{color:'rgba(255,255,255,0.8)',fontSize:9,marginTop:1}}>
                    スタミナ-{WALK_STAMINA_COST}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.btn,styles.btnStart,{flex:1}]} onPress={onBack}>
                <Text style={styles.btnText}>🏠 帰宅する</Text>
              </TouchableOpacity>
            </View>
            {!canContinue && dog.abilities.physical.stamina < WALK_STAMINA_CONTINUE_MIN && (
              <Text style={{fontSize:11,color:'#e74c3c',marginTop:6}}>
                ⚠️ スタミナ不足（{dog.abilities.physical.stamina}/{WALK_STAMINA_CONTINUE_MIN}）
              </Text>
            )}
            {(dog.dayTimeMin ?? 0) >= NIGHT_START_MIN && (
              <Text style={{fontSize:11,color:'#e74c3c',marginTop:6}}>
                🌙 22:00 — 強制帰宅
              </Text>
            )}
          </View>
        )}

        {/* ── 散歩イベントメッセージ ── */}
        {!!dog.walkStrollEventMsg && (
          <TouchableOpacity
            activeOpacity={dog.walkStrollEventPending ? 0.7 : 1}
            onPress={dog.walkStrollEventPending ? onEventDismiss : undefined}
            style={{
              backgroundColor:'rgba(245,228,175,0.97)',
              borderRadius:12,
              borderWidth:1.5,
              borderColor:'rgba(180,140,80,0.80)',
              padding:12,
              marginBottom:8,
            }}
          >
            <Text style={{fontSize:11,fontWeight:'800',color:'#7C5C2E',marginBottom:4}}>🌟 散歩イベント</Text>
            <Text style={{fontSize:12,color:'#4A3F35',lineHeight:18}}>{dog.walkStrollEventMsg}</Text>
            {!!dog.walkStrollEventStats && (
              <Text style={{fontSize:11,color:'#6B4E2A',marginTop:6,lineHeight:16}}>{dog.walkStrollEventStats}</Text>
            )}
            {dog.walkStrollEventPending && (
              <Text style={{fontSize:10,color:'#8C6B3E',marginTop:8,textAlign:'center',fontWeight:'700'}}>
                タップして散歩を再開
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── 散歩ログ ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🗒️ 散歩ログ</Text>
          {dog.walkEventLog.length === 0
            ? <Text style={styles.meta}>{isLoopDone ? '特にイベントなし' : '散歩中…'}</Text>
            : [...dog.walkEventLog].reverse().map((e,i) => (
                <Text key={i} style={[styles.logEntry, i===0 && styles.logEntryLatest]}>{e}</Text>
              ))
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ショップ画面コンポーネント（v7）
// ─────────────────────────────────────────────────────────────────────────

function ShopScreen({
  dog, onBuy, onSell, onBack, onCloset,
  feedbackMsg, feedbackAnim, feedbackY, feedbackColor,
}: {
  dog: DogState;
  onBuy: (item: ShopItem) => void;
  onSell: (item: InventoryItem) => void;
  onBack: () => void;
  onCloset?: () => void;
  feedbackMsg: string;
  feedbackAnim: Animated.Value;
  feedbackY: Animated.Value;
  feedbackColor: string;
}) {
  const [tab, setTab] = useState<'buy'|'sell'>('buy');
  const [shopCat, setShopCat] = useState<'all'|'consumable'|'outfit'|'hat'|'shoes'|'accessory'>('all');

  const rarityColor: Record<string,string> = {common:'#8C7B6E', rare:'#7A9E9F', epic:'#7D6E8A', legendary:'#B8860B'};
  const rarityLabel: Record<string,string> = {common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY'};

  const sellPriceOf = (r: string) =>
    r === 'legendary' ? 100 : r === 'epic' ? 35 : r === 'rare' ? 18 : 8;

  const bonusStr = (bonuses: ItemBonuses) =>
    Object.entries(bonuses)
      .map(([k,v]) => `${
        k==='beauty_coat'?'毛並み':k==='beauty_charm'?'愛嬌':
        k==='luck'?'幸運':k==='discipline'?'規律':
        k==='speed'?'速度':k==='stamina'?'スタミナ':
        k==='spring'?'バネ':k==='intelligence'?'知性':k==='style'?'スタイル':k
      }+${v}`)
      .join('  ');

  const filterBuyItems = (items: ShopItem[]) => {
    if (shopCat === 'all') return items;
    if (shopCat === 'consumable') return items.filter(i => i.category === 'food' || i.category === 'shampoo');
    return items.filter(i => i.category === 'equipment' && i.subCategory === shopCat);
  };

  const catButtons: {key: typeof shopCat; label: string}[] = [
    {key:'all',       label:'すべて'},
    {key:'consumable',label:'消費'},
    {key:'outfit',    label:'服'},
    {key:'hat',       label:'帽子'},
    {key:'shoes',     label:'靴'},
    {key:'accessory', label:'小物'},
  ];

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor:'#F9F7F2'}]}>
      <StatusBar style="dark"/>
      {feedbackMsg !== '' && (
        <Animated.View
          style={[styles.floatingFeedback,{opacity:feedbackAnim,transform:[{translateY:feedbackY}]}]}
          pointerEvents="none"
        >
          <Text style={[styles.floatingFeedbackText,{color:feedbackColor}]}>{feedbackMsg}</Text>
        </Animated.View>
      )}

      {/* ── ヘッダー ── */}
      <View style={[styles.closetHeader,{marginHorizontal:12,marginTop:4}]}>
        <TouchableOpacity style={styles.closetBackBtn} onPress={onBack}>
          <Text style={styles.closetBackText}>← メインへ</Text>
        </TouchableOpacity>
        <Text style={[styles.closetTitle,{color:'#D4974E'}]}>🏪 ショップ</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Text style={{fontSize:13,fontWeight:'700',color:'#4A3F35'}}>💰{dog.coins}</Text>
          {onCloset && (
            <TouchableOpacity style={styles.closetEntryBtn} onPress={onCloset}>
              <Text style={styles.closetEntryBtnText}>👗</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── 背景画像（購入/売却ボタンの上） ── */}
      <Image
        source={IMG_BG_SHOP}
        style={{width:'100%', height:160}}
        resizeMode="cover"
      />

      {/* ── 購入/売却 タブ ── */}
      <View style={{flexDirection:'row',gap:8,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#F9F7F2'}}>
        <TouchableOpacity
          style={[styles.btn, tab==='buy'?{backgroundColor:'#D4974E'}:{backgroundColor:'#F0EDE7'}]}
          onPress={()=>setTab('buy')}
        >
          <Text style={[styles.btnText, tab==='buy'?{}:{color:'#4A3F35'}]}>🛒 購入</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, tab==='sell'?{backgroundColor:'#e74c3c'}:{backgroundColor:'#F0EDE7'}]}
          onPress={()=>setTab('sell')}
        >
          <Text style={[styles.btnText, tab==='sell'?{}:{color:'#4A3F35'}]}>💴 売却</Text>
        </TouchableOpacity>
      </View>

      {/* ── カテゴリフィルター（購入タブのみ） ── */}
      {tab === 'buy' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{backgroundColor:'#F9F7F2'}}
          contentContainerStyle={{paddingHorizontal:12,paddingBottom:8,gap:6,flexDirection:'row'}}
        >
          {catButtons.map(({key, label}) => (
            <TouchableOpacity
              key={key}
              onPress={() => setShopCat(key)}
              style={{
                paddingHorizontal:12, paddingVertical:5, borderRadius:14,
                backgroundColor: shopCat===key ? '#D4974E' : '#E8E2D8',
              }}
            >
              <Text style={{fontSize:11, fontWeight:'700', color: shopCat===key ? '#fff' : '#4A3F35'}}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── アイテムリスト（スクロール） ── */}
      <ScrollView contentContainerStyle={{padding:12,paddingBottom:40}}>

        {/* 購入タブ */}
        {tab==='buy' && (()=>{
          const lcStage = getLifecycleStage(dog.totalGameMin);
          const phaseFiltered = SHOP_CATALOG.filter(item => {
            if (!item.phases) return true;
            return item.phases[lcStage] === true;
          });
          const catFiltered = filterBuyItems(phaseFiltered);
          if (catFiltered.length === 0) {
            return (
              <Text style={[styles.meta,{textAlign:'center',marginTop:20}]}>
                このカテゴリのアイテムはありません
              </Text>
            );
          }
          return catFiltered.map(item => (
            <View key={item.id}
              style={[styles.card,{borderLeftWidth:4,borderLeftColor:rarityColor[item.rarity]}]}>
              <View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}>
                <View>
                  <View style={[styles.itemRarityBadge,{backgroundColor:rarityColor[item.rarity],marginRight:0}]}>
                    <Text style={styles.itemRarityText}>{rarityLabel[item.rarity]}</Text>
                  </View>
                  {item.category==='food'&&<Text style={{fontSize:20,marginTop:4}}>🍖</Text>}
                  {item.category==='shampoo'&&<Text style={{fontSize:20,marginTop:4}}>🛁</Text>}
                  {item.category==='equipment'&&<Text style={{fontSize:20,marginTop:4}}>👗</Text>}
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemBonuses}>{item.description}</Text>
                  <Text style={styles.meta}>{item.flavorText}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.btn,{
                    backgroundColor: dog.coins>=item.cost?'#D4974E':'#C5BDB5',
                    marginRight:0,paddingHorizontal:12,
                  }]}
                  onPress={()=>onBuy(item)}
                  disabled={dog.coins<item.cost}
                >
                  <Text style={styles.btnText}>💰{item.cost}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ));
        })()}

        {/* 売却タブ */}
        {tab==='sell' && (
          dog.inventory.length===0
          ? <Text style={[styles.meta,{textAlign:'center',marginTop:20}]}>
              売却できるアイテムがありません
            </Text>
          : dog.inventory.map(item => {
              const price = sellPriceOf(item.rarity);
              return (
                <View key={item.id}
                  style={[styles.card,{borderLeftWidth:4,borderLeftColor:rarityColor[item.rarity]}]}>
                  <View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}>
                    <View style={[styles.itemRarityBadge,{backgroundColor:rarityColor[item.rarity],marginRight:0}]}>
                      <Text style={styles.itemRarityText}>{rarityLabel[item.rarity]}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemBonuses}>{bonusStr(item.bonuses)}</Text>
                      <Text style={styles.meta}>{item.flavorText}</Text>
                      <Text style={[styles.meta,{color:'#e67e22'}]}>
                        入手: {item.source==='walk'?'散歩':item.source==='shop'?'ショップ':'イベント'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.btn,{backgroundColor:'#e74c3c',marginRight:0,paddingHorizontal:12}]}
                      onPress={()=>onSell(item)}
                    >
                      <Text style={styles.btnText}>💴{price}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// 名前入力画面（「最初から始める」後）
// ─────────────────────────────────────────────────────────────────────────

function NameEntryScreen({ onComplete }: { onComplete: (name: string, breed: string) => void }) {
  type Phase = 'narration1' | 'breedSelect' | 'confirm' | 'nameInput';
  const [phase, setPhase]       = React.useState<Phase>('narration1');
  const [breedIndex, setBreedIndex] = React.useState(0);
  const [selectedBreed, setSelectedBreed] = React.useState('');
  const [nameText, setNameText] = React.useState('');

  const currentBreed = BREED_DEFS[breedIndex];

  const windowBox: any = {
    backgroundColor:'rgba(245,228,175,0.96)',
    borderRadius:16, padding:24,
    borderWidth:2, borderColor:'rgba(180,140,80,0.7)',
    maxWidth:320, width:'100%',
    alignItems:'center',
  };

  const handleSubmit = () => {
    const n = nameText.trim();
    if(n.length === 0) return;
    onComplete(n, selectedBreed);
  };

  const prevBreed = () => setBreedIndex((breedIndex - 1 + BREED_DEFS.length) % BREED_DEFS.length);
  const nextBreed = () => setBreedIndex((breedIndex + 1) % BREED_DEFS.length);

  return (
    <ImageBackground
      source={require('./Images/Mein_image_0.png')}
      style={{flex:1}}
      resizeMode="cover"
    >
      <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16}}>

        {/* ── Phase 1: ナレーション ── */}
        {phase === 'narration1' && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={()=>setPhase('breedSelect')}
            style={windowBox}
          >
            <Text style={{fontSize:15, color:'#4A3F35', lineHeight:26, textAlign:'center', fontWeight:'600'}}>
              {'今日も新しい一日が始まる。\n寝ぼけた目を擦りながら、\n生後３か月を迎えたばかりの\n無邪気な愛犬に声をかけた。'}
            </Text>
            <Text style={{fontSize:10, color:'#8C6B3E', marginTop:16, fontWeight:'700'}}>
              タップして続ける
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Phase 2: 犬種選択カルーセル ── */}
        {phase === 'breedSelect' && (
          <View style={{width:'100%', alignItems:'center'}}>
            {/* ナレーション */}
            <View style={{...windowBox, marginBottom:20, paddingVertical:14}}>
              <Text style={{fontSize:14, color:'#4A3F35', textAlign:'center', fontWeight:'700', lineHeight:22}}>
                愛犬の姿を思い出す…
              </Text>
            </View>

            {/* カルーセル本体 */}
            <View style={{width:'100%', alignItems:'center', flexDirection:'row', justifyContent:'center'}}>
              {/* 左矢印 */}
              <TouchableOpacity
                onPress={prevBreed}
                style={{backgroundColor:'rgba(245,228,175,0.9)', borderRadius:28, width:44, height:44, alignItems:'center', justifyContent:'center', marginRight:8, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:4}}
              >
                <Text style={{fontSize:22, color:'#4A3F35', lineHeight:26}}>◀</Text>
              </TouchableOpacity>

              {/* 犬種カード */}
              <TouchableOpacity
                onPress={()=>{ setSelectedBreed(currentBreed.id); setPhase('confirm'); }}
                activeOpacity={0.85}
                style={{
                  backgroundColor:'rgba(245,228,175,0.97)',
                  borderRadius:18, padding:16,
                  borderWidth:2.5, borderColor:'rgba(192,120,64,0.8)',
                  width:220, alignItems:'center',
                  shadowColor:'#000', shadowOpacity:0.25, shadowRadius:8,
                }}
              >
                <Image
                  source={BREED_IMAGES[currentBreed.id]?.idle}
                  style={{width:160, height:160}}
                  resizeMode="contain"
                />
                <Text style={{fontSize:18, fontWeight:'900', color:'#4A3F35', marginTop:10}}>
                  {currentBreed.labelJP}
                </Text>
                <Text style={{fontSize:10, color:'#8C6B3E', marginTop:6, fontWeight:'700'}}>
                  タップして選ぶ
                </Text>
              </TouchableOpacity>

              {/* 右矢印 */}
              <TouchableOpacity
                onPress={nextBreed}
                style={{backgroundColor:'rgba(245,228,175,0.9)', borderRadius:28, width:44, height:44, alignItems:'center', justifyContent:'center', marginLeft:8, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:4}}
              >
                <Text style={{fontSize:22, color:'#4A3F35', lineHeight:26}}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* ページインジケーター */}
            <View style={{flexDirection:'row', marginTop:14, gap:6}}>
              {BREED_DEFS.map((_, i) => (
                <TouchableOpacity key={i} onPress={()=>setBreedIndex(i)}>
                  <View style={{
                    width: i === breedIndex ? 14 : 7, height:7, borderRadius:4,
                    backgroundColor: i === breedIndex ? '#C07840' : 'rgba(245,228,175,0.8)',
                  }}/>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Phase 3: 確認 ── */}
        {phase === 'confirm' && (
          <View style={windowBox}>
            <Image
              source={BREED_IMAGES[selectedBreed]?.idle}
              style={{width:150, height:150}}
              resizeMode="contain"
            />
            <Text style={{fontSize:17, color:'#4A3F35', fontWeight:'900', marginTop:12, textAlign:'center'}}>
              この子ですか？
            </Text>
            <Text style={{fontSize:14, color:'#7A6B5C', marginTop:4, fontWeight:'700'}}>
              {getBreedDef(selectedBreed).labelJP}
            </Text>
            <View style={{flexDirection:'row', gap:16, marginTop:22}}>
              <TouchableOpacity
                onPress={()=>setPhase('nameInput')}
                style={{backgroundColor:'#e67e22', borderRadius:24, paddingHorizontal:28, paddingVertical:12}}
              >
                <Text style={{color:'#fff', fontWeight:'900', fontSize:16}}>はい</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={()=>setPhase('breedSelect')}
                style={{backgroundColor:'rgba(100,80,60,0.8)', borderRadius:24, paddingHorizontal:28, paddingVertical:12}}
              >
                <Text style={{color:'#fff', fontWeight:'900', fontSize:16}}>いいえ</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Phase 4: 名前入力 ── */}
        {phase === 'nameInput' && (
          <View style={windowBox}>
            <Text style={{fontSize:15, color:'#4A3F35', fontWeight:'800', marginBottom:16}}>
              愛犬の名前を教えて
            </Text>
            <TextInput
              style={{
                width:'100%', backgroundColor:'#fff',
                borderRadius:10, borderWidth:1, borderColor:'rgba(180,140,80,0.6)',
                paddingHorizontal:14, paddingVertical:10,
                fontSize:18, color:'#4A3F35', textAlign:'center',
                marginBottom:16,
              }}
              placeholder="名前を入力"
              placeholderTextColor="#B8A88E"
              value={nameText}
              onChangeText={setNameText}
              maxLength={12}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={{
                backgroundColor: nameText.trim().length > 0 ? '#e67e22' : 'rgba(140,123,110,0.5)',
                borderRadius:24, paddingHorizontal:32, paddingVertical:12,
              }}
              onPress={handleSubmit}
              disabled={nameText.trim().length === 0}
            >
              <Text style={{color:'#fff', fontWeight:'900', fontSize:16}}>決定！</Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

// タイトル画面（v8）
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// プロローグ画面（ゲーム起動時の冒頭ナレーション）
// ─────────────────────────────────────────────────────────────────────

const PROLOGUE_SECTIONS = [
  '今日から始まるのは、\n単なる「飼育」ではありません。',
  '一頭の犬がこの世界に舞い降り、\nあなたと出会い、\nそしていつか空へ還るまでの、\nかけがえのない「一生」の物語です。',
  '無邪気に駆け寄ってくる子犬の時期。\n共に高みを目指し、\n絆を深める成犬の輝き。\nそして、静かに思い出を語り合う\n穏やかな老後。',
  'たとえ別れの時が来ても、\n悲しむことはありません。\n一緒に歩いた道のりも、\n共に乗り越えたコンテストも、\nそのすべてが、この子の瞳に焼き付き、\n次の世代へと受け継がれていきます。',
  'さあ、この子の名前を\n呼んであげてください。\n世界でたった一つの、\n命のバトンを繋ぐ旅を始めましょう。',
];

// クリックで1段落ずつ表示、速度1.2倍（1400ms÷1.2≒1167ms）
const PROLOGUE_FADE_MS = Math.round(1400 / 1.2);

function PrologueScreen({ onComplete }: { onComplete: () => void }) {
  const anims = useRef(PROLOGUE_SECTIONS.map(() => new Animated.Value(0))).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;
  const [currentSection, setCurrentSection] = React.useState(0);
  const [allDone, setAllDone] = React.useState(false);
  const isAnimatingRef = useRef(false);

  const handleTap = React.useCallback(() => {
    if (isAnimatingRef.current) return;
    if (allDone) { onComplete(); return; }
    if (currentSection >= PROLOGUE_SECTIONS.length) return;

    isAnimatingRef.current = true;
    Animated.timing(anims[currentSection], {
      toValue: 1,
      duration: PROLOGUE_FADE_MS,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingRef.current = false;
      const next = currentSection + 1;
      setCurrentSection(next);
      if (next >= PROLOGUE_SECTIONS.length) {
        Animated.timing(buttonAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => {
          setAllDone(true);
        });
      }
    });
  }, [currentSection, allDone, anims, buttonAnim, onComplete]);

  return (
    <ImageBackground
      source={require('./Images/prologue_image_0.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <TouchableOpacity
        activeOpacity={1}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.58)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}
        onPress={handleTap}
      >
        <View style={{ width: '100%', alignItems: 'center' }}>
          {PROLOGUE_SECTIONS.map((text, i) => (
            <Animated.Text
              key={i}
              style={{
                opacity: anims[i],
                color: i === 0 ? '#F0E8D0' : '#E8E0CC',
                fontSize: i === 0 ? 18 : 15,
                fontWeight: i === 0 ? '700' : '400',
                textAlign: 'center',
                lineHeight: i === 0 ? 28 : 24,
                marginBottom: i === 0 ? 28 : i === PROLOGUE_SECTIONS.length - 1 ? 0 : 20,
                letterSpacing: 0.5,
                textShadowColor: 'rgba(0,0,0,0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
            >
              {text}
            </Animated.Text>
          ))}
        </View>

        {/* タップして始めるボタン（全段落表示後に出現） */}
        <Animated.View style={{ opacity: buttonAnim, marginTop: 48, alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(201,169,110,0.85)',
              paddingHorizontal: 36,
              paddingVertical: 13,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: 'rgba(255,235,180,0.5)',
            }}
            onPress={onComplete}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 1 }}>
              タップして始める　›
            </Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 10 }}>
            タップして次へ
          </Text>
        </Animated.View>

        {/* タップ促進インジケーター（まだ表示されていない段落がある場合） */}
        {!allDone && currentSection < PROLOGUE_SECTIONS.length && (
          <Text style={{ position: 'absolute', bottom: 56, color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2 }}>
            タップして続ける
          </Text>
        )}
      </TouchableOpacity>
    </ImageBackground>
  );
}

function TitleScreen({
  saveSlots, onContinue, onNewGame, onLoadSlot, onFamilyTree, isFirstLaunch, onSettings, onCollection, onDebugSenior,
}: {
  saveSlots: (SaveSlot|null)[];
  onContinue:    () => void;
  onNewGame:     () => void;
  onLoadSlot:    (slotId:number) => void;
  onFamilyTree:  () => void;
  isFirstLaunch: boolean;
  onSettings:    () => void;
  onCollection:  () => void;
  onDebugSenior: () => void;
}) {
  const [showSlots, setShowSlots] = useState(false);
  const hasSave = saveSlots.some(s => s !== null);

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // 木製ボタンスタイル
  const woodBtn: object = {
    flex:1, backgroundColor:'rgba(80,50,20,0.88)',
    borderRadius:14, paddingVertical:12, paddingHorizontal:10,
    flexDirection:'row' as const, alignItems:'center' as const, gap:6,
    borderWidth:1.5, borderColor:'rgba(200,150,70,0.65)',
    shadowColor:'#000', shadowOpacity:0.6, shadowRadius:5, elevation:7,
  };

  const btnRows: Array<Array<{icon:string; label:string; action:()=>void} | null>> = [
    [
      { icon:'▶️', label: isFirstLaunch ? '最初から始める' : 'つづき', action: isFirstLaunch ? ()=>{ SoundManager.stopBgm(); onNewGame(); } : onContinue },
      { icon:'🎬', label:'記憶', action: ()=>setShowSlots(v=>!v) },
    ],
    [
      isFirstLaunch ? null : { icon:'✈️', label:'出会いから', action: onNewGame },
      { icon:'🐾', label:'家系図', action: onFamilyTree },
    ],
    [
      { icon:'📖', label:'図鑑', action: onCollection },
      { icon:'⚙️', label:'設定', action: onSettings },
    ],
  ];

  return (
    <View style={{flex:1}}>
      {/* 背景画像：全画面 */}
      <Image
        source={require('./Images/top_image_0.png')}
        style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%'}}
        resizeMode="cover"
      />

      <SafeAreaView style={{flex:1, justifyContent:'flex-end'}}>

        {/* セーブスロット展開パネル（ボタンの上に表示） */}
        {showSlots && (
          <View style={{marginHorizontal:12, marginBottom:8, backgroundColor:'rgba(30,18,8,0.93)', borderRadius:16, padding:12, borderWidth:1, borderColor:'rgba(180,130,60,0.5)'}}>
            {[0,1,2].map(i => {
              const slot = saveSlots[i];
              return (
                <TouchableOpacity
                  key={i}
                  style={{
                    backgroundColor: slot ? 'rgba(80,58,28,0.90)' : 'rgba(40,28,14,0.70)',
                    borderRadius:10, padding:10, marginBottom:6,
                    borderWidth:1, borderColor: slot ? 'rgba(180,130,60,0.6)' : 'rgba(80,60,30,0.4)',
                    flexDirection:'row', alignItems:'center', gap:10,
                  }}
                  onPress={() => { if(slot){ setShowSlots(false); onLoadSlot(i); } }}
                  disabled={!slot}
                >
                  <Text style={{fontSize:18}}>{slot ? '📂' : '📭'}</Text>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:13,fontWeight:'700',color: slot ? '#F9F0DC' : '#7A6A50'}}>スロット {i+1}</Text>
                    {slot
                      ? <Text style={{fontSize:10,color:'rgba(220,190,130,0.80)',marginTop:1}}>{slot.label}  ({fmtDate(slot.savedAt)})</Text>
                      : <Text style={{fontSize:10,color:'#6A5A40'}}>空</Text>
                    }
                  </View>
                  {slot && <Text style={{fontSize:13,color:'#C9A96E',fontWeight:'700'}}>ロード</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={{alignItems:'center',paddingVertical:4}} onPress={()=>setShowSlots(false)}>
              <Text style={{color:'rgba(200,170,100,0.70)',fontSize:12}}>▲ 閉じる</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 6ボタン：3行×2列 木製スタイル */}
        <View style={{paddingHorizontal:12, paddingBottom:20, gap:8}}>
          {btnRows.map((row, ri) => (
            <View key={ri} style={{flexDirection:'row', gap:8}}>
              {row.map((btn, ci) =>
                btn ? (
                  <TouchableOpacity key={ci} style={woodBtn as any} onPress={btn.action}>
                    <Text style={{fontSize:20}}>{btn.icon}</Text>
                    <Text style={{fontSize:13,fontWeight:'800',color:'#F5E4B8',flex:1}} numberOfLines={1}>{btn.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <View key={ci} style={{flex:1}} />
                )
              )}
            </View>
          ))}

          {/* デバッグメニュー */}
          <TouchableOpacity
            style={{
              backgroundColor:'rgba(120,30,30,0.50)', borderRadius:12, paddingVertical:8,
              paddingHorizontal:14, flexDirection:'row', alignItems:'center', gap:10,
              borderWidth:1, borderColor:'rgba(200,60,60,0.35)', marginTop:2,
            }}
            onPress={onDebugSenior}
          >
            <Text style={{fontSize:16}}>🧪</Text>
            <Text style={{fontSize:11,fontWeight:'700',color:'rgba(255,180,180,0.80)',flex:1}}>老犬テストモード（開発者）</Text>
            <Text style={{fontSize:13,color:'rgba(255,150,150,0.50)'}}>›</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 家系図画面（v8）
// ─────────────────────────────────────────────────────────────────────────

function FamilyTreeScreen({
  dog, onBack, onBreed, onSelectPuppy, onRestart, onRetire, onRenamePuppy,
}: {
  dog:            DogState;
  onBack:         () => void;
  onBreed:        () => void;
  onSelectPuppy:  (p: FamilyMember) => void;
  onRestart?:     (ancestor: LineageRecord, index: number) => void;
  onRetire?:      () => void;
  onRenamePuppy?: (puppyId: string, newName: string) => void;
}) {
  const [restartTarget, setRestartTarget] = React.useState<{rec: LineageRecord; idx: number} | null>(null);
  const [detailTarget, setDetailTarget]   = React.useState<{rec: LineageRecord; idx: number} | null>(null);
  const [editingPuppyId, setEditingPuppyId] = React.useState<string | null>(null);
  const [editingName, setEditingName]       = React.useState('');
  const abilBadge = (a: AbilityStats) =>
    `規律${a.physical.discipline} 速度${a.physical.speed} 知性${a.intelligence}`;
  const genderIcon = (g: Gender | undefined) => !g ? '' : g === 'male' ? '♂️' : '♀️';

  return (
    <SafeAreaView style={[styles.safe,{position:'relative'}]}>
      {/* 祖先詳細モーダル */}
      {detailTarget && (
        <View style={{
          position:'absolute',top:0,left:0,right:0,bottom:0,
          backgroundColor:'rgba(0,0,0,0.65)',zIndex:998,
          justifyContent:'center',alignItems:'center',padding:20,
        }}>
          <View style={{backgroundColor:'#fff',borderRadius:16,padding:20,width:'100%',maxWidth:380}}>
            <Text style={{fontSize:17,fontWeight:'900',color:'#4A3F35',marginBottom:4}}>
              {detailTarget.rec.gender==='male'?'🐶':'🐩'} {detailTarget.rec.name}
            </Text>
            <Text style={{fontSize:12,color:'#8C7B6E',marginBottom:10}}>
              {genderIcon(detailTarget.rec.gender)}  第{detailTarget.rec.generation}世代
            </Text>
            {/* 全盛期ステータス */}
            <Text style={{fontSize:12,fontWeight:'800',color:'#7D6E8A',marginBottom:4}}>全盛期ステータス</Text>
            {(() => {
              const peak = detailTarget.rec.peakAbilities ?? detailTarget.rec.abilities;
              return (
                <View style={{backgroundColor:'#F9F7F2',borderRadius:8,padding:8,marginBottom:8}}>
                  <Text style={{fontSize:11,color:'#4A3F35'}}>規律 {peak.physical.discipline}  速度 {peak.physical.speed}  スタミナ {peak.physical.stamina}</Text>
                  <Text style={{fontSize:11,color:'#4A3F35'}}>バネ {peak.physical.spring}  集中 {peak.physical.focus}</Text>
                  <Text style={{fontSize:11,color:'#4A3F35'}}>知性 {peak.intelligence}  毛並み {peak.beauty.coat}  愛嬌 {peak.beauty.charm}</Text>
                  <Text style={{fontSize:11,color:'#4A3F35'}}>幸運 {peak.luck}</Text>
                </View>
              );
            })()}
            {/* 大会成績 */}
            <Text style={{fontSize:11,color:'#8C7B6E',marginBottom:4}}>
              大会優勝: {detailTarget.rec.tournamentWins}回
              {detailTarget.rec.tournamentPlacements != null ? `  連帯: ${detailTarget.rec.tournamentPlacements}回` : ''}
            </Text>
            {/* 保有スキル */}
            {detailTarget.rec.satoriBonuses && detailTarget.rec.satoriBonuses.length > 0 && (
              <View style={{marginBottom:8}}>
                <Text style={{fontSize:12,fontWeight:'800',color:'#7D6E8A',marginBottom:4}}>保有スキル</Text>
                {detailTarget.rec.satoriBonuses.map((s,si) => (
                  <Text key={si} style={{fontSize:11,color:'#6B9070'}}>• {s}</Text>
                ))}
              </View>
            )}
            {/* 育て直しボタン */}
            {onRestart && (
              <TouchableOpacity
                style={{backgroundColor:'#fff3f3',borderRadius:10,borderWidth:1,borderColor:'#e74c3c',
                  paddingVertical:10,alignItems:'center',marginBottom:10}}
                onPress={()=>{
                  setDetailTarget(null);
                  setRestartTarget(detailTarget);
                }}
              >
                <Text style={{color:'#e74c3c',fontWeight:'800',fontSize:13}}>🔄 育成をやり直す</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{backgroundColor:'#F0EDE7',borderRadius:10,paddingVertical:10,alignItems:'center'}}
              onPress={()=>setDetailTarget(null)}
            >
              <Text style={{color:'#4A3F35',fontWeight:'700',fontSize:13}}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 育て直し 確認モーダル（ScrollView の外でオーバーレイ） */}
      {restartTarget && (
        <View style={{
          position:'absolute',top:0,left:0,right:0,bottom:0,
          backgroundColor:'rgba(0,0,0,0.65)',zIndex:999,
          justifyContent:'center',alignItems:'center',padding:24,
        }}>
          <View style={{backgroundColor:'#fff',borderRadius:16,padding:20,width:'100%',maxWidth:360}}>
            <Text style={{fontSize:16,fontWeight:'900',color:'#c0392b',marginBottom:10}}>
              ⚠️ 育て直し確認
            </Text>
            <Text style={{fontSize:13,color:'#4A3F35',marginBottom:6}}>
              {restartTarget.rec.name}（第{restartTarget.rec.generation}世代）に戻りますか？
            </Text>
            <Text style={{fontSize:12,color:'#e74c3c',marginBottom:16}}>
              ⚠️ 本当に育成をやり直しますか？（この犬の子孫のデータが全て消えます）
            </Text>
            <View style={{flexDirection:'row',gap:10}}>
              <TouchableOpacity
                style={{flex:1,backgroundColor:'#e74c3c',borderRadius:20,paddingVertical:12,alignItems:'center'}}
                onPress={()=>{ onRestart?.(restartTarget.rec, restartTarget.idx); setRestartTarget(null); }}
              >
                <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>はい</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{flex:1,backgroundColor:'#F0EDE7',borderRadius:20,paddingVertical:12,alignItems:'center'}}
                onPress={()=>setRestartTarget(null)}
              >
                <Text style={{color:'#4A3F35',fontWeight:'700',fontSize:13}}>いいえ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.closetHeader}>
          <TouchableOpacity style={styles.closetBackBtn} onPress={onBack}>
            <Text style={styles.closetBackText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={[styles.closetTitle,{color:'#7D6E8A'}]}>🌳 家系図</Text>
          <View style={{width:60}}/>
        </View>

        {/* 現在の主人公 */}
        <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#8DAA91',backgroundColor:'#F0EDE7'}]}>
          <Text style={[styles.cardTitle,{color:'#6B9070'}]}>
            🐕 現在の主人公  第{dog.generation}世代
          </Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6}}>
            <Text style={{fontSize:28}}>{dog.gender==='male'?'🐶':'🐩'}</Text>
            <View style={{flex:1}}>
              <Text style={{fontSize:16,fontWeight:'800',color:'#4A3F35'}}>{dog.dogName}</Text>
              <Text style={{fontSize:11,color:'#8C7B6E'}}>
                {genderIcon(dog.gender)} {dog.gender==='male'?'オス':'メス'}
                {'  '}大会優勝:{dog.tournamentWins}回
              </Text>
              <Text style={{fontSize:11,color:'#8C7B6E',marginTop:2}}>{abilBadge(dog.abilities)}</Text>
            </View>
          </View>
        </View>

        {/* 番 */}
        <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#C96B8A'}]}>
          <Text style={[styles.cardTitle,{color:'#c0392b'}]}>💞 番（パートナー）</Text>
          {dog.mate ? (
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={{fontSize:24}}>{dog.mate.gender==='male'?'🐶':'🐩'}</Text>
              <View style={{flex:1}}>
                <Text style={{fontSize:14,fontWeight:'700',color:'#4A3F35'}}>{dog.mate.name}</Text>
                <Text style={{fontSize:11,color:'#8C7B6E'}}>
                  {genderIcon(dog.mate.gender)} 第{dog.mate.generation}世代
                </Text>
                <Text style={{fontSize:11,color:'#8C7B6E'}}>{abilBadge(dog.mate.abilities)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.btn,{backgroundColor:'#C96B8A',marginRight:0}]}
                onPress={onBreed}
              >
                <Text style={styles.btnText}>🐶 繁殖</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.meta}>
              散歩で異性の犬と出会い、親密度80以上になると番登録できます
            </Text>
          )}
        </View>

        {/* 引退ボタン */}
        {!dog.isRetired && dog.puppies.length > 0 && (
          <View style={[styles.card,{backgroundColor:'#fff0f0',borderLeftWidth:4,borderLeftColor:'#e74c3c'}]}>
            <Text style={{fontSize:14,fontWeight:'700',color:'#c0392b',marginBottom:6}}>
              🏁 引退して次世代へ
            </Text>
            <Text style={{fontSize:11,color:'#8C7B6E',marginBottom:10,lineHeight:16}}>
              引退すると子犬の育成が開始できるようになります。{'\n'}
              引退後は現在の犬での訓練・大会参加が終了します。
            </Text>
            <TouchableOpacity
              style={[styles.btn,{backgroundColor:'#c0392b'}]}
              onPress={onRetire}
            >
              <Text style={styles.btnText}>🏁 引退する</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 子犬選択（生まれた直後）*/}
        {dog.puppies && dog.puppies.length > 0 && (
          <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#D4974E',backgroundColor:'#F9F7F2'}]}>
            <Text style={[styles.cardTitle,{color:'#C07840'}]}>🐶 次の主人公を選んでください！</Text>
            {dog.puppies.map(puppy => (
              <View key={puppy.id} style={{
                backgroundColor:'#fff',borderRadius:10,padding:10,marginBottom:8,
                borderWidth:1.5,borderColor:'#D4974E',
              }}>
                {/* 名前編集 */}
                {editingPuppyId === puppy.id ? (
                  <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:6}}>
                    <TextInput
                      style={{flex:1,borderWidth:1,borderColor:'#D4974E',borderRadius:8,
                        paddingHorizontal:8,paddingVertical:4,fontSize:13,color:'#4A3F35'}}
                      value={editingName}
                      onChangeText={setEditingName}
                      autoFocus
                      maxLength={20}
                      placeholder="名前を入力"
                    />
                    <TouchableOpacity
                      style={{backgroundColor:'#8DAA91',borderRadius:8,paddingHorizontal:10,paddingVertical:6}}
                      onPress={()=>{
                        onRenamePuppy?.(puppy.id, editingName);
                        setEditingPuppyId(null);
                      }}
                    >
                      <Text style={{color:'#fff',fontWeight:'700',fontSize:12}}>決定</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{backgroundColor:'#C5BDB5',borderRadius:8,paddingHorizontal:8,paddingVertical:6}}
                      onPress={()=>setEditingPuppyId(null)}
                    >
                      <Text style={{color:'#4A3F35',fontSize:12}}>取消</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={{flexDirection:'row',alignItems:'center',gap:8}}
                  onPress={() => onSelectPuppy(puppy)}
                >
                  <Text style={{fontSize:24}}>{puppy.gender==='male'?'🐶':'🐩'}</Text>
                  <View style={{flex:1}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                      <Text style={{fontSize:13,fontWeight:'700',color:'#4A3F35'}}>{puppy.name}</Text>
                      {onRenamePuppy && (
                        <TouchableOpacity
                          onPress={()=>{ setEditingPuppyId(puppy.id); setEditingName(puppy.name); }}
                        >
                          <Text style={{fontSize:10,color:'#D4974E',borderWidth:1,borderColor:'#D4974E',
                            borderRadius:4,paddingHorizontal:4,paddingVertical:1}}>名前変更</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{fontSize:11,color:'#8C7B6E'}}>
                      {genderIcon(puppy.gender)} 第{puppy.generation}世代
                    </Text>
                    <Text style={{fontSize:11,color:'#8C7B6E'}}>{abilBadge(puppy.abilities)}</Text>
                  </View>
                  <Text style={{fontSize:13,color:'#D4974E',fontWeight:'800'}}>選ぶ ›</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 祖先系譜 */}
        {dog.lineage.length > 0 && (
          <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#8C7B6E'}]}>
            <Text style={[styles.cardTitle,{color:'#8C7B6E'}]}>📜 祖先系譜（タップで詳細）</Text>
            {/* ツリー表示：現在犬→祖先へ向かう縦チェーン */}
            <View style={{alignItems:'center',marginBottom:8}}>
              <Text style={{fontSize:12,color:'#8DAA91',fontWeight:'700'}}>
                🐕 {dog.dogName}（第{dog.generation}世代）← 現在
              </Text>
              {dog.lineage.map((rec, i) => (
                <View key={i} style={{alignItems:'center'}}>
                  <Text style={{fontSize:16,color:'#C5BDB5',marginVertical:2}}>│</Text>
                  <TouchableOpacity
                    style={{
                      flexDirection:'row',alignItems:'center',gap:8,
                      backgroundColor: i===0 ? '#F9F7F2' : '#fafafa',
                      borderRadius:10,padding:10,
                      borderWidth:1,borderColor:'#C5BDB5',
                      width:'100%',
                    }}
                    onPress={()=>setDetailTarget({rec, idx:i})}
                  >
                    <Text style={{fontSize:22}}>{rec.gender==='male'?'🐶':'🐩'}</Text>
                    <View style={{flex:1}}>
                      <Text style={{fontSize:13,fontWeight:'700',color:'#4A3F35'}}>
                        {rec.name}
                        <Text style={{fontSize:10,color:'#8C7B6E'}}>  第{rec.generation}世代{rec.gender ? `  ${genderIcon(rec.gender)}` : ''}</Text>
                      </Text>
                      <Text style={{fontSize:11,color:'#8C7B6E'}}>{abilBadge(rec.abilities)}  優勝:{rec.tournamentWins}回</Text>
                    </View>
                    <Text style={{fontSize:12,color:'#7D6E8A',fontWeight:'700'}}>詳細 ›</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 出会った犬一覧 */}
        {dog.knownDogs.length > 0 && (
          <View style={[styles.card,{borderLeftWidth:4,borderLeftColor:'#7A9E9F'}]}>
            <Text style={[styles.cardTitle,{color:'#4A3F35'}]}>🐾 出会った犬（{dog.knownDogs.length}匹）</Text>
            {dog.knownDogs.map(npc => (
              <View key={npc.id} style={{
                flexDirection:'row',alignItems:'center',gap:8,marginBottom:6,
                borderLeftWidth:2,borderLeftColor: npc.intimacy>=50?'#C96B8A':'#C5BDB5',
                paddingLeft:8,
              }}>
                <Text style={{fontSize:20}}>{npc.gender==='male'?'🐶':'🐩'}</Text>
                <View style={{flex:1}}>
                  <Text style={{fontSize:12,fontWeight:'700',color:'#4A3F35'}}>
                    {npc.name} <Text style={{fontWeight:'400',color:'#8C7B6E'}}>({npc.breed})</Text>
                  </Text>
                  <Text style={{fontSize:11,color:'#C96B8A'}}>親密度 {npc.intimacy}/100  遭遇{npc.metCount}回</Text>
                </View>
                {npc.id === dog.mate?.id && (
                  <Text style={{fontSize:12,color:'#C96B8A',fontWeight:'800'}}>💞番</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 設定画面（v9）
// ─────────────────────────────────────────────────────────────────────────

function SettingsScreen({
  settings, realMinPerDay, onChangeSettings, onBack,
}: {
  settings: GameSettings;
  realMinPerDay: number;
  onChangeSettings: (patch: Partial<GameSettings>) => void;
  onBack: () => void;
}) {
  const [speedInput, setSpeedInput] = React.useState(String(realMinPerDay));

  const applySpeed = () => {
    const v = parseFloat(speedInput);
    if(!isNaN(v) && v >= MIN_REAL_MINUTES) onChangeSettings({ realMinPerDay: v });
    else setSpeedInput(String(realMinPerDay));
  };

  const ToggleRow = ({ label, sub, value, onToggle }: {
    label: string; sub: string; value: boolean; onToggle: () => void;
  }) => (
    <View style={{ flexDirection:'row', alignItems:'center', paddingVertical:10,
      borderBottomWidth:1, borderBottomColor:'#F0EDE7' }}>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, fontWeight:'700', color:'#4A3F35' }}>{label}</Text>
        <Text style={{ fontSize:11, color:'#8C7B6E', marginTop:2 }}>{sub}</Text>
      </View>
      <TouchableOpacity
        style={{
          width:50, height:28, borderRadius:14,
          backgroundColor: value ? '#8DAA91' : '#C5BDB5',
          justifyContent:'center',
          paddingHorizontal: value ? 4 : undefined,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
        onPress={onToggle}
      >
        <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
          shadowColor:'#000', shadowOpacity:0.2, shadowRadius:2, elevation:2 }}/>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.closetHeader}>
          <TouchableOpacity style={styles.closetBackBtn} onPress={onBack}>
            <Text style={styles.closetBackText}>← タイトルへ</Text>
          </TouchableOpacity>
          <Text style={[styles.closetTitle,{color:'#8C7B6E'}]}>⚙️ 設定</Text>
          <View style={{width:80}}/>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🕒 ゲームスピード</Text>
          <Text style={[styles.meta,{marginBottom:8}]}>
            現実の何分をゲーム内1日にするか設定します（最小{MIN_REAL_MINUTES}分）
          </Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Text style={styles.label}>現実の</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={speedInput}
              onChangeText={setSpeedInput}
              onBlur={applySpeed}
              onSubmitEditing={applySpeed}
            />
            <Text style={styles.label}>分 = ゲーム内 1日</Text>
          </View>
          <Text style={[styles.meta,{marginTop:6,color:'#8DAA91'}]}>
            現在: {realMinPerDay}分 / 1日　（倍速: ×{(realMinPerDay === 0 ? 0 : (1440/realMinPerDay/60)).toFixed(2)}）
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 大会設定</Text>
          <ToggleRow
            label="🏃 フィジカルコンテスト"
            sub="オビディエンス・ハイジャンプ・ロングランを開催する"
            value={settings.physicalContestEnabled ?? true}
            onToggle={()=>onChangeSettings({ physicalContestEnabled: !(settings.physicalContestEnabled ?? true) })}
          />
          <ToggleRow
            label="📸 ビューティーコンテスト"
            sub="フォトセッションによる美しさを競う大会を開催する"
            value={settings.beautyContestEnabled ?? true}
            onToggle={()=>onChangeSettings({ beautyContestEnabled: !(settings.beautyContestEnabled ?? true) })}
          />
          <ToggleRow
            label="🐽 ノーズワークコンテスト"
            sub="嗅覚を活かしたターゲット探しを開催する"
            value={settings.noseworkContestEnabled ?? true}
            onToggle={()=>onChangeSettings({ noseworkContestEnabled: !(settings.noseworkContestEnabled ?? true) })}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔊 音量設定</Text>

          {/* BGM */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical:10,
            borderBottomWidth:1, borderBottomColor:'#F0EDE7' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:14, fontWeight:'700', color:'#4A3F35' }}>BGM</Text>
              <Text style={{ fontSize:11, color:'#8C7B6E', marginTop:2 }}>バックグラウンドミュージック</Text>
            </View>
            <TouchableOpacity
              style={{
                width:50, height:28, borderRadius:14,
                backgroundColor: settings.bgmEnabled ? '#8DAA91' : '#C5BDB5',
                justifyContent:'center',
                paddingHorizontal: settings.bgmEnabled ? 4 : undefined,
                alignItems: settings.bgmEnabled ? 'flex-end' : 'flex-start',
              }}
              onPress={() => onChangeSettings({ bgmEnabled: !settings.bgmEnabled })}
            >
              <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
                shadowColor:'#000', shadowOpacity:0.2, shadowRadius:2, elevation:2 }}/>
            </TouchableOpacity>
          </View>
          {settings.bgmEnabled && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8,
              borderBottomWidth:1, borderBottomColor:'#F0EDE7' }}>
              <Text style={{ fontSize:13, color:'#8C7B6E', width:60 }}>音量</Text>
              <Text style={{ fontSize:14 }}>🔇</Text>
              <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:6 }}>
                <TouchableOpacity
                  style={{ backgroundColor:'#C5BDB5', borderRadius:12, width:28, height:28, justifyContent:'center', alignItems:'center' }}
                  onPress={() => onChangeSettings({ bgmVolume: Math.max(0, settings.bgmVolume - 10) })}
                >
                  <Text style={{ fontSize:16, color:'#4A3F35', fontWeight:'700' }}>－</Text>
                </TouchableOpacity>
                <View style={{ flex:1, height:6, backgroundColor:'#F0EDE7', borderRadius:3, overflow:'hidden' }}>
                  <View style={{ height:'100%', borderRadius:3, backgroundColor:'#7A9E9F',
                    width:`${settings.bgmVolume}%` as any }}/>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor:'#8DAA91', borderRadius:12, width:28, height:28, justifyContent:'center', alignItems:'center' }}
                  onPress={() => onChangeSettings({ bgmVolume: Math.min(100, settings.bgmVolume + 10) })}
                >
                  <Text style={{ fontSize:16, color:'#fff', fontWeight:'700' }}>＋</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize:14 }}>🔊</Text>
              <Text style={[styles.barValue, { width:32 }]}>{settings.bgmVolume}</Text>
            </View>
          )}

          {/* システム音 */}
          <View style={{ flexDirection:'row', alignItems:'center', paddingVertical:10,
            borderBottomWidth:1, borderBottomColor:'#F0EDE7' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:14, fontWeight:'700', color:'#4A3F35' }}>システム音</Text>
              <Text style={{ fontSize:11, color:'#8C7B6E', marginTop:2 }}>ボタン音・効果音</Text>
            </View>
            <TouchableOpacity
              style={{
                width:50, height:28, borderRadius:14,
                backgroundColor: settings.sfxEnabled ? '#8DAA91' : '#C5BDB5',
                justifyContent:'center',
                paddingHorizontal: settings.sfxEnabled ? 4 : undefined,
                alignItems: settings.sfxEnabled ? 'flex-end' : 'flex-start',
              }}
              onPress={() => onChangeSettings({ sfxEnabled: !settings.sfxEnabled })}
            >
              <View style={{ width:22, height:22, borderRadius:11, backgroundColor:'#fff',
                shadowColor:'#000', shadowOpacity:0.2, shadowRadius:2, elevation:2 }}/>
            </TouchableOpacity>
          </View>
          {settings.sfxEnabled && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8 }}>
              <Text style={{ fontSize:13, color:'#8C7B6E', width:60 }}>音量</Text>
              <Text style={{ fontSize:14 }}>🔇</Text>
              <View style={{ flex:1, flexDirection:'row', alignItems:'center', gap:6 }}>
                <TouchableOpacity
                  style={{ backgroundColor:'#C5BDB5', borderRadius:12, width:28, height:28, justifyContent:'center', alignItems:'center' }}
                  onPress={() => onChangeSettings({ sfxVolume: Math.max(0, settings.sfxVolume - 10) })}
                >
                  <Text style={{ fontSize:16, color:'#4A3F35', fontWeight:'700' }}>－</Text>
                </TouchableOpacity>
                <View style={{ flex:1, height:6, backgroundColor:'#F0EDE7', borderRadius:3, overflow:'hidden' }}>
                  <View style={{ height:'100%', borderRadius:3, backgroundColor:'#C96B8A',
                    width:`${settings.sfxVolume}%` as any }}/>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor:'#8DAA91', borderRadius:12, width:28, height:28, justifyContent:'center', alignItems:'center' }}
                  onPress={() => onChangeSettings({ sfxVolume: Math.min(100, settings.sfxVolume + 10) })}
                >
                  <Text style={{ fontSize:16, color:'#fff', fontWeight:'700' }}>＋</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize:14 }}>🔊</Text>
              <Text style={[styles.barValue, { width:32 }]}>{settings.sfxVolume}</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 図鑑（コレクション）画面（v9）
// ─────────────────────────────────────────────────────────────────────────

const ALL_ITEM_NAMES = [...WALK_ITEM_POOL, ...CONTEST_ITEM_POOL].map(i => i.name);

function CollectionScreen({
  dog, earnedTrophyIds, onBack,
}: {
  dog: DogState;
  earnedTrophyIds: string[];
  onBack: () => void;
}) {
  const [tab, setTab] = React.useState<'dogs'|'items'|'trophies'>('dogs');
  const collectedNames = new Set(dog.inventory.map(i => i.name));
  const rarityColor = (r: InventoryItem['rarity']) =>
    r === 'epic' ? '#7D6E8A' : r === 'rare' ? '#7A9E9F' : '#8C7B6E';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.closetHeader}>
          <TouchableOpacity style={styles.closetBackBtn} onPress={onBack}>
            <Text style={styles.closetBackText}>← メインへ</Text>
          </TouchableOpacity>
          <Text style={[styles.closetTitle,{color:'#7A9E9F'}]}>📖 図鑑</Text>
          <View style={{width:60}}/>
        </View>

        {/* タブ */}
        <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
          {(['dogs','items','trophies'] as const).map(t => (
            <TouchableOpacity key={t}
              style={[styles.btn, { flex:1,
                backgroundColor: tab===t ? '#7A9E9F' : '#F0EDE7',
              }]}
              onPress={()=>setTab(t)}
            >
              <Text style={[styles.btnText, tab!==t && {color:'#4A3F35'}]}>
                {t==='dogs'?'🐾 出会った犬':t==='items'?'🎒 アイテム':(`🏆 実績` + (earnedTrophyIds.length > 0 ? ` (${earnedTrophyIds.length}/${TROPHY_LIST.length})` : ''))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 出会った犬タブ */}
        {tab==='dogs' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              🐾 出会った犬（{dog.knownDogs.length}匹 / 発見中）
            </Text>
            {dog.knownDogs.length === 0 ? (
              <Text style={styles.meta}>まだ誰にも会っていません。散歩に出かけましょう！</Text>
            ) : (
              dog.knownDogs.map(npc => (
                <View key={npc.id} style={{
                  flexDirection:'row', alignItems:'center', gap:8, marginBottom:8,
                  backgroundColor:'#fafafa', borderRadius:10, padding:10,
                  borderLeftWidth:3, borderLeftColor: npc.id===dog.mate?.id?'#C96B8A':'#7A9E9F',
                }}>
                  <Text style={{ fontSize:24 }}>{npc.gender==='male'?'🐶':'🐩'}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:13, fontWeight:'800', color:'#4A3F35' }}>
                      {npc.name}
                      {npc.id===dog.mate?.id ? ' 💞' : ''}
                    </Text>
                    <Text style={{ fontSize:11, color:'#8C7B6E' }}>
                      {npc.breed}  遭遇{npc.metCount}回
                    </Text>
                    <View style={{ height:5, backgroundColor:'#F0EDE7', borderRadius:3,
                      marginTop:4, overflow:'hidden' }}>
                      <View style={{ height:'100%', borderRadius:3, backgroundColor:'#C96B8A',
                        width:`${npc.intimacy}%` as any }}/>
                    </View>
                    <Text style={{ fontSize:10, color:'#C96B8A', marginTop:2 }}>
                      親密度 {npc.intimacy}/100　再会ボーナス +{npc.reencounterBonus}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* アイテム図鑑タブ */}
        {tab==='items' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              🎒 アイテム図鑑（{collectedNames.size}/{ALL_ITEM_NAMES.length} 種）
            </Text>
            {[...WALK_ITEM_POOL, ...CONTEST_ITEM_POOL].map(tpl => {
              const found = collectedNames.has(tpl.name);
              const rc = rarityColor(tpl.rarity);
              return (
                <View key={tpl.name} style={{
                  flexDirection:'row', alignItems:'center', gap:10, marginBottom:8,
                  opacity: found ? 1 : 0.35,
                  backgroundColor:'#fafafa', borderRadius:10, padding:10,
                  borderLeftWidth:3, borderLeftColor: found ? rc : '#C5BDB5',
                }}>
                  <View style={[styles.itemRarityBadge,{backgroundColor: found ? rc : '#C5BDB5',marginRight:0}]}>
                    <Text style={styles.itemRarityText}>{tpl.rarity.toUpperCase()}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={[styles.itemName,{color: found ? rc : '#C5BDB5'}]}>
                      {found ? tpl.name : '？？？'}
                    </Text>
                    {found && (
                      <Text style={styles.itemBonuses}>{tpl.flavorText}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize:18 }}>{found ? '✅' : '🔒'}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* 実績タブ */}
        {tab==='trophies' && (
          <View>
            {(['子犬・社会化','フィジカル','ビューティー','その他ステータス','散歩・探索','コンテスト','クローゼット','次世代・継承','特殊・やり込み'] as const).map(cat => {
              const catTrophies = TROPHY_LIST.filter(t => t.category === cat);
              if(!catTrophies.length) return null;
              return (
                <View key={cat} style={styles.card}>
                  <Text style={styles.cardTitle}>{cat}</Text>
                  {catTrophies.map(t => {
                    const done = earnedTrophyIds.includes(t.id);
                    return (
                      <View key={t.id} style={{
                        flexDirection:'row', alignItems:'center', gap:10, marginBottom:8,
                        opacity: done ? 1 : 0.35,
                        backgroundColor: done ? '#F0EDE7' : '#fafafa',
                        borderRadius:10, padding:10,
                        borderLeftWidth:3, borderLeftColor: done ? '#8DAA91' : '#C5BDB5',
                      }}>
                        <Text style={{ fontSize:22 }}>{done ? '🏆' : '🔒'}</Text>
                        <View style={{ flex:1 }}>
                          <Text style={{ fontSize:13, fontWeight:'800',
                            color: done ? '#6B9070' : '#C5BDB5' }}>{t.label}</Text>
                          <Text style={{ fontSize:11, color: done ? '#8C7B6E' : '#C5BDB5' }}>{t.desc}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// 大会ライバルスコア生成（フィジカル）
function genRivalPhysicalScore(): number {
  const t = Math.random();
  return t < 0.15 ? Math.round(190 + Math.random() * 110) :
         t < 0.50 ? Math.round(80  + Math.random() * 130) :
                    Math.round(20  + Math.random() * 70);
}
// 大会ライバルスコア生成（ビューティー）
function genRivalBeautyScore(): number {
  const t = Math.random();
  return t < 0.15 ? Math.round(380 + Math.random() * 220) :
         t < 0.50 ? Math.round(150 + Math.random() * 250) :
                    Math.round(30  + Math.random() * 140);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ContestPhysicalScreen — フィジカル大会（3種目）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ContestPhysicalScreen({
  dog, onResult, onBack
}: {
  dog: DogState;
  onResult: (rank: number, score: number, commentary: string[], entries: ContestResultEntry[]) => void;
  onBack: () => void;
}) {
  const ROUNDS = ['🎓 オビディエンス', '🦘 ハイジャンプ', '🏃 ロングラン'];
  const [round, setRound] = React.useState(0);
  const [phase, setPhase] = React.useState<'ready'|'running'|'judged'|'finish'>('ready');
  const [judgment, setJudgment] = React.useState<'PERFECT'|'GOOD'|'MISS'|null>(null);
  const [roundScores, setRoundScores] = React.useState<number[]>([]);
  const [commentary, setCommentary] = React.useState<string[]>([]);

  // 能力値
  const discipline  = dog.abilities.physical.discipline;
  const intelligence = dog.abilities.intelligence;
  const focus       = dog.abilities.physical.focus ?? 0;
  const speed       = dog.abilities.physical.speed;
  const stamina     = dog.abilities.physical.stamina;
  const spring      = dog.abilities.physical.spring;
  const maxSt       = dog.maxStamina ?? 300;

  // ライバル5頭のスコア（ゲーム開始時に確定）
  const [rivalScores] = React.useState<number[]>(() =>
    NW_RIVAL_DOGS.map(() => genRivalPhysicalScore())
  );
  // ライバルのラウンド別データ（合計をrivalScoresと合わせる）
  const [rivalRoundData] = React.useState(() =>
    NW_RIVAL_DOGS.map((r, i) => {
      const total = rivalScores[i];
      const r0 = Math.round(total * (0.28 + Math.random() * 0.12));
      const r1 = Math.round(total * (0.28 + Math.random() * 0.12));
      const r2 = Math.max(0, total - r0 - r1);
      const pts = [r0, r1, r2];
      return { name: r.name, pts, succeed: pts.map(p => p >= 20) };
    })
  );
  const finalizePhysical = React.useCallback((playerScore: number, cm: string[]) => {
    // ゴールデンレトリバー特性: フィジカルコンテスト得点×1.05
    const adjustedScore = dog.breed === 'golden retriever' ? Math.round(playerScore * 1.05) : playerScore;
    const all: ContestResultEntry[] = [
      { rank:0, dogBreed: dog.breed ?? '柴犬', dogName: dog.dogName, score: adjustedScore, isPlayer: true },
      ...NW_RIVAL_DOGS.map((r, i) => ({ rank:0, dogBreed: r.breed, dogName: r.name, score: rivalScores[i], isPlayer: false })),
    ];
    all.sort((a, b) => b.score - a.score);
    all.forEach((e, i) => { e.rank = i + 1; });
    const me = all.find(e => e.isPlayer)!;
    onResult(me.rank, adjustedScore, cm, all);
  }, [dog.breed, dog.dogName, rivalScores, onResult]);

  // ─── 犬画像フラッシュ ────────────────────────────────
  const [dogFlash, setDogFlash] = React.useState<'happy'|'sad'|null>(null);
  const dogFlashTimerRef = React.useRef<ReturnType<typeof setTimeout>|null>(null);

  // ─── Round 0: オビディエンス 状態 ────────────────────
  type ObeCmd = 'おすわり'|'ふせ'|'まて';
  const OBE_TOTAL = 5;
  const OBE_EMOJI: Record<ObeCmd,string> = { 'おすわり':'⬆️','ふせ':'⬇️','まて':'✋' };
  const OBE_ICON_IDX: Record<ObeCmd,number> = { 'おすわり':0,'ふせ':1,'まて':2 };
  const [obeCmd,    setObeCmd]    = React.useState<ObeCmd|null>(null);
  const [obePreview,setObePreview]= React.useState(false);   // true=薄く表示中
  const [obeTimerPct,setObeTimerPct] = React.useState(100); // タイマーバー%
  const [obeCombo,  setObeCombo]  = React.useState(0);
  const [obeTotalPts,setObeTotalPts]= React.useState(0);
  // refs (タイマーコールバック内で使用)
  const obeCmdsRef    = React.useRef<ObeCmd[]>([]);
  const obeCmdRef     = React.useRef<ObeCmd|null>(null);
  const obeCmdIdxRef  = React.useRef(0);
  const obeActiveRef  = React.useRef(false);
  const obeComboRef   = React.useRef(0);
  const obeTotalRef   = React.useRef(0);
  const obeTimerRef   = React.useRef<ReturnType<typeof setTimeout>|null>(null);
  const obeBarRef     = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const obeMateRef    = React.useRef<ReturnType<typeof setTimeout>|null>(null);
  const obePreviewTRef= React.useRef<ReturnType<typeof setTimeout>|null>(null);

  // ─── Round 1: ハイジャンプ（犬固定・ハードル右→左）状態 ─────────
  const HJ_DOG_X          = 0.20;                          // 犬の固定X位置（画面幅比）
  const HJ_HURDLE_N       = 5;                             // ハードル本数
  const HJ_HURDLE_SPEED   = 0.016;                         // ハードル移動速度（/50ms tick）
  const HJ_HURDLE_OFFSETS = [0, 0.22, 0.45, 0.62, 0.90];  // 不揃い初期間隔
  type HjHurdle = { id: number; x: number; passed: boolean };
  const hjDogY         = React.useRef(new Animated.Value(0)).current;
  const hjDogX         = React.useRef(new Animated.Value(HJ_DOG_X)).current;
  const hjIsJumpingRef = React.useRef(false);
  const hjClearedRef   = React.useRef(0);
  const hjEvalRef      = React.useRef(0);   // 通過済みハードル数
  const hjLoopRef      = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const hjRunAnim      = React.useRef<Animated.CompositeAnimation|null>(null);
  const hjHurdlesRef   = React.useRef<HjHurdle[]>(
    HJ_HURDLE_OFFSETS.map((offset, i) => ({ id: i, x: 1.05 + offset, passed: false }))
  );
  const hjFinishedRef  = React.useRef(false);
  const hjDogXRef      = React.useRef(HJ_DOG_X);
  const [hjHurdles,    setHjHurdles]    = React.useState<HjHurdle[]>(
    HJ_HURDLE_OFFSETS.map((offset, i) => ({ id: i, x: 1.05 + offset, passed: false }))
  );
  const [hjDogJumping, setHjDogJumping] = React.useState(false);
  const [hjCleared,    setHjCleared]    = React.useState(0);

  // ─── Round 3: ロングラン 状態 ────────────────────────
  const [gaugeValue, setGaugeValue] = React.useState(30);
  const [longrunTimeLeft, setLongrunTimeLeft] = React.useState(5);
  const [longrunPerfectMs, setLongrunPerfectMs] = React.useState(0);
  const longrunInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const longrunStartTime = React.useRef<number>(0);
  const longrunLastTick = React.useRef<number>(0);
  const gaugeRef = React.useRef(30);
  const perfectMsRef = React.useRef(0);

  // クリーンアップ
  React.useEffect(() => {
    return () => {
      if(obeTimerRef.current)   clearTimeout(obeTimerRef.current);
      if(obeBarRef.current)     clearInterval(obeBarRef.current);
      if(obeMateRef.current)    clearTimeout(obeMateRef.current);
      if(obePreviewTRef.current)clearTimeout(obePreviewTRef.current);
      if(dogFlashTimerRef.current) clearTimeout(dogFlashTimerRef.current);
      if(hjLoopRef.current)     clearInterval(hjLoopRef.current);
      if(hjRunAnim.current)     hjRunAnim.current.stop();
      if(longrunInterval.current) clearInterval(longrunInterval.current);
    };
  }, []);

  // ラウンド切替時のリセット
  const advanceRound = React.useCallback((newScores: number[]) => {
    setTimeout(() => {
      if(newScores.length < 3) {
        // ハイジャンプ後のクリーンアップ
        if(hjLoopRef.current) { clearInterval(hjLoopRef.current); hjLoopRef.current = null; }
        if(hjRunAnim.current) { hjRunAnim.current.stop(); hjRunAnim.current = null; }
        hjClearedRef.current  = 0;
        hjEvalRef.current     = 0;
        hjFinishedRef.current = false;
        // ハイジャンプラウンドへの移行時はハードルを事前表示
        const nextRound = newScores.length;
        const preHurdles = nextRound === 1
          ? HJ_HURDLE_OFFSETS.map((offset, i) => ({ id: i, x: 1.05 + offset, passed: false }))
          : [];
        hjHurdlesRef.current  = preHurdles;
        hjDogXRef.current     = HJ_DOG_X;
        hjDogY.setValue(0);
        hjDogX.setValue(HJ_DOG_X);
        setHjHurdles(preHurdles);
        setHjCleared(0);
        setHjDogJumping(false);
        setRound(nextRound);
        setPhase('ready');
        setJudgment(null);
        setObeCmd(null);
        setObePreview(false);
        setObeTimerPct(100);
        setObeCombo(0);
        setObeTotalPts(0);
        obeComboRef.current = 0;
        obeTotalRef.current = 0;
        gaugeRef.current = 30;
        setGaugeValue(30);
        setLongrunTimeLeft(5);
        perfectMsRef.current = 0;
        setLongrunPerfectMs(0);
      } else {
        setPhase('finish');
      }
    }, 1400);
  }, []);

  const recordScore = React.useCallback((score: number, jud: 'PERFECT'|'GOOD'|'MISS', cm: string) => {
    setJudgment(jud);
    const newScores = [...roundScores, score];
    setRoundScores(newScores);
    setCommentary(prev => [...prev, `[${ROUNDS[round]}] ${cm}`]);
    setPhase('judged');
    advanceRound(newScores);
  }, [round, roundScores, advanceRound]);

  // ─── オビディエンス ヘルパー ─────────────────────────
  const flashDog = (type: 'happy'|'sad') => {
    setDogFlash(type);
    if(dogFlashTimerRef.current) clearTimeout(dogFlashTimerRef.current);
    dogFlashTimerRef.current = setTimeout(() => setDogFlash(null), 600);
  };
  const clearObeTimers = () => {
    if(obeTimerRef.current)  { clearTimeout(obeTimerRef.current);   obeTimerRef.current  = null; }
    if(obeBarRef.current)    { clearInterval(obeBarRef.current);     obeBarRef.current    = null; }
    if(obeMateRef.current)   { clearTimeout(obeMateRef.current);     obeMateRef.current   = null; }
    if(obePreviewTRef.current){ clearTimeout(obePreviewTRef.current); obePreviewTRef.current = null; }
  };
  const getObeWindow = () => (1200 + (discipline / 1000) * 600) * 0.60; // 720〜1080ms（難易度UP: 元の60%）
  const getComboInc  = () => 0.1 + (focus / 1000) * 0.1;       // 0.1〜0.2

  const obeShowCmd = (idx: number) => {
    if(idx >= OBE_TOTAL) {
      // 全コマンド終了 → スコア集計
      clearObeTimers();
      const total = obeTotalRef.current;
      const score = Math.min(100, Math.round(total));
      let jud: 'PERFECT'|'GOOD'|'MISS'; let cm: string;
      if(score >= 80)  { jud='PERFECT'; cm=`オビディエンス完璧！スコア${score}点！`; }
      else if(score>=40){ jud='GOOD';    cm=`よくできました。スコア${score}点`; }
      else              { jud='MISS';    cm=`練習が必要... スコア${score}点`; }
      recordScore(score, jud, cm);
      return;
    }
    clearObeTimers();
    const cmd = obeCmdsRef.current[idx];
    obeCmdRef.current   = cmd;
    obeCmdIdxRef.current = idx;
    obeActiveRef.current = true;

    const hasPreview = intelligence >= 300;
    setObeCmd(cmd);
    setObePreview(hasPreview);
    setObeTimerPct(100);

    const startTimer = () => {
      setObePreview(false);
      const win = getObeWindow();
      // タイマーバー更新（20tick）
      const tickMs = win / 20;
      let tick = 0;
      const bar = setInterval(() => {
        tick++;
        setObeTimerPct(Math.max(0, 100 - (tick / 20) * 100));
        if(tick >= 20) { clearInterval(bar); obeBarRef.current = null; }
      }, tickMs);
      obeBarRef.current = bar;

      if(cmd === 'まて') {
        // まて: win ms 待ち続ければ成功
        const t = setTimeout(() => {
          if(!obeActiveRef.current) return;
          obeActiveRef.current = false;
          clearObeTimers();
          const newCombo = obeComboRef.current + 1;
          const pts = Math.round(20 * (1 + newCombo * getComboInc()));
          obeComboRef.current = newCombo;
          obeTotalRef.current += pts;
          setObeCombo(newCombo);
          setObeTotalPts(obeTotalRef.current);
          flashDog('happy');
          setTimeout(() => obeShowCmd(idx + 1), 450);
        }, win);
        obeMateRef.current = t;
      } else {
        // おすわり/ふせ: タイムアウトで失敗
        const t = setTimeout(() => {
          if(!obeActiveRef.current) return;
          obeActiveRef.current = false;
          clearObeTimers();
          obeComboRef.current = 0;
          setObeCombo(0);
          flashDog('sad');
          setTimeout(() => obeShowCmd(idx + 1), 450);
        }, win);
        obeTimerRef.current = t;
      }
    };

    if(hasPreview) {
      obePreviewTRef.current = setTimeout(startTimer, 500);
    } else {
      startTimer();
    }
  };

  const obeInput = (input: 'up'|'down') => {
    if(!obeActiveRef.current) return;
    const cmd = obeCmdRef.current;
    if(!cmd) return;
    const idx = obeCmdIdxRef.current;

    if(cmd === 'まて') {
      // まて中に入力 → 失敗
      obeActiveRef.current = false;
      clearObeTimers();
      obeComboRef.current = 0;
      setObeCombo(0);
      flashDog('sad');
      setTimeout(() => obeShowCmd(idx + 1), 450);
      return;
    }

    const correct = (cmd==='おすわり' && input==='up') || (cmd==='ふせ' && input==='down');
    obeActiveRef.current = false;
    clearObeTimers();

    if(correct) {
      const newCombo = obeComboRef.current + 1;
      const pts = Math.round(20 * (1 + newCombo * getComboInc()));
      obeComboRef.current = newCombo;
      obeTotalRef.current += pts;
      setObeCombo(newCombo);
      setObeTotalPts(obeTotalRef.current);
      flashDog('happy');
    } else {
      obeComboRef.current = 0;
      setObeCombo(0);
      flashDog('sad');
    }
    setTimeout(() => obeShowCmd(idx + 1), 450);
  };

  const obeStart = () => {
    // コマンド生成（5つ、連続3回同じにならないようにシャッフル）
    const pool: ObeCmd[] = ['おすわり','ふせ','まて'];
    const cmds: ObeCmd[] = [];
    for(let i=0;i<OBE_TOTAL;i++){
      let c: ObeCmd; let tries=0;
      do { c = pool[Math.floor(Math.random()*pool.length)]; tries++; }
      while(tries<8 && cmds.length>=2 && cmds[cmds.length-1]===c && cmds[cmds.length-2]===c);
      cmds.push(c);
    }
    obeCmdsRef.current  = cmds;
    obeComboRef.current = 0;
    obeTotalRef.current = 0;
    setObeCombo(0);
    setObeTotalPts(0);
    setPhase('running');
    obeShowCmd(0);
  };

  // ════════════════════════════════════════════
  // Round 1: ハイジャンプ（ハードル走 5本）
  // ════════════════════════════════════════════

  const hjDoJump = React.useCallback(() => {
    if(hjIsJumpingRef.current) return;
    hjIsJumpingRef.current = true;
    setHjDogJumping(true);
    Animated.sequence([
      Animated.timing(hjDogY, { toValue:-70, duration:260, useNativeDriver:true }),
      Animated.timing(hjDogY, { toValue:  0, duration:290, useNativeDriver:true }),
    ]).start(() => {
      hjIsJumpingRef.current = false;
      setHjDogJumping(false);
    });
  }, [hjDogY]);

  const hjStartGame = React.useCallback(() => {
    // 状態初期化
    hjClearedRef.current  = 0; hjEvalRef.current = 0;
    hjFinishedRef.current = false;
    hjIsJumpingRef.current= false;
    if(hjLoopRef.current) { clearInterval(hjLoopRef.current); hjLoopRef.current = null; }
    if(hjRunAnim.current) { hjRunAnim.current.stop(); hjRunAnim.current = null; }
    hjDogY.setValue(0);
    setHjCleared(0);
    setHjDogJumping(false);
    setJudgment(null);
    setPhase('running');

    // ハードルを右側に不揃い間隔で配置
    const hurdles: HjHurdle[] = HJ_HURDLE_OFFSETS.map((offset, i) => ({
      id: i, x: 1.05 + offset, passed: false,
    }));
    hjHurdlesRef.current = hurdles;
    setHjHurdles([...hurdles]);

    // ゲームループ（50ms）：ハードルを右から左へ移動
    const loop = setInterval(() => {
      if(hjFinishedRef.current) { clearInterval(loop); return; }

      let newEval = hjEvalRef.current;
      let newCleared = hjClearedRef.current;

      const updated = hjHurdlesRef.current.map(h => {
        const newX = h.x - HJ_HURDLE_SPEED;
        if(!h.passed && h.x >= HJ_DOG_X && newX < HJ_DOG_X) {
          // ハードルが犬の位置を通過した瞬間
          newEval += 1;
          if(hjIsJumpingRef.current) {
            newCleared += 1;
          }
          return { ...h, x: newX, passed: true };
        }
        return { ...h, x: newX };
      });

      hjEvalRef.current = newEval;
      hjClearedRef.current = newCleared;
      hjHurdlesRef.current = updated;
      setHjHurdles([...updated]);
      setHjCleared(newCleared);

      // 全ハードル評価済み → ゲーム終了
      if(newEval >= HJ_HURDLE_N) {
        hjFinishedRef.current = true;
        clearInterval(loop);
        hjLoopRef.current = null;
        const cl = newCleared;
        const ratio = cl / HJ_HURDLE_N;
        let score: number; let jud: 'PERFECT'|'GOOD'|'MISS'; let cm: string;
        if(ratio >= 1.0)      { score=100; jud='PERFECT'; cm=`完璧！全${HJ_HURDLE_N}本クリア！`; }
        else if(ratio >= 0.6) { score=70;  jud='GOOD';    cm=`${cl}/${HJ_HURDLE_N}本クリア！惜しい！`; }
        else if(ratio >= 0.2) { score=40;  jud='MISS';    cm=`${cl}/${HJ_HURDLE_N}本…もう少し！`; }
        else                  { score=10;  jud='MISS';    cm=`ハードルに激突…(${cl}/${HJ_HURDLE_N})`; }
        recordScore(score, jud, cm);
      }
    }, 50);
    hjLoopRef.current = loop;
  }, [hjDogY, recordScore]);

  const hjTap = React.useCallback(() => {
    if(phase === 'ready') { hjStartGame(); return; }
    if(phase !== 'running') return;
    hjDoJump();
  }, [phase, hjStartGame, hjDoJump]);

  // ════════════════════════════════════════════
  // Round 2: ロングラン（スタミナ・スピード）
  // ════════════════════════════════════════════
  const LONGRUN_DURATION = 5000; // ms
  const GAUGE_DECAY = 8;         // /tick: ゲージ自然減衰

  // スタミナが高いほどPerfectゾーン幅が広い（30%〜60%）
  const getLongrunPerfectMin = (): number => {
    const width = 30 + (stamina / maxSt) * 30;
    return 50 - width / 2;
  };
  const getLongrunPerfectMax = (): number => {
    const width = 30 + (stamina / maxSt) * 30;
    return 50 + width / 2;
  };
  // スピードが高いほど1タップのゲージ上昇量が大きい（8〜20）
  const getTapBoost = (): number => 8 + (speed / 1000) * 12;

  const longrunStart = React.useCallback(() => {
    setPhase('running');
    gaugeRef.current = 30;
    setGaugeValue(30);
    perfectMsRef.current = 0;
    setLongrunPerfectMs(0);
    longrunStartTime.current = Date.now();
    longrunLastTick.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - longrunStartTime.current;
      const delta = (now - longrunLastTick.current) / 1000;
      longrunLastTick.current = now;
      const remaining = Math.max(0, (LONGRUN_DURATION - elapsed) / 1000);
      setLongrunTimeLeft(Math.ceil(remaining));
      // ゲージ減衰
      const newGauge = Math.max(0, gaugeRef.current - GAUGE_DECAY * delta * 10);
      gaugeRef.current = newGauge;
      setGaugeValue(newGauge);
      // パーフェクトゾーン在中時間計測
      const pMin = getLongrunPerfectMin();
      const pMax = getLongrunPerfectMax();
      if(newGauge >= pMin && newGauge <= pMax) {
        perfectMsRef.current += (delta * 1000);
        setLongrunPerfectMs(perfectMsRef.current);
      }
      if(elapsed >= LONGRUN_DURATION) {
        clearInterval(interval);
        longrunInterval.current = null;
        const ratio = Math.min(1, perfectMsRef.current / LONGRUN_DURATION);
        let score: number; let jud: 'PERFECT'|'GOOD'|'MISS'; let cm: string;
        if(ratio >= 0.6)     { score=100; jud='PERFECT'; cm=`完走！Perfectゾーン維持率 ${Math.round(ratio*100)}%！`; }
        else if(ratio >= 0.3){ score=60;  jud='GOOD';    cm=`ロングラン完了。維持率 ${Math.round(ratio*100)}%`; }
        else                 { score=20;  jud='MISS';    cm=`スタミナ切れ気味... 維持率 ${Math.round(ratio*100)}%`; }
        recordScore(score, jud, cm);
      }
    }, 100);
    longrunInterval.current = interval;
  }, [stamina, maxSt, speed, recordScore]);

  const longrunTap = React.useCallback(() => {
    if(phase === 'ready') { longrunStart(); return; }
    if(phase !== 'running') return;
    const boost = getTapBoost();
    gaugeRef.current = Math.min(100, gaugeRef.current + boost);
    setGaugeValue(gaugeRef.current);
  }, [phase, speed, longrunStart]);

  // ════════════════════════════════════════════
  // メイン tap ハンドラ
  // ════════════════════════════════════════════
  const handleTap = React.useCallback(() => {
    if(phase === 'finish') return;
    if(round === 0) { /* obeディスパッチはUI内ボタンで直接呼ぶ */ return; }
    else if(round === 1) hjTap();
    else longrunTap();
  }, [round, phase, hjTap, longrunTap]);

  const totalScore = roundScores.reduce((a, b) => a + b, 0);

  // ─── ロングラン ゲージUI ─────────────────────────
  const pMin = getLongrunPerfectMin();
  const pMax = getLongrunPerfectMax();

  return (
    <View style={{flex:1, backgroundColor:'#1a2a4a'}}>
      {/* フィジカルコンテスト背景画像 */}
      <Image
        source={IMG_BG_PHYSICAL_CONTEST}
        style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%'}}
        resizeMode="contain"
      />
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(10,20,50,0.45)'}} pointerEvents="none"/>
      <SafeAreaView style={{flex:1}}>
      <View style={{flex:1,padding:16}}>
        {/* ヘッダー */}
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <Text style={{fontSize:18,fontWeight:'900',color:'#fff'}}>🏃 フィジカル大会</Text>
          <Text style={{fontSize:13,color:'#A8C5C6'}}>第{round+1}種目: {ROUNDS[round]}</Text>
        </View>

        {/* 実況ログ */}
        <View style={{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:10,padding:10,height:76,marginBottom:12,overflow:'hidden'}}>
          {commentary.slice(-3).map((c, i) => (
            <Text key={i} style={{color:'#f0f0f0',fontSize:11,marginBottom:2}}>{c}</Text>
          ))}
          {commentary.length === 0 && (
            <Text style={{color:'#8C7B6E',fontSize:12}}>実況：大会が始まります。準備を！</Text>
          )}
        </View>

        {/* ゲームエリア */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleTap}
          style={{flex:1,backgroundColor:'rgba(122,158,159,0.3)',borderRadius:16,position:'relative',overflow:'hidden',justifyContent:'center',alignItems:'center',borderWidth:2,borderColor:'#7A9E9F'}}
        >
          {/* ── Round 0: オビディエンス ─────────────── */}
          {round === 0 && (
            <>
              {/* 犬画像フラッシュ */}
              {dogFlash && (
                <View style={{position:'absolute',top:8,right:8,zIndex:10,pointerEvents:'none'}}>
                  <Image source={dogFlash==='happy' ? IMG_DOG_HAPPY : IMG_DOG_SAD}
                    style={{width:64,height:64,borderRadius:8,backgroundColor:'transparent'}} resizeMode="contain"/>
                </View>
              )}

              {phase === 'ready' && (
                <View style={{alignItems:'center',paddingHorizontal:16}}>
                  <Text style={{fontSize:22,color:'#fff',fontWeight:'900',marginBottom:8}}>🎓 オビディエンス</Text>
                  <Text style={{fontSize:13,color:'#A8C5C6',textAlign:'center',marginBottom:8}}>
                    指示に従い正しく操作せよ！（全5問）
                  </Text>
                  <View style={{flexDirection:'row',gap:12,marginBottom:10,flexWrap:'wrap',justifyContent:'center'}}>
                    <Text style={{fontSize:12,color:'#C9A96E'}}>⬆️ おすわり</Text>
                    <Text style={{fontSize:12,color:'#C9A96E'}}>⬇️ ふせ</Text>
                    <Text style={{fontSize:12,color:'#C9A96E'}}>✋ まて（待機）</Text>
                  </View>
                  <Text style={{fontSize:11,color:'#BCD5D5',marginBottom:12}}>
                    規律:{Math.round(discipline)}  知性:{Math.round(intelligence)}  集中力:{Math.round(focus)}
                  </Text>
                  <TouchableOpacity
                    style={{backgroundColor:'#e67e22',borderRadius:24,paddingHorizontal:28,paddingVertical:12}}
                    onPress={obeStart}
                  >
                    <Text style={{color:'#fff',fontWeight:'900',fontSize:16}}>スタート！</Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === 'running' && obeCmd && (
                <View style={{alignItems:'center',width:'92%'}}>
                  {obeCombo > 0 && (
                    <Text style={{color:'#C9A96E',fontWeight:'800',fontSize:13,marginBottom:4}}>
                      🔥 コンボ × {obeCombo}
                    </Text>
                  )}
                  {/* コマンド表示ボックス */}
                  <View style={{
                    backgroundColor: obePreview ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.22)',
                    borderRadius:16,
                    marginBottom:12, alignItems:'center', width:'100%',
                    borderWidth:2,
                    borderColor: obePreview ? 'rgba(255,255,255,0.25)' : '#C9A96E',
                    opacity: obePreview ? 0.55 : 1,
                    overflow:'hidden',
                    minHeight:140,
                    justifyContent:'flex-end',
                  }}>
                    <Image
                      source={obeCmd==='おすわり' ? IMG_OBE_SIT : obeCmd==='ふせ' ? IMG_OBE_DOWN : IMG_OBE_STAY}
                      style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}
                      resizeMode="cover"
                    />
                    <View style={{backgroundColor:'rgba(0,0,0,0.45)',width:'100%',alignItems:'center',paddingVertical:6}}>
                      <Text style={{fontSize:20,color:'#fff',fontWeight:'900'}}>{obeCmd}</Text>
                      {obePreview && <Text style={{fontSize:10,color:'#A8C5C6'}}>準備して…</Text>}
                    </View>
                  </View>
                  {/* タイマーバー */}
                  <View style={{width:'100%',height:8,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:4,overflow:'hidden',marginBottom:14}}>
                    <View style={{
                      height:'100%', borderRadius:4,
                      width:`${obeTimerPct}%` as any,
                      backgroundColor: obeTimerPct>50?'#8DAA91':obeTimerPct>20?'#D4974E':'#e74c3c',
                    }}/>
                  </View>
                  {/* 入力ボタン（おすわり・ふせ）— 待ての場合も表示してプレイヤーを惑わせる */}
                  {!obePreview && (
                    <View style={{flexDirection:'row',gap:20}}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: obeCmd==='おすわり'?'rgba(141,170,145,0.7)':'rgba(255,255,255,0.12)',
                          borderRadius:24,paddingHorizontal:24,paddingVertical:14,alignItems:'center',
                          borderWidth:2,borderColor:obeCmd==='おすわり'?'#8DAA91':'rgba(255,255,255,0.25)',
                        }}
                        onPress={()=>obeInput('up')}
                      >
                        <Text style={{fontSize:26}}>⬆️</Text>
                        <Text style={{color:'#fff',fontSize:11,marginTop:2}}>おすわり</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          backgroundColor: obeCmd==='ふせ'?'rgba(141,170,145,0.7)':'rgba(255,255,255,0.12)',
                          borderRadius:24,paddingHorizontal:24,paddingVertical:14,alignItems:'center',
                          borderWidth:2,borderColor:obeCmd==='ふせ'?'#8DAA91':'rgba(255,255,255,0.25)',
                        }}
                        onPress={()=>obeInput('down')}
                      >
                        <Text style={{fontSize:26}}>⬇️</Text>
                        <Text style={{color:'#fff',fontSize:11,marginTop:2}}>ふせ</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={{color:'#A8C5C6',fontSize:11,marginTop:10}}>
                    {obeCmdIdxRef.current+1}/{OBE_TOTAL}問  累積:{obeTotalPts}pt
                  </Text>
                </View>
              )}

              {judgment && phase === 'judged' && (
                <View style={{backgroundColor:judgment==='PERFECT'?'#C9A96E':judgment==='GOOD'?'#8DAA91':'#e74c3c',borderRadius:12,padding:12}}>
                  <Text style={{fontSize:32,fontWeight:'900',color:'#fff'}}>{judgment}</Text>
                </View>
              )}
            </>
          )}

          {/* ── Round 1: ハイジャンプ（犬固定・ハードル右→左）──── */}
          {round === 1 && (
            <>
              {/* 背景画像（全面表示） */}
              <Image
                source={IMG_BG_HIGHJUMP}
                style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}
                resizeMode="cover"
              />
              {/* 地面ライン */}
              <View style={{position:'absolute',top:'52%',left:0,right:0,height:2,backgroundColor:'rgba(255,255,255,0.4)'}}/>
              {/* 犬（固定位置・その場でジャンプ） */}
              <Animated.View style={{
                position:'absolute',
                top:'38%',
                left:`${HJ_DOG_X * 100}%` as any,
                width:44, height:44,
                justifyContent:'center', alignItems:'center',
                transform:[{translateY: hjDogY}],
                marginLeft:-22,
              }}>
                <Text style={{fontSize:32, transform:[{scaleX:-1}]}}>{hjDogJumping ? '🦘' : '🐕'}</Text>
              </Animated.View>
              {/* ハードル群（右から左へ流れる・不揃い間隔） */}
              {hjHurdles.map(h => (
                h.x >= -0.1 && h.x <= 1.15 ? (
                  <View key={h.id} style={{
                    position:'absolute',
                    top:'40%',
                    left:`${h.x * 100}%` as any,
                    width:48, height:60, marginLeft:-24,
                    opacity: h.passed ? 0.35 : 1,
                  }}>
                    <Image
                      source={IMG_HIGHJUMP_BAR}
                      style={{width:48, height:60}}
                      resizeMode="contain"
                    />
                  </View>
                ) : null
              ))}
              {/* クリアカウンター */}
              {phase === 'running' && (
                <View style={{position:'absolute',top:12,right:12,
                  backgroundColor:'rgba(0,0,0,0.55)',borderRadius:8,padding:8}}>
                  <Text style={{color:'#C9A96E',fontWeight:'800',fontSize:14}}>
                    ✓ {hjCleared} / {HJ_HURDLE_N}
                  </Text>
                </View>
              )}
              {phase === 'ready' && (
                <View style={{alignItems:'center',paddingHorizontal:16,backgroundColor:'rgba(0,0,0,0.5)',borderRadius:12,padding:16}}>
                  <Text style={{fontSize:20,color:'#fff',fontWeight:'800'}}>🦘 ハイジャンプ</Text>
                  <Text style={{fontSize:12,color:'#A8C5C6',marginTop:6,textAlign:'center'}}>
                    右から流れてくるハードルに合わせてタップ！{'\n'}全5本をクリアしよう
                  </Text>
                  <Text style={{fontSize:11,color:'#BCD5D5',marginTop:4}}>バネ:{Math.round(spring)}  スタミナ:{Math.round(stamina)}</Text>
                  <TouchableOpacity
                    style={{backgroundColor:'#e67e22',borderRadius:24,paddingHorizontal:28,paddingVertical:12,marginTop:10}}
                    onPress={hjStartGame}
                  >
                    <Text style={{color:'#fff',fontWeight:'900',fontSize:16}}>スタート！</Text>
                  </TouchableOpacity>
                </View>
              )}
              {judgment && phase === 'judged' && (
                <View style={{backgroundColor:judgment==='PERFECT'?'#C9A96E':judgment==='GOOD'?'#8DAA91':'#e74c3c',borderRadius:12,padding:12}}>
                  <Text style={{fontSize:32,fontWeight:'900',color:'#fff'}}>{judgment}</Text>
                </View>
              )}
            </>
          )}

          {/* ── Round 2: ロングラン ─────────────── */}
          {round === 2 && (
            <>
              {/* 背景画像（全面表示） */}
              <Image
                source={IMG_BG_LONGRUN}
                style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}
                resizeMode="cover"
              />
              {phase === 'ready' && (
                <View style={{alignItems:'center',backgroundColor:'rgba(0,0,0,0.55)',borderRadius:12,padding:16}}>
                  <Text style={{fontSize:20,color:'#fff',fontWeight:'800'}}>🏃 ロングラン</Text>
                  <Text style={{fontSize:12,color:'#A8C5C6',marginTop:4,textAlign:'center'}}>連打で犬をゾーン内に維持し続けろ！</Text>
                  <Text style={{fontSize:11,color:'#BCD5D5',marginTop:4}}>スタミナ:{Math.round(stamina)}  スピード:{Math.round(speed)}</Text>
                  <Text style={{fontSize:10,color:'#8DAA91',marginTop:4}}>タップでスタート</Text>
                </View>
              )}
              {(phase === 'running') && (
                <>
                  {/* ゾーン帯（横方向: pMin〜pMax） */}
                  <View style={{
                    position:'absolute',
                    left:`${pMin}%` as any,
                    top:0, bottom:0,
                    width:`${pMax-pMin}%` as any,
                    backgroundColor:'rgba(141,170,145,0.28)',
                    borderLeftWidth:2, borderRightWidth:2, borderColor:'rgba(141,170,145,0.8)',
                  }}>
                    <Text style={{position:'absolute',top:6,alignSelf:'center',color:'rgba(141,170,145,0.9)',fontSize:10,fontWeight:'700'}}>ZONE</Text>
                  </View>
                  {/* 走る犬（Y固定中央、X位置 = gaugeValue%） */}
                  <View style={{
                    position:'absolute',
                    top:'42%',
                    left:`${Math.max(0, Math.min(96, gaugeValue - 2))}%` as any,
                    width:44, height:44,
                    justifyContent:'center', alignItems:'center',
                  }}>
                    <Text style={{fontSize:30, transform:[{scaleX:-1}]}}>🐕</Text>
                  </View>
                  {/* 時間・スコアオーバーレイ */}
                  <View style={{position:'absolute',top:8,right:8,backgroundColor:'rgba(0,0,0,0.60)',borderRadius:8,padding:6,alignItems:'flex-end'}}>
                    <Text style={{color:'#C9A96E',fontWeight:'800',fontSize:13}}>残り {longrunTimeLeft}秒</Text>
                    <Text style={{color:'#8DAA91',fontSize:10}}>Zone: {(longrunPerfectMs/1000).toFixed(1)}s</Text>
                  </View>
                  {/* 目安ゲージ（画面下部の横バー） */}
                  <View style={{position:'absolute',bottom:28,left:12,right:12}}>
                    <Text style={{color:'rgba(255,255,255,0.7)',fontSize:9,marginBottom:3,textAlign:'center'}}>ゲージ（ゾーン内を維持しよう）</Text>
                    <View style={{height:14,backgroundColor:'rgba(0,0,0,0.5)',borderRadius:7,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.2)'}}>
                      {/* Perfect ゾーン帯 */}
                      <View style={{
                        position:'absolute',
                        left:`${pMin}%` as any,
                        width:`${pMax-pMin}%` as any,
                        top:0,bottom:0,
                        backgroundColor:'rgba(141,170,145,0.55)',
                      }}/>
                      {/* 現在のゲージ値ライン */}
                      <View style={{
                        position:'absolute',
                        left:`${Math.max(0,Math.min(98, gaugeValue - 1))}%` as any,
                        top:0,bottom:0,
                        width:3,
                        backgroundColor:'#fff',
                        borderRadius:2,
                      }}/>
                    </View>
                  </View>
                  {/* 連打ヒント */}
                  <Text style={{position:'absolute',bottom:8,alignSelf:'center',color:'rgba(255,255,255,0.55)',fontSize:10}}>連打でゾーン内を維持！</Text>
                </>
              )}
              {judgment && phase === 'judged' && (
                <View style={{backgroundColor:judgment==='PERFECT'?'#C9A96E':judgment==='GOOD'?'#8DAA91':'#e74c3c',borderRadius:12,padding:12}}>
                  <Text style={{fontSize:32,fontWeight:'900',color:'#fff'}}>{judgment}</Text>
                </View>
              )}
            </>
          )}

          {/* 大会終了 */}
          {phase === 'finish' && (
            <View style={{alignItems:'center',backgroundColor:'rgba(0,0,0,0.7)',padding:20,borderRadius:16}}>
              <Text style={{fontSize:24,fontWeight:'900',color:'#C9A96E',marginBottom:8}}>大会終了！</Text>
              <Text style={{fontSize:16,color:'#fff'}}>合計スコア: {totalScore}/300</Text>
              <Text style={{fontSize:13,color:'#A8C5C6',marginTop:4}}>
                {roundScores.map((s,i)=>`${ROUNDS[i].split(' ')[0]}: ${s}`).join('  ')}
              </Text>
              <TouchableOpacity
                style={{marginTop:16,backgroundColor:'#e67e22',borderRadius:24,paddingHorizontal:24,paddingVertical:12}}
                onPress={()=>{ finalizePhysical(totalScore, commentary); }}
              >
                <Text style={{color:'#fff',fontWeight:'900',fontSize:16}}>リザルト確認 →</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* スコア表示 */}
        <View style={{flexDirection:'row',gap:8,marginTop:12}}>
          {ROUNDS.map((r,i) => (
            <View key={i} style={{flex:1,backgroundColor:i<round?'rgba(141,170,145,0.3)':i===round?'rgba(201,169,110,0.3)':'rgba(255,255,255,0.1)',borderRadius:8,padding:8,alignItems:'center'}}>
              <Text style={{fontSize:10,color:'#A8C5C6'}}>{r.split(' ')[0]}</Text>
              <Text style={{fontSize:16,fontWeight:'800',color:'#fff'}}>{roundScores[i] ?? '-'}</Text>
            </View>
          ))}
        </View>

        {/* ライバル状況パネル */}
        {(() => {
          const completedRounds = phase === 'finish' ? 3 : phase === 'judged' ? round + 1 : round;
          return (
            <View style={{backgroundColor:'rgba(0,0,0,0.4)',borderRadius:10,marginTop:8,paddingHorizontal:8,paddingVertical:6}}>
              <Text style={{color:'#A8C5C6',fontSize:10,marginBottom:4}}>ライバル状況</Text>
              <View style={{flexDirection:'row',gap:5}}>
                {rivalRoundData.map((r, i) => {
                  const cumPts = r.pts.slice(0, completedRounds).reduce((a, b) => a + b, 0);
                  const succeed = completedRounds > 0 ? r.succeed[completedRounds - 1] : null;
                  return (
                    <View key={i} style={{flex:1,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:6,padding:4,alignItems:'center'}}>
                      <Text style={{color:'#fff',fontSize:9,fontWeight:'700'}} numberOfLines={1}>{r.name}</Text>
                      <Text style={{fontSize:9,fontWeight:'800',color:succeed===null?'#666':succeed?'#8DAA91':'#e74c3c'}}>
                        {succeed===null?'-':succeed?'Succeed':'Fail'}
                      </Text>
                      <Text style={{color:'#C9A96E',fontSize:10,fontWeight:'800'}}>{cumPts}pt</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}

        <TouchableOpacity style={{marginTop:8,alignItems:'center'}} onPress={onBack}>
          <Text style={{color:'#8C7B6E',fontSize:12}}>← 大会選択に戻る</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ContestBeautyScreen — ビューティー大会（フォトセッション）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ContestBeautyScreen({
  dog, onResult, onBack
}: {
  dog: DogState;
  onResult: (rank: number, score: number, commentary: string[], entries: ContestResultEntry[]) => void;
  onBack: () => void;
}) {
  const [shot, setShot] = React.useState(0);
  const [phase, setPhase] = React.useState<'aim'|'result'|'finish'>('aim');
  const [shotScores, setShotScores] = React.useState<number[]>([]);
  const [commentary, setCommentary] = React.useState<string[]>([]);
  const pointerPos = React.useRef(new Animated.Value(0)).current;
  const animRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const [stopped, setStopped] = React.useState<number | null>(null);

  // ショット順序固定: 1回目=毛並み, 2回目=愛嬌, 3回目=スタイル
  const SHOT_STATS: ('coat'|'charm'|'style')[] = ['coat','charm','style'];
  const SHOT_LABELS = ['✨ 毛並み', '😊 愛嬌', '👗 スタイル'];
  const chosen = SHOT_STATS[shot];

  // ライバル5頭のスコア（ゲーム開始時に確定）
  const [rivalScores] = React.useState<number[]>(() =>
    NW_RIVAL_DOGS.map(() => genRivalBeautyScore())
  );
  // ライバルのショット別データ
  const [rivalShotData] = React.useState(() =>
    NW_RIVAL_DOGS.map((r, i) => {
      const total = rivalScores[i];
      const s0 = Math.round(total * (0.28 + Math.random() * 0.12));
      const s1 = Math.round(total * (0.28 + Math.random() * 0.12));
      const s2 = Math.max(0, total - s0 - s1);
      const pts = [s0, s1, s2];
      return { name: r.name, pts, succeed: pts.map(p => p > 20) };
    })
  );
  const finalizeBeauty = React.useCallback((playerScore: number, cm: string[]) => {
    // チワワ特性: ビューティーコンテスト得点×1.05
    const adjustedScore = dog.breed === 'chihuahua' ? Math.round(playerScore * 1.05) : playerScore;
    const all: ContestResultEntry[] = [
      { rank:0, dogBreed: dog.breed ?? '柴犬', dogName: dog.dogName, score: adjustedScore, isPlayer: true },
      ...NW_RIVAL_DOGS.map((r, i) => ({ rank:0, dogBreed: r.breed, dogName: r.name, score: rivalScores[i], isPlayer: false })),
    ];
    all.sort((a, b) => b.score - a.score);
    all.forEach((e, i) => { e.rank = i + 1; });
    const me = all.find(e => e.isPlayer)!;
    onResult(me.rank, adjustedScore, cm, all);
  }, [dog.breed, dog.dogName, rivalScores, onResult]);

  const coat  = Math.min(100, dog.abilities.beauty.coat);
  const charm = Math.min(100, dog.abilities.beauty.charm);
  const style = dog.style ?? 0;

  const CENTER = 0.5;
  const GOOD_WINDOW = 0.20;

  const startPointer = () => {
    pointerPos.setValue(0);
    setStopped(null);
    const oscillate = Animated.loop(
      Animated.sequence([
        Animated.timing(pointerPos, { toValue: 1, duration: 800 + Math.random()*400, easing: (t) => t, useNativeDriver: false }),
        Animated.timing(pointerPos, { toValue: 0, duration: 800 + Math.random()*400, easing: (t) => t, useNativeDriver: false }),
      ])
    );
    animRef.current = oscillate;
    oscillate.start();
  };

  // phase が 'aim' になるたびにポインターを自動スタート
  React.useEffect(() => {
    if(phase === 'aim') {
      startPointer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shot]);

  const handleShot = () => {
    if(phase !== 'aim') return;
    animRef.current?.stop();
    const pos = (pointerPos as any)._value as number;
    setStopped(pos);

    const diff = Math.abs(pos - CENTER);
    let alignment: number;
    let judgeText: string;
    if(diff < 0.05) {
      alignment = 1.5; judgeText = 'ベストショット！！📸';
    } else if(diff < GOOD_WINDOW) {
      alignment = 1.1; judgeText = 'グッドショット！📷';
    } else {
      alignment = 0.7; judgeText = '惜しい...もう少し中央に';
    }

    const chosenMult = 1.5;
    let base = coat * 6 + charm * 4 + style * 5;
    if(chosen === 'coat') base = (coat * chosenMult) * 6 + charm * 4 + style * 5;
    if(chosen === 'charm') base = coat * 6 + (charm * chosenMult) * 4 + style * 5;
    if(chosen === 'style') base = coat * 6 + charm * 4 + (style * chosenMult) * 5;
    const score = Math.round(base * alignment / 10);

    const chosenLabel = chosen === 'coat' ? '毛並み' : chosen === 'charm' ? '愛嬌' : 'スタイル';
    const cm = `[第${shot+1}ショット] ${judgeText} ${chosenLabel} スコア+${score}`;
    setCommentary(prev => [...prev, cm]);
    const newScores = [...shotScores, score];
    setShotScores(newScores);
    setPhase('result');

    setTimeout(() => {
      if(shot < 2) {
        setShot(s => s + 1);
        setPhase('aim');
      } else {
        setPhase('finish');
      }
    }, 1500);
  };

  const totalScore = shotScores.reduce((a,b)=>a+b,0);

  return (
    <View style={{flex:1, backgroundColor:'#1a0a2e'}}>
      {/* ビューティーコンテスト背景画像（フォトセッション用） */}
      <Image
        source={IMG_BG_BEAUTY_PHOTO_SESSION}
        style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%'}}
        resizeMode="cover"
      />
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(30,5,40,0.45)'}} pointerEvents="none"/>
      <SafeAreaView style={{flex:1}}>
      <View style={{flex:1,padding:16}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:12,alignItems:'center'}}>
          <Text style={{fontSize:18,fontWeight:'900',color:'#fff'}}>📸 ビューティー大会</Text>
          <View style={{backgroundColor:'rgba(201,107,138,0.35)',borderRadius:12,paddingHorizontal:10,paddingVertical:4}}>
            <Text style={{fontSize:12,color:'#fff',fontWeight:'800'}}>{SHOT_LABELS[shot] ?? ''} ({shot+1}/3)</Text>
          </View>
        </View>

        {/* 実況ログ */}
        <View style={{backgroundColor:'rgba(255,255,255,0.1)',borderRadius:10,padding:10,height:70,marginBottom:12,overflow:'hidden'}}>
          {commentary.slice(-2).map((c,i) => (
            <Text key={i} style={{color:'#f0f0f0',fontSize:11,marginBottom:2}}>{c}</Text>
          ))}
          {commentary.length===0 && <Text style={{color:'#8C7B6E',fontSize:12}}>実況：フォトセッション、スタート！</Text>}
        </View>

        {/* 現在ショットの評価ステータス表示 */}
        {phase !== 'finish' && (
          <View style={{backgroundColor:'rgba(201,107,138,0.2)',borderRadius:12,padding:10,marginBottom:12,flexDirection:'row',alignItems:'center',gap:10}}>
            <Text style={{color:'#E0BEC8',fontSize:12}}>このショットは</Text>
            <View style={{backgroundColor:'#C96B8A',borderRadius:8,paddingHorizontal:10,paddingVertical:4}}>
              <Text style={{color:'#fff',fontWeight:'900',fontSize:13}}>{SHOT_LABELS[shot]}</Text>
            </View>
            <Text style={{color:'#E0BEC8',fontSize:12}}>を×1.5倍計上</Text>
          </View>
        )}

        {/* 目押しゲーム（背景が透けるよう半透明） */}
        {(phase === 'aim' || phase === 'result') && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={phase==='aim'?handleShot:undefined}
            style={{backgroundColor:'rgba(201,107,138,0.12)',borderRadius:16,height:120,position:'relative',overflow:'hidden',justifyContent:'center',marginBottom:12,borderWidth:2,borderColor:'rgba(201,107,138,0.6)'}}
          >
            {/* ベストショット枠（中央） */}
            <View style={{
              position:'absolute',
              left:`${(CENTER-0.05)*100}%` as any,
              top:0,bottom:0,width:'10%',
              backgroundColor:'rgba(201,169,110,0.4)',
              borderLeftWidth:2,borderRightWidth:2,borderColor:'#C9A96E'
            }}/>
            {/* GOOD枠 */}
            <View style={{
              position:'absolute',
              left:`${(CENTER-GOOD_WINDOW)*100}%` as any,
              top:0,bottom:0,width:`${GOOD_WINDOW*2*100}%` as any,
              backgroundColor:'rgba(141,170,145,0.2)',
            }}/>
            {/* ポインター */}
            <Animated.View style={{
              position:'absolute',
              top:10,bottom:10,
              left: pointerPos.interpolate({inputRange:[0,1],outputRange:['0%','95%']}),
              width:6,
              backgroundColor:'#C96B8A',
              borderRadius:3,
            }}/>
            {/* 止まった位置 */}
            {stopped !== null && (
              <View style={{
                position:'absolute',
                top:10,bottom:10,
                left:`${stopped*95}%` as any,
                width:6,
                backgroundColor:'#C9A96E',
                borderRadius:3,
              }}/>
            )}
            {phase==='aim' && <Text style={{color:'#fff',fontSize:16,fontWeight:'800',textAlign:'center'}}>タップでシャッター！</Text>}
            {phase==='result' && (
              <Text style={{color:'#C9A96E',fontSize:18,fontWeight:'900',textAlign:'center'}}>
                {shotScores[shotScores.length-1] > 50 ? '📸 カシャ！' : '📷 パシャ...'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* フィニッシュ */}
        {phase === 'finish' && (
          <View style={{backgroundColor:'rgba(0,0,0,0.7)',borderRadius:16,padding:20,alignItems:'center'}}>
            <Text style={{fontSize:24,fontWeight:'900',color:'#C9A96E',marginBottom:8}}>フォトセッション終了！</Text>
            <Text style={{fontSize:16,color:'#fff'}}>合計スコア: {totalScore}</Text>
            <TouchableOpacity
              style={{marginTop:16,backgroundColor:'#C96B8A',borderRadius:24,paddingHorizontal:24,paddingVertical:12}}
              onPress={()=>{ finalizeBeauty(totalScore, commentary); }}
            >
              <Text style={{color:'#fff',fontWeight:'900',fontSize:16}}>リザルト確認 →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* スコア */}
        <View style={{flexDirection:'row',gap:8,marginTop:'auto'}}>
          {[0,1,2].map(i=>(
            <View key={i} style={{flex:1,backgroundColor:i<shot?'rgba(141,170,145,0.3)':i===shot?'rgba(201,107,138,0.3)':'rgba(255,255,255,0.1)',borderRadius:8,padding:8,alignItems:'center'}}>
              <Text style={{fontSize:10,color:'#E0BEC8'}}>Shot {i+1}</Text>
              <Text style={{fontSize:16,fontWeight:'800',color:'#fff'}}>{shotScores[i] ?? '-'}</Text>
            </View>
          ))}
        </View>
        {/* ライバル状況パネル */}
        {(() => {
          const completedShots = phase === 'finish' ? 3 : phase === 'result' ? shot + 1 : shot;
          return (
            <View style={{backgroundColor:'rgba(0,0,0,0.4)',borderRadius:10,marginTop:6,paddingHorizontal:8,paddingVertical:6}}>
              <Text style={{color:'#E0BEC8',fontSize:10,marginBottom:4}}>ライバル状況</Text>
              <View style={{flexDirection:'row',gap:5}}>
                {rivalShotData.map((r, i) => {
                  const cumPts = r.pts.slice(0, completedShots).reduce((a, b) => a + b, 0);
                  const succeed = completedShots > 0 ? r.succeed[completedShots - 1] : null;
                  return (
                    <View key={i} style={{flex:1,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:6,padding:4,alignItems:'center'}}>
                      <Text style={{color:'#fff',fontSize:9,fontWeight:'700'}} numberOfLines={1}>{r.name}</Text>
                      <Text style={{fontSize:9,fontWeight:'800',color:succeed===null?'#666':succeed?'#8DAA91':'#e74c3c'}}>
                        {succeed===null?'-':succeed?'Succeed':'Fail'}
                      </Text>
                      <Text style={{color:'#C9A96E',fontSize:10,fontWeight:'800'}}>{cumPts}pt</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })()}
        <TouchableOpacity style={{marginTop:8,alignItems:'center'}} onPress={onBack}>
          <Text style={{color:'#8C7B6E',fontSize:12}}>← 大会選択に戻る</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </View>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ─────────────────────────────────────────────────────────────────────────
// ノーズワーク競技 — スプライトシート定数
// ─────────────────────────────────────────────────────────────────────────
const NW_COLS      = 11;   // スプライトシート列数
const NW_FRAME_PX  = 256;  // 1フレームのサイズ
const NW_SHEET_W   = 2816; // シート幅
const NW_SHEET_H   = 1536; // シート高さ

// アニメーション定義（JSON仕様より）
const NW_ANIM = {
  walk:             { start: 0,  end: 5,  fps: 8  },
  sniff_tracking:   { start: 6,  end: 11, fps: 8  },
  sniff_react:      { start: 12, end: 17, fps: 10 },
  sniff_focus:      { start: 18, end: 23, fps: 12 },
  sign_focus_point: { start: 24, end: 29, fps: 8  },
  alert_bark:       { start: 30, end: 33, fps: 8  },
  alert_success:    { start: 34, end: 35, fps: 6  },
  alert_miss:       { start: 36, end: 39, fps: 8  },
  alert_miss_text:  { start: 40, end: 41, fps: 6  },
  scent_ripples:    { start: 42, end: 45, fps: 6  },
} as const;

type NWAnimKey = keyof typeof NW_ANIM;
type DogPhase = 'walking'|'sniff_tracking'|'sniff_react'|'sniff_focus'|'sign_focus_point'|'alert_bark'|'alert_success'|'alert_miss'|'done';

// ノーズワーク ライバル犬データ（5頭固定）
const NW_RIVAL_DOGS = [
  { name:'ルナ',  breed:'ラブラドール'   },
  { name:'ソラ',  breed:'ボーダーコリー' },
  { name:'ハル',  breed:'ゴールデン'     },
  { name:'クウ',  breed:'ビーグル'       },
  { name:'モコ',  breed:'スプリンガー'   },
];

/** ライバルのノーズワークスコアを乱数生成（Intelligence相当 500 基準） */
function genRivalNWScore(baseIntel: number): number {
  const tier = Math.random();
  if (tier < 0.15) return Math.round(200 + Math.random() * 160);   // 上位
  if (tier < 0.50) return Math.round(100 + Math.random() * 130);   // 中位
  return Math.round(20 + Math.random() * 80);                       // 下位
}

// フィールド内8コンテナの配置（中心点 %）4列×2行
const NW_CONTAINERS = [
  { cx: 12, cy: 28 }, // 0  上列左
  { cx: 37, cy: 22 }, // 1  上列中左
  { cx: 63, cy: 22 }, // 2  上列中右
  { cx: 88, cy: 28 }, // 3  上列右
  { cx: 12, cy: 72 }, // 4  下列左
  { cx: 37, cy: 78 }, // 5  下列中左
  { cx: 63, cy: 78 }, // 6  下列中右
  { cx: 88, cy: 72 }, // 7  下列右
];

// コンテナの隣接グラフ（近接度優先で波紋候補を決める）
const NW_ADJACENCY: Record<number, number[]> = {
  0: [1, 4],       1: [0, 2, 5],    2: [1, 3, 6],   3: [2, 7],
  4: [0, 5],       5: [1, 4, 6],    6: [2, 5, 7],   7: [3, 6],
};

// Intelligence に基づき波紋コンテナ集合を決定（正解1 + 隣接最大3 + ゴースト最大1 = 最大5個）
function calcRippleContainers(intelligence: number, correct: number): number[] {
  const lv = intelligence <= 250 ? 1 : intelligence <= 500 ? 2 : intelligence <= 750 ? 3 : 4;
  const extra = lv === 1 ? 3 : lv === 2 ? 2 : lv === 3 ? 1 : 0;
  const pool = [...NW_ADJACENCY[correct]];
  const selected: number[] = [correct];
  for (let i = 0; i < extra && pool.length > 0; i++) {
    const pick = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(pick, 1)[0]);
  }
  // Ghost ripple: intelligence < 400 → 偽波紋を1箇所追加
  if (intelligence < 400) {
    const ghosts = [0,1,2,3,4,5,6,7].filter(c => !selected.includes(c));
    if (ghosts.length > 0) {
      selected.push(ghosts[Math.floor(Math.random() * ghosts.length)]);
    }
  }
  return selected;
}

// ─────────────────────────────────────────────────────────────────────────
// ScentRipple — 匂い波紋エフェクト（同心円2重パルス）
// ─────────────────────────────────────────────────────────────────────────
function ScentRipple({ size }: { size: number }) {
  const scale1   = React.useRef(new Animated.Value(0.3)).current;
  const scale2   = React.useRef(new Animated.Value(0.3)).current;
  const opacity1 = React.useRef(new Animated.Value(1)).current;
  const opacity2 = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const makeLoop = (s: Animated.Value, o: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s, { toValue: 1,   duration: 1800, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0,   duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 0.3, duration: 0,    useNativeDriver: true }),
          Animated.timing(o, { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
      ]));
    const a1 = makeLoop(scale1, opacity1, 0);
    const a2 = makeLoop(scale2, opacity2, 900);
    a1.start(); a2.start();
    return () => { a1.stop(); a2.stop(); };
  }, []);

  return (
    <View style={{ width: size, height: size, alignItems:'center', justifyContent:'center' }}>
      {([{ s: scale1, o: opacity1 }, { s: scale2, o: opacity2 }] as const).map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          width:  size * 0.85, height: size * 0.85,
          borderRadius: size * 0.425,
          borderWidth: 2.5,
          borderColor: 'rgba(100,220,160,0.85)',
          transform: [{ scale: p.s }],
          opacity: p.o,
        }}/>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// NWSprite — スプライトシートから1フレームを切り出して描画
// ─────────────────────────────────────────────────────────────────────────
function NWSprite({ frame, size }: { frame: number; size: number }) {
  const col   = frame % NW_COLS;
  const row   = Math.floor(frame / NW_COLS);
  const scale = size / NW_FRAME_PX;
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        source={IMG_NW_SPRITE}
        style={{
          width:  NW_SHEET_W * scale,
          height: NW_SHEET_H * scale,
          marginLeft: -col * size,
          marginTop:  -row * size,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ContestNoseworkScreen — ハンドラー視点 ノーズワーク競技ミニゲーム v2
// ─────────────────────────────────────────────────────────────────────────
function ContestNoseworkScreen({
  dog, onResult, onBack
}: {
  dog: DogState;
  onResult: (rank: number, score: number, commentary: string[], entries: ContestResultEntry[]) => void;
  onBack: () => void;
}) {
  const intelligence  = dog.abilities.intelligence;
  const focusStat     = dog.abilities.physical.focus ?? 0;

  // ── ゲーム定数
  const GAME_SEC      = 60;
  const WALK_SPEED_MS = Math.max(600, 1400 - Math.round(focusStat * 0.8));  // 移動所要時間
  const SNIFF_BASE_MS = Math.max(800, 2000 - Math.round(focusStat * 1.2));  // 通常嗅ぎ時間
  const SIGN_HOLD_MS  = Math.max(500, 400 + Math.round(focusStat * 0.9));   // サイン継続時間
  const DEVIATE_PROB  = Math.max(0, 0.55 - focusStat / 1400);               // 脱線確率
  const MISS_PROB     = Math.max(0, 0.40 - focusStat / 1600);               // 正解素通り確率

  // ── 初期設定（1回だけ）
  const [correctIndex]   = React.useState(() => Math.floor(Math.random() * 8));
  const [rippleSet]      = React.useState<number[]>(() => calcRippleContainers(intelligence, correctIndex));
  // ライバル5頭のスコアをゲーム開始時に確定（画面外で競技済み扱い）
  const [rivalScores]    = React.useState<number[]>(() =>
    NW_RIVAL_DOGS.map(() => genRivalNWScore(intelligence))
  );
  // ライバルの結果データ（スコアと成否）
  const [rivalFinalData] = React.useState(() =>
    NW_RIVAL_DOGS.map((r, i) => ({
      name: r.name,
      score: rivalScores[i],
      succeed: rivalScores[i] >= 50,
    }))
  );

  // ── ゲーム進行 state
  const [timeLeft,    setTimeLeft]    = React.useState(GAME_SEC);
  const [gamePhase,   setGamePhase]   = React.useState<'playing'|'judging'|'done'>('playing');
  const [dogPhase,    setDogPhase]    = React.useState<DogPhase>('sniff_tracking');
  const [dogContainer,setDogContainer]= React.useState(0);           // 現在いるコンテナ
  const [spriteFrame, setSpriteFrame] = React.useState(0);
  const [commentary,  setCommentary]  = React.useState<string[]>(['👤 ハンドラー：スタート！']);
  const [focusBoost,  setFocusBoost]  = React.useState(0);            // Focusボタン使用回数
  const [zoomed,      setZoomed]      = React.useState(false);        // 自動ズーム
  const [alertResult, setAlertResult] = React.useState<'success'|'miss'|null>(null);
  const [resultScore, setResultScore] = React.useState(0);
  // ── ref（setInterval / 犬のAI状態）
  const gameTimerRef   = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const animTimerRef   = React.useRef<ReturnType<typeof setInterval>|null>(null);
  const rippleTimerRef = React.useRef<ReturnType<typeof setInterval>|null>(null); // 予備（未使用）
  const aiTimerRef     = React.useRef<ReturnType<typeof setTimeout>|null>(null);
  const dogPhaseRef    = React.useRef<DogPhase>('sniff_tracking');
  const dogContRef     = React.useRef(0);
  const timeRef        = React.useRef(GAME_SEC);
  const focusRef       = React.useRef(0);
  const gameActiveRef  = React.useRef(true);

  const addLog = React.useCallback((msg: string) => {
    setCommentary(prev => [...prev.slice(-6), msg]);
  }, []);

  /** プレイヤースコアを含む全参加者リストを生成してonResultを呼ぶ */
  const finalize = React.useCallback((playerScore: number, commentary: string[]) => {
    // 全エントリー（プレイヤー + ライバル5頭）をスコア降順ソートして順位付け
    const all: ContestResultEntry[] = [
      { rank: 0, dogBreed: dog.breed ?? '柴犬', dogName: dog.dogName, score: playerScore, isPlayer: true },
      ...NW_RIVAL_DOGS.map((r, i) => ({
        rank: 0, dogBreed: r.breed, dogName: r.name, score: rivalScores[i], isPlayer: false,
      })),
    ];
    all.sort((a, b) => b.score - a.score);
    all.forEach((e, i) => { e.rank = i + 1; });
    const playerEntry = all.find(e => e.isPlayer)!;
    onResult(playerEntry.rank, playerScore, commentary, all);
  }, [dog.breed, dog.dogName, rivalScores, onResult]);

  // ── スプライトアニメーション切り替え
  const playAnim = React.useCallback((key: NWAnimKey) => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    const anim = NW_ANIM[key];
    setSpriteFrame(anim.start);
    let cur = anim.start;
    const interval = Math.round(1000 / anim.fps);
    animTimerRef.current = setInterval(() => {
      cur = cur >= anim.end ? anim.start : cur + 1;
      setSpriteFrame(cur);
    }, interval);
  }, []);

  const setDogState = React.useCallback((phase: DogPhase) => {
    dogPhaseRef.current = phase;
    setDogPhase(phase);
    if (phase === 'walking')          playAnim('walk');
    else if (phase === 'sniff_tracking') playAnim('sniff_tracking');
    else if (phase === 'sniff_react')    playAnim('sniff_react');
    else if (phase === 'sniff_focus')    playAnim('sniff_focus');
    else if (phase === 'sign_focus_point') playAnim('sign_focus_point');
    else if (phase === 'alert_bark')     playAnim('alert_bark');
    else if (phase === 'alert_success')  playAnim('alert_success');
    else if (phase === 'alert_miss')     playAnim('alert_miss');
  }, [playAnim]);

  // ── 犬の自律AI（コンテナ間を自律探索）
  const runDogAI = React.useCallback(() => {
    if (!gameActiveRef.current) return;
    const cur = dogContRef.current;

    // 次のターゲット決定
    let next: number;
    const willDeviate = Math.random() < DEVIATE_PROB && focusRef.current === 0;

    if (willDeviate) {
      // 脱線：完全ランダムなコンテナへ
      const others = [0,1,2,3,4,5,6,7].filter(c => c !== cur);
      next = others[Math.floor(Math.random() * others.length)];
      addLog('🐕 ...あれ？どこ行くの？');
    } else {
      // 波紋コンテナを優先、なければランダム隣接
      const rippleCandidates = NW_ADJACENCY[cur].filter(c => rippleSet.includes(c));
      const candidates = rippleCandidates.length > 0
        ? rippleCandidates
        : NW_ADJACENCY[cur];
      next = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // 移動フェーズ
    dogContRef.current = next;
    setDogContainer(next);
    setDogState('walking');

    aiTimerRef.current = setTimeout(() => {
      if (!gameActiveRef.current) return;
      const isRipple  = rippleSet.includes(next);
      const isCorrect = next === correctIndex;

      if (isCorrect) {
        // 正解コンテナ到達
        const effectiveConc = focusStat + focusRef.current * 100;
        const willMiss = Math.random() < MISS_PROB && effectiveConc < 600;
        if (willMiss) {
          // 素通りリスク
          setDogState('sniff_tracking');
          addLog('🐽 ...うーん、もう少しかな？');
          setZoomed(false);
          aiTimerRef.current = setTimeout(runDogAI, SNIFF_BASE_MS * 0.5);
        } else {
          // 正解反応！
          setZoomed(true);
          setDogState('sniff_react');
          addLog('🐽 鼻がぴくぴく！強い匂い！');
          aiTimerRef.current = setTimeout(() => {
            if (!gameActiveRef.current) return;
            setDogState('sniff_focus');
            addLog('🎯 集中！もしかしてここ？');
            aiTimerRef.current = setTimeout(() => {
              if (!gameActiveRef.current) return;
              setDogState('sign_focus_point');
              addLog('🐕 お座り！サイン出した！ → ALERT !');
              aiTimerRef.current = setTimeout(() => {
                if (!gameActiveRef.current) return;
                setZoomed(false);
                setDogState('sniff_tracking');
                runDogAI();
              }, SIGN_HOLD_MS);
            }, SNIFF_BASE_MS * 0.6);
          }, SNIFF_BASE_MS * 0.7);
        }
      } else if (isRipple) {
        // 波紋コンテナ（正解ではない）
        setZoomed(true);
        setDogState('sniff_react');
        addLog('🐽 匂いが漂ってる...');
        aiTimerRef.current = setTimeout(() => {
          if (!gameActiveRef.current) return;
          setZoomed(false);
          setDogState('sniff_tracking');
          runDogAI();
        }, SNIFF_BASE_MS * 0.8);
      } else {
        // 無反応コンテナ
        setDogState('sniff_tracking');
        setZoomed(false);
        aiTimerRef.current = setTimeout(runDogAI, SNIFF_BASE_MS * 0.4);
      }
    }, WALK_SPEED_MS);
  }, [correctIndex, rippleSet, focusStat, DEVIATE_PROB, MISS_PROB, WALK_SPEED_MS, SNIFF_BASE_MS, SIGN_HOLD_MS, addLog, setDogState]);

  // ── ゲーム初期化
  React.useEffect(() => {
    gameActiveRef.current = true;

    // タイマー
    gameTimerRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1;
        timeRef.current = next;
        if (next <= 0) {
          gameActiveRef.current = false;
          if (gameTimerRef.current)   clearInterval(gameTimerRef.current);
          if (animTimerRef.current)   clearInterval(animTimerRef.current);
          if (rippleTimerRef.current) clearInterval(rippleTimerRef.current);
          if (aiTimerRef.current)     clearTimeout(aiTimerRef.current);
          setGamePhase('done');
          setDogPhase('done');
          setAlertResult('miss');
          setResultScore(5);
          setCommentary(prev => {
            const next = [...prev, '⏰ タイムアップ！Alert を出せなかった...'];
            setTimeout(() => finalize(5, next), 2500);
            return next;
          });
        }
        return next;
      });
    }, 1000);

    // AI開始
    playAnim('sniff_tracking');
    setTimeout(runDogAI, 800);

    return () => {
      gameActiveRef.current = false;
      if (gameTimerRef.current)   clearInterval(gameTimerRef.current);
      if (animTimerRef.current)   clearInterval(animTimerRef.current);
      if (rippleTimerRef.current) clearInterval(rippleTimerRef.current);
      if (aiTimerRef.current)     clearTimeout(aiTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focusボタン
  const handleFocus = React.useCallback(() => {
    if (gamePhase !== 'playing') return;
    setFocusBoost(b => b + 1);
    focusRef.current += 1;
    addLog('💪 集中コマンド！犬が引き締まった');
    if (focusRef.current >= 4) {
      addLog('😤 集中させすぎ！犬が興奮してきた...');
    }
  }, [gamePhase, addLog]);

  // ── Alertボタン
  const handleAlert = React.useCallback(() => {
    if (gamePhase !== 'playing' || alertResult !== null) return;
    gameActiveRef.current = false;
    if (gameTimerRef.current)   clearInterval(gameTimerRef.current);
    if (animTimerRef.current)   clearInterval(animTimerRef.current);
    if (aiTimerRef.current)     clearTimeout(aiTimerRef.current);

    const curContainer  = dogContRef.current;
    const curPhase      = dogPhaseRef.current;
    const isCorrectCont = curContainer === correctIndex;
    const isSigning     = curPhase === 'sign_focus_point';
    const timeBonus     = Math.round(timeRef.current * 2.5);

    setGamePhase('judging');

    if (isCorrectCont && isSigning) {
      // 完全成功
      const score = 200 + timeBonus;
      setResultScore(score);
      setAlertResult('success');
      setDogState('alert_bark');
      addLog(`🎉 ALERT成功！スコア${score}！ タイムボーナス+${timeBonus}`);
      setTimeout(() => { setDogState('alert_success'); }, 1200);
      setTimeout(() => {
        setGamePhase('done');
        finalize(score, []);
      }, 3000);
    } else if (isCorrectCont && !isSigning) {
      // 正解コンテナだが犬のサインなし（早押し）
      const score = 80 + Math.round(timeBonus * 0.4);
      setResultScore(score);
      setAlertResult('miss');
      setDogState('alert_miss');
      addLog(`⚠️ 正解コンテナだがサインなし。スコア${score}`);
      setTimeout(() => {
        setGamePhase('done');
        finalize(score, []);
      }, 2500);
    } else {
      // 誤コンテナ → 失格
      setResultScore(0);
      setAlertResult('miss');
      setDogState('alert_miss');
      addLog(`❌ エラーアラート！${curContainer+1}番は不正解。失格...`);
      setTimeout(() => {
        setGamePhase('done');
        finalize(0, []);
      }, 2500);
    }
  }, [gamePhase, alertResult, correctIndex, addLog, setDogState, finalize]);

  // ── レイアウト
  const FIELD_H       = 300;
  const DOG_SIZE      = 72;
  const CONT_SIZE     = 44;
  const isUrgent      = timeLeft <= 30 && gamePhase === 'playing';
  const zoomScale     = zoomed && gamePhase === 'playing' ? 1.5 : 1.0;
  const curCont       = NW_CONTAINERS[dogContainer];

  return (
    <View style={{ flex:1, backgroundColor:'#0D1B20' }}>
      {/* ノーズワークコンテスト背景画像 */}
      <Image
        source={IMG_BG_NOSEWORK_CONTEST}
        style={{position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%'}}
        resizeMode="contain"
      />
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(5,18,20,0.50)'}} pointerEvents="none"/>
      <SafeAreaView style={{ flex:1 }}>
      <View style={{ flex:1, paddingHorizontal:12, paddingTop:8 }}>

        {/* ── ヘッダー */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <Text style={{ fontSize:16, fontWeight:'900', color:'#7A9E9F' }}>👃 ノーズワーク競技</Text>
          <View style={{ alignItems:'center' }}>
            <Text style={{
              fontSize: 24, fontWeight:'900',
              color: timeLeft <= 10 ? '#e74c3c' : isUrgent ? '#e67e22' : '#8DAA91',
              opacity: isUrgent && timeLeft % 2 === 0 ? 0.6 : 1.0,
            }}>{timeLeft}s</Text>
          </View>
          <TouchableOpacity onPress={onBack}>
            <Text style={{ color:'#8C7B6E', fontSize:12 }}>← 戻る</Text>
          </TouchableOpacity>
        </View>

        {/* ── 実況ログ */}
        <View style={{ backgroundColor:'rgba(122,158,159,0.12)', borderRadius:10, padding:8, height:52, marginBottom:8, overflow:'hidden' }}>
          {commentary.slice(-3).map((c,i) => (
            <Text key={i} style={{ color: i === commentary.slice(-3).length-1 ? '#F9F7F2' : '#8C7B6E', fontSize:11, lineHeight:16 }}>{c}</Text>
          ))}
        </View>

        {/* ── フィールド */}
        <View style={{
          height: FIELD_H,
          backgroundColor: 'rgba(30,50,40,0.85)',
          borderRadius: 16,
          borderWidth: 2,
          borderColor: 'rgba(122,158,159,0.4)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: 8,
        }}>

          {/* フィールド背景画像 */}
          <Image
            source={IMG_NW_FIELD_BG}
            style={{position:'absolute',top:0,left:0,right:0,bottom:0,width:'100%',height:'100%'}}
            resizeMode="cover"
          />

          {/* コンテナ（8個） */}
          {NW_CONTAINERS.map((cont, idx) => {
            const isRipple  = rippleSet.includes(idx);
            const isDone    = gamePhase === 'done' || gamePhase === 'judging';
            const isCorrectRevealed = isDone && idx === correctIndex;
            const isWrong   = isDone && alertResult === 'miss' && idx !== correctIndex && dogContRef.current === idx;
            const cx = `${cont.cx}%`;
            const cy = `${cont.cy}%`;
            return (
              <View
                key={idx}
                style={{
                  position: 'absolute',
                  left: cx as any, top: cy as any,
                  width: CONT_SIZE, height: CONT_SIZE,
                  marginLeft: -CONT_SIZE/2, marginTop: -CONT_SIZE/2,
                  borderRadius: CONT_SIZE/2,
                  backgroundColor: isCorrectRevealed ? 'rgba(141,170,145,0.50)'
                    : isWrong ? 'rgba(192,57,43,0.50)'
                    : 'rgba(50,80,65,0.45)',
                  borderWidth: 2,
                  borderColor: isCorrectRevealed ? '#8DAA91'
                    : isWrong ? '#e74c3c'
                    : 'rgba(122,158,159,0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {isCorrectRevealed ? (
                  <Text style={{ fontSize:20 }}>💎</Text>
                ) : isWrong ? (
                  <Text style={{ fontSize:18 }}>❌</Text>
                ) : (
                  <Text style={{ fontSize:13, color:'rgba(255,255,255,0.45)', fontWeight:'700' }}>{idx+1}</Text>
                )}

                {/* 匂い波紋アニメ（波紋コンテナのみ） */}
                {isRipple && !isDone && (
                  <View style={{ position:'absolute', top:-24, left:-24, width:CONT_SIZE+48, height:CONT_SIZE+48 }}>
                    <ScentRipple size={CONT_SIZE+48}/>
                  </View>
                )}
              </View>
            );
          })}

          {/* 犬スプライト（ズーム演出付き） */}
          <Animated.View style={{
            position: 'absolute',
            left: `${curCont.cx}%` as any,
            top:  `${curCont.cy}%` as any,
            marginLeft: -(DOG_SIZE * zoomScale)/2,
            marginTop:  -(DOG_SIZE * zoomScale)/2,
            transform: [{ scale: zoomScale }],
          }}>
            <NWSprite frame={spriteFrame} size={DOG_SIZE}/>
          </Animated.View>

          {/* 犬フェーズラベル */}
          <View style={{
            position:'absolute', bottom:6, left:0, right:0, alignItems:'center',
          }}>
            <Text style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:'700' }}>
              {dogPhase === 'sign_focus_point' ? '🐕 ← ALERT NOW! →' :
               dogPhase === 'sniff_focus'      ? '🐽 集中クンクン...' :
               dogPhase === 'sniff_react'      ? '👀 反応あり！'     :
               dogPhase === 'walking'          ? '🏃 移動中...'      :
               dogPhase === 'alert_success'    ? '🎉 成功！'         :
               dogPhase === 'alert_miss'       ? '💦 ミス...'        : '🐽 探索中'}
            </Text>
          </View>
        </View>

        {/* ── ステータス表示 */}
        <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
          <View style={{ flex:1, backgroundColor:'rgba(125,110,138,0.25)', borderRadius:8, padding:6 }}>
            <Text style={{ fontSize:9, color:'#B0A0C0', fontWeight:'800' }}>🧠 知性 Lv</Text>
            <Text style={{ fontSize:13, fontWeight:'900', color:'#C9A96E' }}>
              {intelligence<=250?'Lv.1 広域':intelligence<=500?'Lv.2 中域':intelligence<=750?'Lv.3 狭域':'Lv.4 ピンポイント'}
            </Text>
            <Text style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>波紋:{rippleSet.length}個所</Text>
          </View>
          <View style={{ flex:1, backgroundColor:'rgba(122,158,159,0.25)', borderRadius:8, padding:6 }}>
            <Text style={{ fontSize:9, color:'#A8C5C6', fontWeight:'800' }}>🎯 集中力</Text>
            <Text style={{ fontSize:13, fontWeight:'900', color:'#8DAA91' }}>{focusStat}</Text>
            <Text style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>素通りリスク:{Math.round(MISS_PROB*100)}%</Text>
          </View>
          <View style={{ flex:1, backgroundColor:'rgba(230,126,34,0.2)', borderRadius:8, padding:6 }}>
            <Text style={{ fontSize:9, color:'#D4974E', fontWeight:'800' }}>💪 Focus使用</Text>
            <Text style={{ fontSize:13, fontWeight:'900', color: focusBoost>=3?'#e74c3c':'#e67e22' }}>{focusBoost}/5</Text>
            <Text style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{focusBoost>=4?'興奮注意！':'効果中'}</Text>
          </View>
        </View>

        {/* ── 操作ボタン */}
        {gamePhase === 'playing' && (
          <View style={{ flexDirection:'row', gap:10 }}>
            {/* Focus ボタン */}
            <TouchableOpacity
              style={{
                flex:1, paddingVertical:14, borderRadius:14, alignItems:'center',
                backgroundColor: focusBoost >= 5 ? '#4A3F35' : 'rgba(201,169,110,0.85)',
                opacity: focusBoost >= 5 ? 0.5 : 1,
              }}
              onPress={handleFocus}
              disabled={focusBoost >= 5}
            >
              <Text style={{ fontSize:18 }}>💪</Text>
              <Text style={{ color:'#fff', fontSize:12, fontWeight:'900', marginTop:2 }}>FOCUS</Text>
              <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:9 }}>集中させる</Text>
            </TouchableOpacity>

            {/* Alert ボタン */}
            <TouchableOpacity
              style={{
                flex:2, paddingVertical:14, borderRadius:14, alignItems:'center',
                backgroundColor: dogPhase === 'sign_focus_point'
                  ? '#e67e22' : 'rgba(231,76,60,0.75)',
                borderWidth: dogPhase === 'sign_focus_point' ? 3 : 0,
                borderColor: '#F9A825',
                shadowColor: dogPhase === 'sign_focus_point' ? '#F9A825' : 'transparent',
                shadowOpacity: 0.9, shadowRadius: 10, shadowOffset:{width:0,height:0},
                elevation: dogPhase === 'sign_focus_point' ? 8 : 0,
              }}
              onPress={handleAlert}
            >
              <Text style={{ fontSize:22 }}>🔔</Text>
              <Text style={{ color:'#fff', fontSize:15, fontWeight:'900', marginTop:2 }}>ALERT!</Text>
              <Text style={{ color:'rgba(255,255,255,0.85)', fontSize:9 }}>
                {dogPhase === 'sign_focus_point' ? '← 今がチャンス！' : '犬のサインで押せ'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 結果表示 */}
        {gamePhase === 'done' && alertResult && (
          <View style={{
            backgroundColor: alertResult === 'success' ? 'rgba(141,170,145,0.2)' : 'rgba(192,57,43,0.2)',
            borderRadius:14, padding:14, alignItems:'center',
            borderWidth:2, borderColor: alertResult === 'success' ? '#8DAA91' : '#e74c3c',
          }}>
            <Text style={{ fontSize:28 }}>{alertResult === 'success' ? '🏆' : '💦'}</Text>
            <Text style={{ fontSize:18, fontWeight:'900', color: alertResult === 'success' ? '#8DAA91' : '#e74c3c', marginTop:4 }}>
              {alertResult === 'success' ? 'PERFECT ALERT!' : 'MISS'}
            </Text>
            <Text style={{ fontSize:13, color:'#C9A96E', marginTop:4 }}>Score: {resultScore}</Text>
          </View>
        )}

        {/* ライバル状況パネル */}
        <View style={{backgroundColor:'rgba(0,0,0,0.4)',borderRadius:10,marginTop:8,paddingHorizontal:8,paddingVertical:6}}>
          <Text style={{color:'#7A9E9F',fontSize:10,marginBottom:4}}>ライバル状況</Text>
          <View style={{flexDirection:'row',gap:5}}>
            {rivalFinalData.map((r, i) => (
              <View key={i} style={{flex:1,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:6,padding:4,alignItems:'center'}}>
                <Text style={{color:'#fff',fontSize:9,fontWeight:'700'}} numberOfLines={1}>{r.name}</Text>
                <Text style={{fontSize:9,fontWeight:'800',color:gamePhase==='playing'?'#666':r.succeed?'#8DAA91':'#e74c3c'}}>
                  {gamePhase==='playing'?'-':r.succeed?'Succeed':'Fail'}
                </Text>
                <Text style={{color:'#C9A96E',fontSize:10,fontWeight:'800'}}>{gamePhase==='playing'?'--':r.score}pt</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// RiceShower — 米粒・花びらのパーティクルエフェクト
// ─────────────────────────────────────────────────────────────────────────
const RICE_COUNT = 30;
function RiceShower() {
  // 各パーティクルの定数プロパティを初期化時に1回だけ決定
  const [particles] = React.useState(() =>
    Array.from({ length: RICE_COUNT }, (_, i) => ({
      x:        Math.random() * 370 + 5,
      isRice:   i % 3 !== 2,
      color:    i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fff9c4' : '#fce4ec',
      delay:    Math.random() * 5000,
      duration: 3500 + Math.random() * 3000,
      size:     i % 3 === 0 ? { w: 4, h: 8, r: 2 } : { w: 6, h: 6, r: 3 },
    }))
  );
  const anims = React.useRef(
    Array.from({ length: RICE_COUNT }, () => new Animated.Value(0))
  ).current;

  React.useEffect(() => {
    const loops = anims.map((anim, i) => {
      const p = particles[i];
      return Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(anim, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    });
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0 }} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width:  p.size.w,
            height: p.size.h,
            borderRadius: p.size.r,
            backgroundColor: p.color,
            opacity: 0.85,
            transform: [{
              translateY: anims[i].interpolate({ inputRange:[0,1], outputRange:[-20, 900] }),
            }],
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ContestResultScreen — コンテスト共通リザルト画面
// ─────────────────────────────────────────────────────────────────────────
function ContestResultScreen({
  entries, bonusItem, onClose,
}: {
  entries: ContestResultEntry[];
  bonusItem?: { name: string; rarity: 'epic' | 'rare' | 'legendary'; category?: ItemCategory; bonuses?: ItemBonuses; flavorText?: string } | null;
  onClose: () => void;
}) {
  const [showBonusModal, setShowBonusModal] = React.useState(false);

  const handleClose = React.useCallback(() => {
    if (bonusItem) setShowBonusModal(true);
    else onClose();
  }, [bonusItem, onClose]);

  // 行ごとのフェードイン + スライドイン
  const rowAnims = React.useRef(
    entries.map(() => ({
      opacity:    new Animated.Value(0),
      translateX: new Animated.Value(40),
    }))
  ).current;

  React.useEffect(() => {
    const seq = rowAnims.map(a =>
      Animated.parallel([
        Animated.timing(a.opacity,    { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(a.translateX, { toValue: 0, duration: 380, useNativeDriver: true }),
      ])
    );
    Animated.stagger(180, seq).start();
  }, []);

  const rankLabel = (n: number) =>
    n === 1 ? '🥇 1st' : n === 2 ? '🥈 2nd' : n === 3 ? '🥉 3rd' : `${n}th`;

  const rowBg = (rank: number, isPlayer: boolean) => {
    const base =
      rank === 1 ? 'rgba(255,215,0,0.28)'   :
      rank === 2 ? 'rgba(200,200,200,0.22)' :
      rank === 3 ? 'rgba(180,115,50,0.22)'  :
      'rgba(255,255,255,0.08)';
    return isPlayer ? base.replace('0.28','0.48').replace('0.22','0.40').replace('0.08','0.22') : base;
  };

  return (
    <View style={{ flex:1 }}>
      {/* 背景画像（全画面） */}
      <Image
        source={IMG_CONTEST_RESULT_BG}
        style={{ position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%' }}
        resizeMode="cover"
      />

      {/* ライスシャワー（背景画像の上、パネルの後ろ） */}
      <RiceShower />

      {/* 半透明オーバーレイパネル */}
      <View style={{ flex:1, justifyContent:'center', paddingHorizontal:16, paddingTop:56 }}>
        <View style={{
          backgroundColor: 'rgba(10,12,18,0.82)',
          borderRadius: 20,
          padding: 16,
          borderWidth: 1.5,
          borderColor: 'rgba(201,169,110,0.5)',
        }}>
          {/* タイトル */}
          <Text style={{
            fontSize: 20, fontWeight: '900', color: '#C9A96E',
            textAlign: 'center', letterSpacing: 2, marginBottom: 14,
          }}>🏆 CONTEST RESULTS</Text>

          {/* ヘッダー行 */}
          <View style={{ flexDirection:'row', marginBottom: 6, paddingHorizontal: 4 }}>
            <Text style={{ width: 70, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight:'700' }}>RANK</Text>
            <Text style={{ flex: 1,   fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight:'700' }}>NAME</Text>
            <Text style={{ width: 64, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight:'700', textAlign:'right' }}>SCORE</Text>
          </View>

          {/* 結果行 */}
          {entries.map((entry, i) => (
            <Animated.View
              key={i}
              style={{
                opacity:   rowAnims[i]?.opacity    ?? 1,
                transform: [{ translateX: rowAnims[i]?.translateX ?? new Animated.Value(0) }],
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: rowBg(entry.rank, entry.isPlayer),
                borderRadius: 8,
                paddingVertical: 7,
                paddingHorizontal: 8,
                marginBottom: 4,
                borderWidth: entry.isPlayer ? 1.5 : 0,
                borderColor: entry.isPlayer ? 'rgba(201,169,110,0.7)' : 'transparent',
              }}
            >
              <Text style={{ width: 70, fontSize: 13, fontWeight:'800', color: entry.rank <= 3 ? '#C9A96E' : '#ccc' }}>
                {rankLabel(entry.rank)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight:'700', color: entry.isPlayer ? '#F9F7F2' : '#ccc' }}>
                  {entry.dogName}
                  {entry.isPlayer ? ' 👤' : ''}
                </Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {entry.dogBreed}
                </Text>
              </View>
              <Text style={{
                width: 64, textAlign: 'right', fontSize: 14, fontWeight: '900',
                color: entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : '#8DAA91',
              }}>
                {entry.score}<Text style={{ fontSize: 9, fontWeight:'400' }}> pts</Text>
              </Text>
            </Animated.View>
          ))}

          {/* 区切り */}
          <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.1)', marginVertical:12 }}/>

          {/* 自分の結果サマリー */}
          {(() => {
            const me = entries.find(e => e.isPlayer);
            if (!me) return null;
            return (
              <View style={{ alignItems:'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>あなたの結果</Text>
                <Text style={{ fontSize: 22, fontWeight:'900', color: me.rank <= 3 ? '#C9A96E' : '#8DAA91', marginTop: 4 }}>
                  {rankLabel(me.rank)} — {me.score} pts
                </Text>
              </View>
            );
          })()}

          {/* 閉じるボタン */}
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(201,169,110,0.9)',
              borderRadius: 14, paddingVertical: 12, alignItems: 'center',
            }}
            onPress={handleClose}
          >
            <Text style={{ fontSize: 14, fontWeight: '900', color: '#3A2F25' }}>
              ✕ 閉じる
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 副賞通知モーダル */}
      {showBonusModal && bonusItem && (
        <View style={{
          position:'absolute', top:0, left:0, right:0, bottom:0,
          backgroundColor:'rgba(0,0,0,0.75)',
          justifyContent:'center', alignItems:'center', padding:24,
        }}>
          <View style={{
            backgroundColor:'#1E1A14', borderRadius:20, padding:24,
            borderWidth:2, borderColor: bonusItem.rarity === 'epic' ? '#C9A96E' : '#8DAA91',
            alignItems:'center', width:'100%',
          }}>
            <Text style={{ fontSize:32, marginBottom:8 }}>
              {bonusItem.rarity === 'epic' ? '🏆' : '🎁'}
            </Text>
            <Text style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:4 }}>
              上位入賞の景品として
            </Text>
            <Text style={{
              fontSize:18, fontWeight:'900',
              color: bonusItem.rarity === 'epic' ? '#FFD700' : '#C0C0C0',
              textAlign:'center', marginBottom:4,
            }}>
              「{bonusItem.name}」
            </Text>
            <Text style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:16 }}>
              が贈呈されました！
            </Text>
            <View style={{
              backgroundColor: bonusItem.rarity === 'epic' ? 'rgba(201,169,110,0.2)' : 'rgba(141,170,145,0.2)',
              borderRadius:8, paddingHorizontal:12, paddingVertical:4, marginBottom:20,
            }}>
              <Text style={{ fontSize:11, color: bonusItem.rarity === 'epic' ? '#C9A96E' : '#8DAA91', fontWeight:'800' }}>
                {bonusItem.rarity === 'epic' ? '✨ EPIC' : '🌟 RARE'}
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor:'rgba(201,169,110,0.9)', borderRadius:14,
                paddingVertical:12, paddingHorizontal:32,
              }}
              onPress={onClose}
            >
              <Text style={{ fontSize:14, fontWeight:'900', color:'#3A2F25' }}>受け取る</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  safe:     {flex:1,backgroundColor:'#F9F7F2'},
  scroll:   {padding:12,paddingBottom:40},
  header:   {marginBottom:8,alignItems:'center'},
  title:    {fontSize:20,fontWeight:'bold',color:'#4A3F35'},
  subTitle: {fontSize:12,color:'#8C7B6E',marginTop:2},

  card:{
    backgroundColor:'#fff',borderRadius:12,padding:14,marginBottom:10,
    shadowColor:'#000',shadowOpacity:0.06,shadowRadius:4,
    shadowOffset:{width:0,height:2},elevation:2,
  },
  cardTitle:{fontSize:14,fontWeight:'700',color:'#4A3F35',marginBottom:10},

  divider:{height:1,backgroundColor:'#F0EDE7',marginVertical:8},

  // 状態カード
  statusCard:{backgroundColor:'#F9F7F2',borderLeftWidth:4,borderLeftColor:'#8DAA91',
    alignItems:'center',paddingVertical:18},
  statusCardAlert:{backgroundColor:'#fff0f0',borderLeftColor:'#c0392b'},
  statusRow:{flexDirection:'row',alignItems:'center',gap:8},
  emotionIcon:{fontSize:28},
  statusText:{fontSize:17,fontWeight:'700',color:'#4A3F35',textAlign:'center',flex:1},
  behaviorTag:{marginTop:6,fontSize:12,color:'#8C7B6E',textAlign:'center'},

  // 性格カード
  identityCard:{backgroundColor:'#F5F2F8',borderLeftWidth:4,borderLeftColor:'#7D6E8A'},
  identityRow:{flexDirection:'row',alignItems:'center'},
  identityBlock:{flex:1,alignItems:'center'},
  identitySep:{width:1,height:52,backgroundColor:'#e0c8f0',marginHorizontal:8},
  identitySmall:{fontSize:10,color:'#8C7B6E',marginBottom:2},
  identityBig:{fontSize:15,fontWeight:'700',color:'#4A3F35',textAlign:'center'},
  identityPreset:{fontSize:10,color:'#7D6E8A',marginTop:2,textAlign:'center'},

  // ストレス
  stressCard:{backgroundColor:'#fff9f9',borderLeftWidth:4,borderLeftColor:'#e74c3c'},
  stressHintRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',marginTop:4,marginLeft:80},
  stressHintLabel:{fontSize:11,color:'#8C7B6E'},
  stressHintChip:{backgroundColor:'#fdecea',borderRadius:10,
    paddingHorizontal:8,paddingVertical:2,marginRight:4,marginBottom:2},
  stressHintChipText:{fontSize:11,color:'#c0392b'},
  stressWarning:{fontSize:12,fontWeight:'700',color:'#fff',
    marginTop:6,paddingVertical:4,paddingHorizontal:10,borderRadius:6,textAlign:'center'},

  // プリセット
  presetRow:{flexDirection:'row',gap:8,marginBottom:8},
  presetBtn:{flex:1,paddingVertical:8,borderRadius:20,borderWidth:2,alignItems:'center'},
  presetBtnText:{fontSize:12,fontWeight:'700',color:'#4A3F35'},

  // 入力
  row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,marginBottom:8},
  label:{fontSize:13,color:'#4A3F35'},
  input:{
    borderWidth:1,borderColor:'#C5BDB5',borderRadius:6,
    paddingHorizontal:8,paddingVertical:Platform.OS==='ios'?6:3,
    fontSize:15,width:60,textAlign:'center',backgroundColor:'#fff',color:'#4A3F35',
  },
  meta:{fontSize:11,color:'#8C7B6E',marginBottom:4},

  // ボタン
  btn:{paddingHorizontal:16,paddingVertical:9,borderRadius:20,marginRight:8},
  btnStart:{backgroundColor:'#8DAA91'},
  btnStop:{backgroundColor:'#e74c3c'},
  btnReset:{backgroundColor:'#B8AFA6'},
  btnText:{color:'#fff',fontWeight:'700',fontSize:14},

  // バー
  barRow:{flexDirection:'row',alignItems:'center',marginBottom:7},
  barLabel:{width:80,fontSize:12,color:'#4A3F35'},
  barBg:{flex:1,height:14,backgroundColor:'#F0EDE7',borderRadius:7,overflow:'hidden'},
  barFill:{height:'100%',borderRadius:7},
  barValue:{width:32,textAlign:'right',fontSize:12,color:'#8C7B6E'},

  // アクション
  actionGroupLabel:{fontSize:11,color:'#8C7B6E',marginBottom:6},
  actionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  actionBtn:{paddingHorizontal:10,paddingVertical:8,borderRadius:20,minWidth:88,alignItems:'center'},
  actionBtnText:{color:'#fff',fontWeight:'700',fontSize:12},
  actionBtnSub:{color:'rgba(255,255,255,0.85)',fontSize:9,marginTop:2,textAlign:'center'},

  // トレーニング/おもちゃ展開メニュー (v5)
  menuToggleBtn:{
    backgroundColor:'#F9F7F2',borderRadius:20,borderWidth:1.5,borderColor:'#C5BDB5',
    paddingVertical:10,paddingHorizontal:14,alignItems:'center',
  },
  menuToggleBtnText:{fontSize:13,fontWeight:'700',color:'#4A3F35'},
  subMenuGrid:{
    flexDirection:'row',flexWrap:'wrap',gap:8,
    marginTop:8,padding:10,
    backgroundColor:'#fafafa',borderRadius:10,
    borderWidth:1,borderColor:'#e8e8e8',
  },
  subBtn:{
    flex:1,minWidth:100,borderRadius:20,
    paddingVertical:12,paddingHorizontal:8,
    alignItems:'center',
  },
  subBtnEmoji:{fontSize:24,marginBottom:4},
  subBtnTitle:{color:'#fff',fontWeight:'800',fontSize:12,textAlign:'center'},
  subBtnSub:{color:'rgba(255,255,255,0.85)',fontSize:9,marginTop:3,textAlign:'center'},

  // レポート
  reportToggle:{backgroundColor:'#F9F7F2',borderWidth:1,borderColor:'#C5BDB5'},
  reportToggleText:{fontWeight:'700',color:'#4A3F35',textAlign:'center',fontSize:13},
  reportCard:{backgroundColor:'#f9fdf9',borderLeftWidth:4,borderLeftColor:'#8DAA91'},
  reportRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:4},
  reportLabel:{fontSize:12,color:'#8C7B6E'},
  reportValue:{fontSize:12,fontWeight:'600',color:'#4A3F35'},
  reportDivider:{height:1,backgroundColor:'#e8e8e8',marginVertical:4},

  // フローティングフィードバック
  floatingFeedback:{
    position:'absolute',top:78,left:16,right:16,alignItems:'center',zIndex:999,
  },
  floatingFeedbackText:{
    backgroundColor:'rgba(20,20,20,0.90)',borderRadius:20,
    paddingHorizontal:20,paddingVertical:10,
    fontSize:14,fontWeight:'800',textAlign:'center',
    shadowColor:'#000',shadowOpacity:0.35,shadowRadius:8,elevation:10,
    overflow:'hidden',
  },

  // ログ
  logEntry:{fontSize:11,color:'#8C7B6E',paddingVertical:2},
  logEntryLatest:{color:'#4A3F35',fontWeight:'600'},

  // ── カテゴリカード: 左ボーダー色で区別
  conditionCard: { borderLeftWidth:4, borderLeftColor:'#e67e22' },
  mentalCard:    { borderLeftWidth:4, borderLeftColor:'#7A9E9F' },
  physicalCard:  { borderLeftWidth:4, borderLeftColor:'#7D6E8A' },
  beautyCard:    { borderLeftWidth:4, borderLeftColor:'#C96B8A' },
  potentialCard: { borderLeftWidth:4, borderLeftColor:'#6B9070' },

  // ── 散歩独立カード
  walkStandaloneCard:{
    backgroundColor:'#D5E8E8',borderRadius:14,padding:14,marginBottom:10,
    borderLeftWidth:5,borderLeftColor:'#7A9E9F',
    shadowColor:'#7A9E9F',shadowOpacity:0.12,shadowRadius:4,elevation:3,
  },
  walkStandaloneIcon:{ fontSize:32 },
  walkStandaloneTitle:{ fontSize:16,fontWeight:'800',color:'#4A3F35' },
  walkStandaloneSub:{ fontSize:11,color:'#8C7B6E',marginTop:2 },
  walkStandaloneBtn:{
    backgroundColor:'#7A9E9F',borderRadius:22,
    paddingVertical:10,paddingHorizontal:16,alignItems:'center',minWidth:80,
  },
  walkStandaloneBtnText:{ color:'#fff',fontWeight:'800',fontSize:14 },
  walkStandaloneBtnSub:{ color:'rgba(255,255,255,0.8)',fontSize:9,marginTop:2 },

  // ── 興奮度ゾーンバッジ
  arousalZoneBadge:{
    marginTop:4,marginLeft:88,borderRadius:8,
    paddingVertical:4,paddingHorizontal:10,
    borderWidth:1,
  },
  arousalZoneBadgeText:{ fontSize:11,fontWeight:'700' },
  arousalZoneScale:{ fontSize:9,color:'#B8AFA6',marginTop:2,fontFamily:Platform.OS==='ios'?'Courier New':'monospace' },

  // ── ストレス閾値凡例
  stressLegend:{ flexDirection:'row',gap:12,marginTop:4,marginLeft:80 },
  stressLegendItem:{ flexDirection:'row',alignItems:'center',gap:4 },
  stressLegendDot:{ width:8,height:8,borderRadius:4 },
  stressLegendText:{ fontSize:10,color:'#8C7B6E' },

  // v6 Step3: クローゼット
  closetEntryBtn:{
    marginTop:8,paddingVertical:8,paddingHorizontal:18,borderRadius:22,
    backgroundColor:'#fdf0f8',borderWidth:1.5,borderColor:'#C96B8A',
    alignSelf:'center',
  },
  closetEntryBtnText:{fontSize:13,fontWeight:'800',color:'#C96B8A'},
  closetLinkBtn:{
    paddingVertical:4,paddingHorizontal:10,borderRadius:20,
    backgroundColor:'#fdf0f8',borderWidth:1,borderColor:'#C96B8A',
  },
  closetLinkBtnText:{fontSize:11,fontWeight:'700',color:'#C96B8A'},
  closetHeader:{
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    marginBottom:12,
  },
  closetBackBtn:{
    paddingHorizontal:12,paddingVertical:8,backgroundColor:'#F0EDE7',borderRadius:20,
  },
  closetBackText:{fontSize:13,fontWeight:'700',color:'#4A3F35'},
  closetTitle:{fontSize:18,fontWeight:'800',color:'#C96B8A'},
  slotGrid:{
    flexDirection:'row',flexWrap:'wrap',gap:8,
  },
  slotBox:{
    width:'30.5%',borderRadius:12,borderWidth:2,padding:10,
    alignItems:'center',backgroundColor:'#fafafa',
    minHeight:90,
  },
  slotBoxSelected:{
    backgroundColor:'#fdf0f8',borderColor:'#C96B8A',
    shadowColor:'#C96B8A',shadowOpacity:0.3,shadowRadius:6,elevation:4,
  },
  slotEmoji:{fontSize:22,marginBottom:2},
  slotLabel:{fontSize:11,color:'#8C7B6E',fontWeight:'700'},
  slotEquippedName:{fontSize:10,fontWeight:'700',textAlign:'center',marginTop:2},
  slotEmpty:{fontSize:10,color:'#C5BDB5',marginTop:2},
  slotSelectIndicator:{
    position:'absolute',bottom:4,left:'50%',
    width:6,height:6,borderRadius:3,backgroundColor:'#C96B8A',marginLeft:-3,
  },
  slotUnequipBtn:{
    marginTop:4,paddingHorizontal:6,paddingVertical:2,
    backgroundColor:'#fdecea',borderRadius:6,
  },
  slotUnequipText:{fontSize:9,color:'#e74c3c',fontWeight:'700'},
  invItemRow:{
    flexDirection:'row',alignItems:'flex-start',
    borderLeftWidth:3,paddingLeft:10,marginBottom:8,paddingVertical:6,
    backgroundColor:'#fafafa',borderRadius:8,
  },

  // v6 Step2: アイテム（散歩一覧など）
  itemRow:{
    flexDirection:'row',alignItems:'center',
    borderLeftWidth:3,paddingLeft:8,marginBottom:6,
  },
  itemRarityBadge:{
    borderRadius:6,paddingHorizontal:5,paddingVertical:2,marginRight:8,
    alignSelf:'flex-start',
  },
  itemRarityText:{color:'#fff',fontSize:9,fontWeight:'800'},
  itemName:{fontSize:13,fontWeight:'700'},
  itemBonuses:{fontSize:11,color:'#8C7B6E',marginTop:1},

  // v6: バッジ
  autoBadge:{
    backgroundColor:'#D5E8E8',borderRadius:8,marginTop:6,
    paddingVertical:5,paddingHorizontal:10,borderLeftWidth:3,borderLeftColor:'#7A9E9F',
  },
  autoBadgeText:{fontSize:11,color:'#4A3F35',fontWeight:'600'},
  arousalBadge:{
    borderRadius:8,marginTop:4,
    paddingVertical:4,paddingHorizontal:10,
  },
  arousalBadgeText:{fontSize:11,fontWeight:'600'},

  // v7: 時計行・ナビゲーション
  clockRow:{
    flexDirection:'row',alignItems:'center',gap:12,
    marginTop:8,marginBottom:4,
  },
  clockInfo:{
    flex:1,justifyContent:'center',
  },
  clockTimeText:{
    fontSize:24,fontWeight:'900',color:'#4A3F35',
    letterSpacing:1,
  },
  clockPhaseText:{
    fontSize:12,color:'#8C7B6E',marginTop:1,fontWeight:'600',
  },
  clockAgeText:{
    fontSize:11,color:'#8C7B6E',marginTop:2,
  },
  nightBanner:{
    backgroundColor:'#4A3F35',borderRadius:10,
    paddingVertical:8,paddingHorizontal:12,
    marginTop:6,marginBottom:2,
    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
    flexWrap:'wrap',gap:6,
  },
  nightBannerText:{
    fontSize:12,color:'#a9cce3',fontWeight:'700',flex:1,
  },
  skipMorningBtn:{
    backgroundColor:'#D4974E',borderRadius:22,
    paddingVertical:6,paddingHorizontal:12,
  },
  skipMorningBtnText:{
    fontSize:12,fontWeight:'800',color:'#fff',
  },
  headerNavRow:{
    flexDirection:'row',gap:8,marginTop:8,alignSelf:'stretch',
    paddingHorizontal:4,
  },
  shopEntryBtn:{
    paddingVertical:8,paddingHorizontal:18,borderRadius:22,
    backgroundColor:'#F9F7F2',borderWidth:1.5,borderColor:'#D4974E',
  },
  shopEntryBtnText:{fontSize:13,fontWeight:'800',color:'#e67e22'},

  // デバッグ
  debugCard:{backgroundColor:'#fdfefe',borderWidth:1,borderColor:'#e8e8e8'},
  debug:{
    fontFamily:Platform.OS==='ios'?'Courier New':'monospace',
    fontSize:11,color:'#555',lineHeight:18,
  },
});
