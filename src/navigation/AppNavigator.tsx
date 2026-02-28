import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import type { RootTabParamList, AuthStackParamList } from './types';
import DashboardScreen from '../screens/DashboardScreen';
import TrainStack from './TrainStack';
import HealthScreen from '../screens/HealthScreen';
import SyncScreen from '../screens/SyncScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { getMeta, setMeta } from '../services/metaStateService';
import { API_BASE_URL } from '../config';

const Tab = createBottomTabNavigator<RootTabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '\u25C9',  // ◉
  Train: '\u25B2',      // ▲
  Health: '\u2661',     // ♡
  Sync: '\u21BB',       // ↻
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
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
  );
}

export default function AppNavigator() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = await getMeta('auth_token');
    setAuthToken(token);
    setChecking(false);
  }, []);

  useEffect(() => {
    checkAuth();
    // Poll for auth state changes (login/register write to meta_state)
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, [checkAuth]);

  if (checking) {
    return null;
  }

  return (
    <NavigationContainer>
      {authToken ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export async function logout() {
  const token = await getMeta('auth_token');
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Server unreachable — still clear local token
    }
  }
  await setMeta('auth_token', '');
}
