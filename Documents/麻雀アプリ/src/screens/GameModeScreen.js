import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import * as Haptics from 'expo-haptics';

const COLORS = {
  bg: '#0a2a0a',
  surface: '#0f3d0f',
  gold: '#c9a227',
  white: '#f0f0e8',
  dimWhite: '#a8a89a',
  accent: '#1a6b1a',
};

function ModeCard({ title, subtitle, emoji, onPress }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };
  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.75}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export default function GameModeScreen({ navigation }) {
  const goToQuestion = (mode) => {
    navigation.navigate('Question', { gameMode: mode });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <Text style={styles.heading}>ゲームモード選択</Text>
      <Text style={styles.desc}>どちらの麻雀で練習しますか？</Text>
      <View style={styles.cards}>
        <ModeCard
          title="四人麻雀"
          subtitle="東南西北の4人戦\n標準的な点数計算"
          emoji="🀀🀁🀂🀃"
          onPress={() => goToQuestion(4)}
        />
        <ModeCard
          title="三人麻雀"
          subtitle="東南西の3人戦\n2〜8萬なし"
          emoji="🀀🀁🀂"
          onPress={() => goToQuestion(3)}
        />
      </View>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.goBack();
        }}
      >
        <Text style={styles.backText}>← 戻る</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 3,
  },
  desc: {
    fontSize: 15,
    color: COLORS.dimWhite,
    textAlign: 'center',
  },
  cards: {
    width: '100%',
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  cardEmoji: {
    fontSize: 28,
    letterSpacing: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  cardSub: {
    fontSize: 14,
    color: COLORS.dimWhite,
    textAlign: 'center',
    lineHeight: 20,
  },
  backBtn: {
    marginTop: 8,
    padding: 10,
  },
  backText: {
    color: COLORS.dimWhite,
    fontSize: 16,
  },
});
