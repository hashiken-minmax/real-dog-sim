import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mahjong_results';

export async function saveResult(correct) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const results = raw ? JSON.parse(raw) : [];
    results.push({ correct, timestamp: Date.now() });
    await AsyncStorage.setItem(KEY, JSON.stringify(results));
  } catch (e) {
    console.warn('Failed to save result', e);
  }
}

export async function getResults() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearResults() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('Failed to clear results', e);
  }
}

export function computeStats(results) {
  if (results.length === 0) {
    return { total: 0, correct: 0, rate: 0, recent100Rate: 0, recent100: 0 };
  }
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const rate = Math.round((correct / total) * 100);

  const recent = results.slice(-100);
  const recent100 = recent.length;
  const recent100Correct = recent.filter(r => r.correct).length;
  const recent100Rate = Math.round((recent100Correct / recent100) * 100);

  return { total, correct, rate, recent100Rate, recent100 };
}
