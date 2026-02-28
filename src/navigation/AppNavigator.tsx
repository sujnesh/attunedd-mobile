import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import type { RootTabParamList } from './types';
import DashboardScreen from '../screens/DashboardScreen';
import TrainStack from './TrainStack';
import HealthScreen from '../screens/HealthScreen';
import SyncScreen from '../screens/SyncScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '\u25C9',  // ◉
  Train: '\u25B2',      // ▲
  Health: '\u2661',     // ♡
  Sync: '\u21BB',       // ↻
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#111111',
            borderTopColor: '#222222',
            borderTopWidth: 0.5,
            height: 80,
            paddingBottom: 24,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#EAEAEA',
          tabBarInactiveTintColor: '#555555',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 1,
          },
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 18 }}>
              {TAB_ICONS[route.name] ?? ''}
            </Text>
          ),
        })}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Train" component={TrainStack} />
        <Tab.Screen name="Health" component={HealthScreen} />
        <Tab.Screen name="Sync" component={SyncScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
