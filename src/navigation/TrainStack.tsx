import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TrainStackParamList } from './types';
import TrainHomeScreen from '../screens/train/TrainHomeScreen';
import PlannedWorkoutScreen from '../screens/train/PlannedWorkoutScreen';
import FreeFormWorkoutScreen from '../screens/train/FreeFormWorkoutScreen';
import PostWorkoutDebriefScreen from '../screens/train/PostWorkoutDebriefScreen';
import WorkoutHistoryScreen from '../screens/train/WorkoutHistoryScreen';
import PlanDetailScreen from '../screens/train/PlanDetailScreen';

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
      <Stack.Screen name="PlannedWorkout" component={PlannedWorkoutScreen} />
      <Stack.Screen name="FreeFormWorkout" component={FreeFormWorkoutScreen} />
      <Stack.Screen name="PostWorkoutDebrief" component={PostWorkoutDebriefScreen} />
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
    </Stack.Navigator>
  );
}
