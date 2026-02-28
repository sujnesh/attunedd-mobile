import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TrainStackParamList } from './types';
import TrainHomeScreen from '../screens/train/TrainHomeScreen';
import ActiveWorkoutScreen from '../screens/train/ActiveWorkoutScreen';
import FreeFormWorkoutScreen from '../screens/train/FreeFormWorkoutScreen';

const Stack = createNativeStackNavigator<TrainStackParamList>();

export default function TrainStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A0A' },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="TrainHome" component={TrainHomeScreen} />
      <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutScreen} />
      <Stack.Screen name="FreeFormWorkout" component={FreeFormWorkoutScreen} />
    </Stack.Navigator>
  );
}
