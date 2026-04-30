import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { generateQuestion } from '../logic/handGenerator';
import { tileEmoji, tileLabel, windLabel, roundLabel } from '../logic/tiles';

const COLORS = {
  bg: '#0a2a0a',
  surface: '#0f3d0f',
  gold: '#c9a227',
  white: '#f0f0e8',
  dimWhite: '#a8a89a',
  red: '#c0392b',
  input: '#162e16',
  inputBorder: '#2a6b2a',
  accent: '#1a6b1a',
  winTile: '#7b3a00',
};

function TileBox({ tileObj, isWin }) {
  return (
    <View style={[styles.tileBox, isWin && styles.tileBoxWin]}>
      <Text style={styles.tileEmoji}>{tileEmoji(tileObj)}</Text>
    </View>
  );
}

function MentsuRow({ m, winTile }) {
  const isChiitoitsuPair = m.type === 'pair_display';
  return (
    <View style={styles.mentsuRow}>
      {m.tiles.map((t, i) => (
        <TileBox
          key={i}
          tileObj={t}
          isWin={
            winTile &&
            t.suit === winTile.suit &&
            t.num === winTile.num &&
            !isChiitoitsuPair
          }
        />
      ))}
      {m.open && <Text style={styles.openMark}>開</Text>}
    </View>
  );
}

