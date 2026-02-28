import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { DebriefData } from '../types/api';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TrainStackParamList = {
  TrainHome: undefined;
  PlannedWorkout: { draftId: number };
  FreeFormWorkout: { draftId: number };
  PostWorkoutDebrief: { debrief: DebriefData };
};

export type RootTabParamList = {
  Dashboard: undefined;
  Train: NavigatorScreenParams<TrainStackParamList>;
  Health: undefined;
  Sync: undefined;
};

export type LoginProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export type TrainHomeProps = NativeStackScreenProps<TrainStackParamList, 'TrainHome'>;
export type PlannedWorkoutProps = NativeStackScreenProps<TrainStackParamList, 'PlannedWorkout'>;
export type FreeFormWorkoutProps = NativeStackScreenProps<TrainStackParamList, 'FreeFormWorkout'>;
export type PostWorkoutDebriefProps = NativeStackScreenProps<TrainStackParamList, 'PostWorkoutDebrief'>;
export type DashboardTabProps = BottomTabScreenProps<RootTabParamList, 'Dashboard'>;
export type HealthTabProps = BottomTabScreenProps<RootTabParamList, 'Health'>;
export type SyncTabProps = BottomTabScreenProps<RootTabParamList, 'Sync'>;
