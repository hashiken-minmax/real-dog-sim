import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  StatusBar, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { getResults, clearResults, computeStats } from '../utils/storage';

const COLORS = {
  bg: '#0a2a0a',
  surface: '#0f3d0f',
  gold: '#c9a227',
  white: '#f0f0e8',
  dimWhite: '#a8a89a',
  red: '#c0392b',
  green: '#27ae60',
  accent: '#1a6b1a',
};

function StatCard({ label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function RateBar({ rate }) {
  const color = rate >= 80 ? COLORS.green : rate >= 50 ? COLORS.gold : COLORS.red;
  return (
    <View style={styles.barContainer}>
      <View style={[styles.barFill, { width: `${rate}%`, backgroundColor: color }]} />
      <Text style={[styles.barText, { color }]}>{rate}%</Text>
    </View>
  );
}

export default function AchievementScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const results = await getResults();
    setStats(computeStats(results));
    setHistory(results.slice(-20).reverse());
  };

  const handleClear = () => {
    Alert.alert('リセット確認', '全ての記録を消去しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '消去',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await clearResults();
          await load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>🏆 実績</Text>

        {!stats || stats.total === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>まだ問題を解いていません</Text>
            <Text style={styles.emptyHint}>「ゲームを遊ぶ」から始めましょう</Text>
          </View>
        ) : (
          <>
            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCard
                label="総問題数"
                value={`${stats.total}問`}
              />
              <StatCard
                label="正解数"
                value={`${stats.correct}問`}
              />
            </View>

            {/* Cumulative rate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>累計正答率</Text>
              <RateBar rate={stats.rate} />
              <Text style={styles.rateDetail}>
                {stats.correct} / {stats.total} 問正解
              </Text>
            </View>

            {/* Recent 100 rate */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>直近{Math.min(stats.total, 100)}問の正答率</Text>
              <RateBar rate={stats.recent100Rate} />
              <Text style={styles.rateDetail}>
                直近 {stats.recent100} 問での成績
              </Text>
            </View>

            {/* Rank */}
            <View style={[styles.section, styles.rankSection]}>
              <Text style={styles.rankLabel}>あなたのランク</Text>
              <Text style={styles.rankValue}>{getRank(stats.rate, stats.total)}</Text>
            </View>

            {/* Recent history */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>直近の履歴</Text>
              <View style={styles.historyRow}>
                {history.map((r, i) => (
                  <View
                    key={i}
                    style={[
                      styles.historyDot,
                      { backgroundColor: r.correct ? COLORS.green : COLORS.red },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.historyLegend}>● 正解  ● 不正解</Text>
            </View>

            {/* Clear button */}
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClear}
            >
              <Text style={styles.clearText}>記録をリセット</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function getRank(rate, total) {
  if (total < 10) return '初心者 🌱';
  if (rate >= 95) return '点数計算の神 👑';
  if (rate >= 85) return '雀聖 ⚡';
  if (rate >= 70) return '雀豪 🀄';
  if (rate >= 55) return '雀士 🀙';
  if (rate >= 40) return '見習い 🀇';
  return '修行中 📖';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 20,
  },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { color: COLORS.white, fontSize: 16 },
  emptyHint: { color: COLORS.dimWhite, fontSize: 14 },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: { color: COLORS.dimWhite, fontSize: 13 },
  statValue: { color: COLORS.gold, fontSize: 26, fontWeight: 'bold' },
  statSub: { color: COLORS.dimWhite, fontSize: 11 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  barContainer: {
    height: 28,
    backgroundColor: '#0a2a0a',
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 6,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    minWidth: 4,
  },
  barText: {
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
  },
  rateDetail: { color: COLORS.dimWhite, fontSize: 12, textAlign: 'right' },
  rankSection: { alignItems: 'center', gap: 6 },
  rankLabel: { color: COLORS.dimWhite, fontSize: 13 },
  rankValue: { color: COLORS.gold, fontSize: 24, fontWeight: 'bold' },
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  historyDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  historyLegend: { color: COLORS.dimWhite, fontSize: 11 },
  clearBtn: {
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  clearText: { color: COLORS.red, fontSize: 14 },
  backBtn: { alignItems: 'center', padding: 10 },
  backText: { color: COLORS.dimWhite, fontSize: 16 },
});
