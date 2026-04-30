import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, StatusBar,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { saveResult } from '../utils/storage';
import { tileEmoji, tileLabel, mentsuLabel } from '../logic/tiles';

const COLORS = {
  bg: '#0a2a0a',
  surface: '#0f3d0f',
  gold: '#c9a227',
  white: '#f0f0e8',
  dimWhite: '#a8a89a',
  red: '#c0392b',
  green: '#27ae60',
  wrong: '#3d1010',
  correct: '#0d3d1a',
  accent: '#1a6b1a',
};

function ResultRow({ label, userVal, correctVal, isCorrect }) {
  return (
    <View style={[styles.resultRow, isCorrect ? styles.resultRowOk : styles.resultRowNg]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <View style={styles.resultVals}>
        <Text style={styles.userVal}>あなた: {userVal}</Text>
        <Text style={[styles.correctVal, { color: isCorrect ? COLORS.green : COLORS.gold }]}>
          正解: {correctVal}
        </Text>
      </View>
      <Text style={styles.resultIcon}>{isCorrect ? '✓' : '✗'}</Text>
    </View>
  );
}

function ScorePaymentInfo({ scoreResult, tsumo, gameMode }) {
  const { payments, rank } = scoreResult;
  const parts = [];
  if (rank) parts.push(`【${rank}】`);
  if (tsumo) {
    if (payments.oya !== undefined) {
      parts.push(`親: ${payments.oya}点`);
      parts.push(`子: ${payments.ko}点 × ${gameMode === 3 ? 1 : 2}`);
    } else if (payments.ko !== undefined) {
      parts.push(`各自: ${payments.ko}点`);
    }
  } else {
    parts.push(`支払い: ${payments.ron}点`);
  }
  return (
    <View style={styles.paymentInfo}>
      {parts.map((p, i) => (
        <Text key={i} style={styles.paymentText}>{p}</Text>
      ))}
    </View>
  );
}

export default function ResultScreen({ navigation, route }) {
  const { question, userAnswers, correct, gameMode, qNum, onNext } = route.params;
  const { hand, answer } = question;
  const env = hand.environment;
  const allCorrect = correct.fu && correct.han && correct.score;

  useEffect(() => {
    const save = async () => {
      await saveResult(allCorrect);
    };
    save();

    if (allCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Question', { gameMode });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Overall result */}
        <View style={[styles.overallBanner, allCorrect ? styles.bannerOk : styles.bannerNg]}>
          <Text style={styles.overallIcon}>{allCorrect ? '🎉' : '❌'}</Text>
          <Text style={styles.overallText}>
            {allCorrect ? '正解！ すべて合っています' : '不正解 — 解説を確認しよう'}
          </Text>
        </View>

        {/* Score comparison */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>採点結果</Text>
          <ResultRow
            label="符"
            userVal={`${userAnswers.fu}符`}
            correctVal={`${answer.fu}符`}
            isCorrect={correct.fu}
          />
          <ResultRow
            label="飜"
            userVal={`${userAnswers.han}飜`}
            correctVal={`${answer.han}飜`}
            isCorrect={correct.han}
          />
          <ResultRow
            label="点数"
            userVal={`${userAnswers.score}点`}
            correctVal={`${answer.scoreResult.total}点`}
            isCorrect={correct.score}
          />
          <ScorePaymentInfo
            scoreResult={answer.scoreResult}
            tsumo={hand.tsumo}
            gameMode={gameMode}
          />
        </View>

        {/* Hand decomposition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>手牌の分解</Text>
          {hand.isChiitoitsu ? (
            <View>
              <Text style={styles.decomposeLine}>七対子 (7対の形)</Text>
              {hand.chiitoitsuPairs.map((t, i) => (
                <Text key={i} style={styles.decomposeLine}>
                  {tileEmoji(t)}{tileEmoji(t)} ({tileLabel(t)} × 2)
                </Text>
              ))}
            </View>
          ) : (
            <View>
              {hand.mentsu.map((m, i) => (
                <View key={i} style={styles.decomposeRow}>
                  <Text style={styles.decomposeTiles}>
                    {m.tiles.map(tileEmoji).join('')}
                  </Text>
                  <Text style={styles.decomposeLabel}>{mentsuLabel(m)}</Text>
                </View>
              ))}
              <View style={styles.decomposeRow}>
                <Text style={styles.decomposeTiles}>
                  {tileEmoji(hand.pair)}{tileEmoji(hand.pair)}
                </Text>
                <Text style={styles.decomposeLabel}>
                  雀頭[{tileLabel(hand.pair)}]
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Fu breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>符の内訳</Text>
          {answer.fuBreakdown.map((line, i) => (
            <Text key={i} style={styles.breakdownLine}>・{line}</Text>
          ))}
          <Text style={styles.breakdownTotal}>合計: {answer.fu}符</Text>
        </View>

        {/* Yaku list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>役・飜の内訳</Text>
          {answer.yaku.map((y, i) => (
            <View key={i} style={styles.yakuRow}>
              <Text style={styles.yakuName}>{y.name}</Text>
              <Text style={styles.yakuHan}>{y.han}飜</Text>
            </View>
          ))}
          {answer.isYakuman && (
            <View style={styles.yakumanBadge}>
              <Text style={styles.yakumanText}>役満！</Text>
            </View>
          )}
          <Text style={styles.breakdownTotal}>合計: {answer.han}飜</Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>次の問題へ →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Title');
          }}
        >
          <Text style={styles.homeText}>タイトルへ</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  overallBanner: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bannerOk: { backgroundColor: COLORS.correct, borderWidth: 1, borderColor: COLORS.green },
  bannerNg: { backgroundColor: COLORS.wrong, borderWidth: 1, borderColor: COLORS.red },
  overallIcon: { fontSize: 28 },
  overallText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold', flex: 1 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
    gap: 8,
  },
  resultRowOk: { backgroundColor: COLORS.correct },
  resultRowNg: { backgroundColor: COLORS.wrong },
  resultLabel: { color: COLORS.white, fontWeight: 'bold', fontSize: 16, width: 30 },
  resultVals: { flex: 1, gap: 2 },
  userVal: { color: COLORS.dimWhite, fontSize: 13 },
  correctVal: { fontSize: 15, fontWeight: 'bold' },
  resultIcon: { fontSize: 20, fontWeight: 'bold' },
  paymentInfo: {
    marginTop: 8,
    backgroundColor: '#0a2a0a',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  paymentText: { color: COLORS.gold, fontSize: 13 },
  decomposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  decomposeTiles: { fontSize: 22, letterSpacing: 2 },
  decomposeLabel: { color: COLORS.dimWhite, fontSize: 13 },
  decomposeLine: { color: COLORS.white, fontSize: 14, paddingVertical: 3 },
  breakdownLine: { color: COLORS.white, fontSize: 13, paddingVertical: 2 },
  breakdownTotal: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'right',
  },
  yakuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#1a4d1a',
  },
  yakuName: { color: COLORS.white, fontSize: 14 },
  yakuHan: { color: COLORS.gold, fontSize: 14, fontWeight: 'bold' },
  yakumanBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  yakumanText: { color: COLORS.white, fontWeight: 'bold', fontSize: 18, letterSpacing: 4 },
  nextBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  nextText: { color: '#0a2a0a', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 },
  homeBtn: { alignItems: 'center', padding: 10 },
  homeText: { color: COLORS.dimWhite, fontSize: 14 },
});
