import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type TrainStackParamList = {
  TrainHome: undefined;
  ActiveWorkout: { workoutId: number; mobileLocalId: string };
  FreeFormWorkout: { workoutId: number; mobileLocalId: string };
};

export type RootTabParamList = {
  Dashboard: undefined;
  Train: NavigatorScreenParams<TrainStackParamList>;
  Health: undefined;
  Sync: undefined;
};

export type TrainHomeProps = NativeStackScreenProps<TrainStackParamList, 'TrainHome'>;
export type ActiveWorkoutProps = NativeStackScreenProps<TrainStackParamList, 'ActiveWorkout'>;
export type FreeFormWorkoutProps = NativeStackScreenProps<TrainStackParamList, 'FreeFormWorkout'>;
export type DashboardTabProps = BottomTabScreenProps<RootTabParamList, 'Dashboard'>;
export type HealthTabProps = BottomTabScreenProps<RootTabParamList, 'Health'>;
export type SyncTabProps = BottomTabScreenProps<RootTabParamList, 'Sync'>;