function EnvBadge({ label, value }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

export default function QuestionScreen({ navigation, route }) {
  const { gameMode } = route.params;
  const [question, setQuestion] = useState(null);
  const [fuInput, setFuInput] = useState('');
  const [hanInput, setHanInput] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [qNum, setQNum] = useState(1);

  const loadQuestion = useCallback(() => {
    const q = generateQuestion(gameMode);
    setQuestion(q);
    setFuInput('');
    setHanInput('');
    setScoreInput('');
  }, [gameMode]);

  useEffect(() => { loadQuestion(); }, [loadQuestion]);

  const handleSubmit = () => {
    if (!fuInput || !hanInput || !scoreInput) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const userFu = parseInt(fuInput, 10);
    const userHan = parseInt(hanInput, 10);
    const userScore = parseInt(scoreInput, 10);
    const { answer } = question;

    const fuCorrect = userFu === answer.fu;
    const hanCorrect = userHan === answer.han;
    const scoreCorrect = userScore === answer.scoreResult.total;

    navigation.navigate('Result', {
      question,
      userAnswers: { fu: userFu, han: userHan, score: userScore },
      correct: { fu: fuCorrect, han: hanCorrect, score: scoreCorrect },
      gameMode,
      qNum,
      onNext: () => {
        setQNum(n => n + 1);
        loadQuestion();
      },
    });
  };

  if (!question) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: COLORS.gold, fontSize: 18 }}>問題を生成中...</Text>
      </View>
    );
  }

  const { hand, answer } = question;
  const env = hand.environment;

  const seatWindStr = windLabel(env.seatWind);
  const roundStr = roundLabel(env.round);
  const isDealer = env.seatWind === 1;
  const dealerStr = isDealer ? '親' : '子';
  const winStr = hand.tsumo ? 'ツモ' : 'ロン';
  const doraStr = env.dora && env.dora.length > 0
    ? env.dora.map(t => tileEmoji(t)).join('')
    : 'なし';

  const specials = [];
  if (env.riichi) specials.push(env.doubleRiichi ? 'ダブル立直' : '立直');
  if (env.ippatsu) specials.push('一発');
  if (env.rinshan) specials.push('嶺上開花');
  if (env.haitei && hand.tsumo) specials.push('海底撈月');
  if (env.houtei && !hand.tsumo) specials.push('河底撈魚');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.qNum}>第 {qNum} 問</Text>
          <Text style={styles.modeBadge}>{gameMode}人麻雀</Text>
        </View>

        {/* Environment */}
        <View style={styles.envRow}>
          <EnvBadge label="場" value={roundStr} />
          <EnvBadge label="自風" value={`${seatWindStr}(${dealerStr})`} />
          <EnvBadge label="上がり" value={winStr} />
        </View>
        <View style={styles.envRow}>
          <EnvBadge label="ドラ" value={doraStr || 'なし'} />
          {specials.length > 0 && <EnvBadge label="特殊" value={specials.join(' ')} />}
        </View>

        {/* Hand */}
        <View style={styles.handSection}>
          <Text style={styles.sectionTitle}>手牌</Text>
          {hand.isChiitoitsu ? (
            <View>
              <Text style={styles.chiitoitsuLabel}>七対子</Text>
              <View style={styles.chiitoitsuGrid}>
                {hand.chiitoitsuPairs.map((t, i) => (
                  <View key={i} style={styles.chiitoitsuPair}>
                    <TileBox tileObj={t} isWin={i === hand.chiitoitsuPairs.length - 1} />
                    <TileBox tileObj={t} isWin={false} />
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.handGrid}>
              {hand.mentsu.map((m, i) => (
                <MentsuRow key={i} m={m} winTile={hand.winTile} />
              ))}
              {/* Pair */}
              <View style={styles.mentsuRow}>
                <TileBox
                  tileObj={hand.pair}
                  isWin={hand.waitType === 'tanki'}
                />
                <TileBox
                  tileObj={hand.pair}
                  isWin={false}
                />
                <Text style={styles.pairLabel}>雀頭</Text>
              </View>
            </View>
          )}

          <View style={styles.winTileRow}>
            <Text style={styles.winTileLabel}>
              {hand.tsumo ? 'ツモ牌' : 'ロン牌'}：
            </Text>
            <TileBox tileObj={hand.winTile} isWin={true} />
            <Text style={styles.winTileLabel}>
              {'  '}待ち: {waitTypeLabel(hand.waitType)}
            </Text>
          </View>
        </View>

        {/* Input */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>答えを入力</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>符</Text>
              <TextInput
                style={styles.input}
                value={fuInput}
                onChangeText={setFuInput}
                keyboardType="number-pad"
                placeholder="例: 40"
                placeholderTextColor={COLORS.dimWhite}
                maxLength={3}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>飜</Text>
              <TextInput
                style={styles.input}
                value={hanInput}
                onChangeText={setHanInput}
                keyboardType="number-pad"
                placeholder="例: 3"
                placeholderTextColor={COLORS.dimWhite}
                maxLength={2}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>点数</Text>
              <TextInput
                style={styles.input}
                value={scoreInput}
                onChangeText={setScoreInput}
                keyboardType="number-pad"
                placeholder="例: 5200"
                placeholderTextColor={COLORS.dimWhite}
                maxLength={6}
              />
            </View>
          </View>
          <Text style={styles.scoreHint}>
            ※ 点数は{hand.tsumo ? '受取合計' : 'ロン支払い'}を入力
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.submitText}>採点する</Text>
        </TouchableOpacity>

        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('GameMode');
          }}
        >
          <Text style={styles.backText}>← モード選択へ</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function waitTypeLabel(w) {
  return { ryanmen: '両面', shanpon: 'シャンポン', kanchan: '嵌張', penchan: '辺張', tanki: '単騎' }[w] || w;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qNum: { fontSize: 22, fontWeight: 'bold', color: COLORS.gold },
  modeBadge: {
    backgroundColor: COLORS.accent,
    color: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 13,
  },
  envRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 60,
  },
  badgeLabel: { color: COLORS.dimWhite, fontSize: 11 },
  badgeValue: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },
  handSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 2,
  },
  handGrid: { gap: 8 },
  mentsuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  tileBox: {
    width: 38,
    height: 50,
    backgroundColor: '#f5f0e8',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#888',
  },
  tileBoxWin: {
    backgroundColor: '#fff3c0',
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  tileEmoji: { fontSize: 24 },
  openMark: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  pairLabel: { color: COLORS.dimWhite, fontSize: 11, marginLeft: 4 },
  chiitoitsuLabel: { color: COLORS.dimWhite, fontSize: 13, marginBottom: 8 },
  chiitoitsuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chiitoitsuPair: { flexDirection: 'row', gap: 2 },
  winTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  winTileLabel: { color: COLORS.dimWhite, fontSize: 13 },
  inputSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1, gap: 6 },
  inputLabel: { color: COLORS.gold, fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  input: {
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 10,
  },
  scoreHint: { color: COLORS.dimWhite, fontSize: 11, marginTop: 8, textAlign: 'center' },
  submitBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitText: { color: '#0a2a0a', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  backBtn: { alignItems: 'center', padding: 10 },
  backText: { color: COLORS.dimWhite, fontSize: 14 },
});
