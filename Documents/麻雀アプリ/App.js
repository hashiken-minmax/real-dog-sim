import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TitleScreen from './src/screens/TitleScreen';
import GameModeScreen from './src/screens/GameModeScreen';
import QuestionScreen from './src/screens/QuestionScreen';
import ResultScreen from './src/screens/ResultScreen';
import AchievementScreen from './src/screens/AchievementScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Title"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#0a2a0a' },
        }}
      >
        <Stack.Screen name="Title" component={TitleScreen} />
        <Stack.Screen name="GameMode" component={GameModeScreen} />
        <Stack.Screen name="Question" component={QuestionScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="Achievement" component={AchievementScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
