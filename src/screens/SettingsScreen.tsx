import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { apiCached } from '../services/apiClient';
import { logout } from '../navigation/AppNavigator';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface ProfileData {
  user: { id: number; email: string };
  preferences: {
    training_type: string;
    primary_goal: string;
    experience_level: string;
    days_per_week: number;
    equipment: string;
    session_minutes: number;
  } | null;
  plan: {
    id: number;
    name: string;
    training_type: string;
  } | null;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      apiCached<ProfileData>('/api/profile', 'cache_profile')
        .then(setProfile)
        .catch(() => {});
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const prefs = profile?.preferences;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
      ]}>
      <Text style={styles.title}>SETTINGS</Text>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.row}>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.value}>{profile?.user.email ?? '—'}</Text>
        </View>
      </View>

      {/* Plan */}
      {profile?.plan && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CURRENT PLAN</Text>
          <View style={styles.row}>
            <Text style={styles.label}>NAME</Text>
            <Text style={styles.value}>{profile.plan.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>TYPE</Text>
            <Text style={styles.value}>{profile.plan.training_type.toUpperCase()}</Text>
          </View>
        </View>
      )}

      {/* Preferences */}
      {prefs && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TRAINING PREFERENCES</Text>
          <View style={styles.row}>
            <Text style={styles.label}>GOAL</Text>
            <Text style={styles.value}>{formatValue(prefs.primary_goal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>EXPERIENCE</Text>
            <Text style={styles.value}>{formatValue(prefs.experience_level)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>DAYS / WEEK</Text>
            <Text style={styles.value}>{prefs.days_per_week}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>EQUIPMENT</Text>
            <Text style={styles.value}>{formatValue(prefs.equipment)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SESSION</Text>
            <Text style={styles.value}>{prefs.session_minutes} MIN</Text>
          </View>
        </View>
      )}

      {/* WHOOP */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>INTEGRATIONS</Text>
        <View style={styles.row}>
          <Text style={styles.label}>WHOOP</Text>
          <Text style={styles.valueInactive}>NOT CONNECTED</Text>
        </View>
      </View>

      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        style={styles.logoutBtn}
        disabled={loggingOut}>
        <Text style={styles.logoutText}>
          {loggingOut ? 'LOGGING OUT...' : 'LOG OUT'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function formatValue(val: string): string {
  return val.replace(/_/g, ' ').toUpperCase();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingTop: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  value: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  valueInactive: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
  },
  logoutBtn: {
    marginTop: 32,
    borderWidth: 0.5,
    borderColor: '#E74C3C',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
  },
});
