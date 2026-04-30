import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image } from 'react-native';
import * as Haptics from 'expo-haptics';

const COLORS = {
  bg: '#0a2a0a',
  surface: '#0f3d0f',
  gold: '#c9a227',
  white: '#f0f0e8',
  dimWhite: '#a8a89a',
  red: '#c0392b',
};

function MenuButton({ title, onPress }) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };
  return (
    <TouchableOpacity style={styles.menuBtn} onPress={handlePress} activeOpacity={0.75}>
      <Text style={styles.menuBtnText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function TitleScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}>
        <Text style={styles.titleJa}>麻雀点数計算</Text>
        <Text style={styles.titleSub}>練習アプリ</Text>
        <Text style={styles.tileDecor}>🀇🀙🀐🀄</Text>
      </View>
      <View style={styles.menu}>
        <MenuButton
          title="▶  ゲームを遊ぶ"
          onPress={() => navigation.navigate('GameMode')}
        />
        <MenuButton
          title="🏆  実績"
          onPress={() => navigation.navigate('Achievement')}
        />
      </View>
      <Text style={styles.footer}>符・飜の計算をマスターしよう</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  titleJa: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 4,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  titleSub: {
    fontSize: 20,
    color: COLORS.white,
    marginTop: 6,
    letterSpacing: 6,
  },
  tileDecor: {
    fontSize: 32,
    marginTop: 16,
    letterSpacing: 4,
  },
  menu: {
    width: '100%',
    gap: 16,
  },
  menuBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  menuBtnText: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  footer: {
    color: COLORS.dimWhite,
    fontSize: 13,
    letterSpacing: 1,
  },
});
