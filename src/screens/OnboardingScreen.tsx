import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { getMeta } from '../services/metaStateService';
import { completeOnboarding } from '../navigation/AppNavigator';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

type OptionKey = string;

interface OptionGroup {
  label: string;
  key: string;
  options: { value: OptionKey; label: string }[];
}

const TRAINING_TYPES: OptionGroup = {
  label: 'TRAINING TYPE',
  key: 'training_type',
  options: [
    { value: 'bodybuilding', label: 'BODYBUILDING' },
    { value: 'running', label: 'RUNNING' },
    { value: 'hybrid', label: 'HYBRID' },
  ],
};

const GOALS: OptionGroup = {
  label: 'PRIMARY GOAL',
  key: 'primary_goal',
  options: [
    { value: 'hypertrophy', label: 'HYPERTROPHY' },
    { value: 'strength', label: 'STRENGTH' },
    { value: 'fat_loss', label: 'FAT LOSS' },
    { value: 'endurance', label: 'ENDURANCE' },
  ],
};

const EXPERIENCE: OptionGroup = {
  label: 'EXPERIENCE LEVEL',
  key: 'experience_level',
  options: [
    { value: 'beginner', label: 'BEGINNER' },
    { value: 'intermediate', label: 'INTERMEDIATE' },
    { value: 'advanced', label: 'ADVANCED' },
  ],
};

const DAYS: OptionGroup = {
  label: 'DAYS PER WEEK',
  key: 'days_per_week',
  options: [
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
  ],
};

const EQUIPMENT: OptionGroup = {
  label: 'EQUIPMENT',
  key: 'equipment',
  options: [
    { value: 'gym', label: 'FULL GYM' },
    { value: 'home', label: 'HOME' },
    { value: 'minimal', label: 'MINIMAL' },
  ],
};

const DURATION: OptionGroup = {
  label: 'SESSION DURATION',
  key: 'session_minutes',
  options: [
    { value: '30', label: '30 MIN' },
    { value: '45', label: '45 MIN' },
    { value: '60', label: '60 MIN' },
    { value: '90', label: '90 MIN' },
  ],
};

const GROUPS = [TRAINING_TYPES, GOALS, EXPERIENCE, DAYS, EQUIPMENT, DURATION];

const DEFAULTS: Record<string, string> = {
  training_type: 'bodybuilding',
  primary_goal: 'hypertrophy',
  experience_level: 'intermediate',
  days_per_week: '4',
  equipment: 'gym',
  session_minutes: '60',
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [selections, setSelections] = useState<Record<string, string>>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);

  const select = (key: string, value: string) => {
    setSelections((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getMeta('auth_token');
      if (!token) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/onboarding/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          preferences: {
            training_type: selections.training_type,
            primary_goal: selections.primary_goal,
            experience_level: selections.experience_level,
            days_per_week: parseInt(selections.days_per_week, 10),
            equipment: selections.equipment,
            session_minutes: parseInt(selections.session_minutes, 10),
          },
        }),
      });

      if (res.ok) {
        await completeOnboarding();
      } else {
        const body = await res.json();
        const msg = body.errors?.join('\n') || 'Could not save preferences';
        Alert.alert('Error', msg);
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
      ]}>
      <Text style={styles.title}>SET UP YOUR PROFILE</Text>
      <Text style={styles.subtitle}>
        Tell us about your training so we can calibrate coaching.
      </Text>

      {GROUPS.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.optionsRow}>
            {group.options.map((opt) => {
              const selected = selections[group.key] === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => select(group.key, opt.value)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Pressable
        onPress={handleSubmit}
        style={[styles.submitBtn, submitting && styles.submitDisabled]}
        disabled={submitting}>
        <Text style={styles.submitText}>
          {submitting ? 'SAVING...' : 'CONTINUE'}
        </Text>
      </Pressable>
    </ScrollView>
  );
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  group: {
    marginBottom: 24,
  },
  groupLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#0D1A0D',
  },
  optionText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: MONO,
  },
  optionTextSelected: {
    color: '#22C55E',
  },
  submitBtn: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
  },
});
