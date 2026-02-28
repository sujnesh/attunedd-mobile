import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getActiveDraft,
  discardDraft,
  type DraftInfo,
} from '../../workout/controller/useActiveWorkout';
import { executeSql, generateUUID, nowISO } from '../../db/database';
import { deriveCaps } from '../../state/evaluationEngine';
import { getMeta } from '../../services/metaStateService';
import {
  initializeSession,
  serialize,
} from '../../workout/core/sessionState';
import { createOverrideTracker } from '../../workout/core/overrideTracker';
import type { TrainHomeProps } from '../../navigation/types';
import type { PolicyCaps } from '../../engine/types';
import type { PlanDayData, PlanData } from '../../types/api';
import { API_BASE_URL } from '../../config';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function TrainHomeScreen({ navigation }: TrainHomeProps) {
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<PlanDayData | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveDraft().then(setDraft).catch(() => setDraft(null));
      fetchTodayPlan(setPlanName, setTodaySession);
    }, [])
  );

  const handleStart = async (mode: 'planned' | 'free_form') => {
    if (starting) return;
    setStarting(true);
    try {
      // Discard any existing draft before starting fresh
      if (draft) {
        await discardDraft(draft.draftId);
        setDraft(null);
      }

      // Create draft
      const band = await getMeta('last_risk_band');
      const caps = deriveCaps(band ?? 'green');
      const allowedStress = await computeAllowedStress(caps);
      const mobileLocalId = generateUUID();
      const state = initializeSession(mode, caps, allowedStress);
      const now = nowISO();

      const [insertResult] = await executeSql(
        `INSERT INTO session_drafts (mode, mobile_local_id, caps_json, state_json, override_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [mode, mobileLocalId, JSON.stringify(caps), serialize(state), JSON.stringify(createOverrideTracker()), now, now]
      );
      const draftId = insertResult.insertId!;

      const screen = mode === 'planned' ? 'PlannedWorkout' : 'FreeFormWorkout';
      navigation.navigate(screen, { draftId });
    } catch {
      // start failure is non-fatal
    } finally {
      setStarting(false);
    }
  };

  const handleResume = () => {
    if (!draft) return;
    const screen = draft.mode === 'planned' ? 'PlannedWorkout' : 'FreeFormWorkout';
    navigation.navigate(screen, { draftId: draft.draftId });
  };

  const handleDiscard = async () => {
    if (!draft) return;
    await discardDraft(draft.draftId);
    setDraft(null);
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top + 48 }]} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TRAIN</Text>

      {todaySession && !todaySession.rest_day && (
        <View style={styles.planBlock}>
          <Text style={styles.planLabel}>TODAY&apos;S SESSION</Text>
          <Text style={styles.planName}>
            {formatSessionType(todaySession.session_type)}
          </Text>
          {planName && <Text style={styles.planSubtext}>{planName}</Text>}
          {todaySession.workout_status === 'completed' && (
            <Text style={styles.planCompleted}>COMPLETED</Text>
          )}
          {todaySession.blocks
            .filter((b) => b.name === 'Main')
            .flatMap((b) => b.exercises)
            .map((ex, i) => (
              <Text key={i} style={styles.planExercise}>
                {ex.name}
                {ex.sets && ex.rep_range ? `  ${ex.sets}×${ex.rep_range}` : ''}
                {ex.duration_minutes ? `  ${ex.duration_minutes} min` : ''}
              </Text>
            ))}
        </View>
      )}

      {todaySession?.rest_day && (
        <View style={styles.restBlock}>
          <Text style={styles.restLabel}>REST DAY</Text>
          <Text style={styles.restHint}>Recovery is part of the program</Text>
        </View>
      )}

      {draft && (
        <View style={styles.draftBlock}>
          <Text style={styles.draftTitle}>IN-PROGRESS SESSION</Text>
          <Text style={styles.draftInfo}>
            {draft.mode === 'planned' ? 'PLANNED' : 'FREE FORM'} — {draft.setCount} sets logged
          </Text>
          <View style={styles.draftActions}>
            <Pressable
              style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}
              onPress={handleResume}>
              <Text style={styles.resumeText}>RESUME</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.discardBtn, pressed && styles.pressed]}
              onPress={handleDiscard}>
              <Text style={styles.discardText}>DISCARD</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => handleStart('planned')}
          disabled={starting}>
          <Text style={styles.buttonLabel}>START PLANNED WORKOUT</Text>
          <Text style={styles.buttonHint}>Coached session with fatigue tracking</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => handleStart('free_form')}
          disabled={starting}>
          <Text style={styles.buttonLabel}>FREE FORM SESSION</Text>
          <Text style={styles.buttonHint}>Open session with auto-detection</Text>
        </Pressable>
      </View>

      {starting && <Text style={styles.status}>STARTING...</Text>}
    </ScrollView>
  );
}

async function fetchTodayPlan(
  setPlanName: (n: string | null) => void,
  setTodaySession: (s: PlanDayData | null) => void,
) {
  try {
    const token = await getMeta('auth_token');
    if (!token) return;

    const res = await fetch(`${API_BASE_URL}/api/plans/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const body = await res.json();
    setPlanName(body.plan?.name ?? null);
    const today = (body.week as PlanDayData[])?.find((d) => d.today) ?? null;
    setTodaySession(today);
  } catch {
    // Non-fatal
  }
}

function formatSessionType(type: string): string {
  return type.replace(/_/g, ' ').toUpperCase();
}

async function computeAllowedStress(caps: PolicyCaps): Promise<number> {
  const [result] = await executeSql(
    `SELECT AVG(actual_stress) as avg FROM (
       SELECT actual_stress FROM workout_logs
       WHERE status = 'completed' AND actual_stress > 0
       ORDER BY completed_at DESC LIMIT 10
     );`
  );
  const avg = result.rows.item(0)?.avg ?? 0;
  if (avg <= 0) return 0;
  return avg * (caps.max_allowed_stress_pct / 100);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  planBlock: {
    borderWidth: 0.5,
    borderColor: '#2ECC71',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  planLabel: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  planName: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
    marginBottom: 4,
  },
  planSubtext: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    marginBottom: 12,
  },
  planCompleted: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
    marginBottom: 8,
  },
  planExercise: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    paddingVertical: 2,
  },
  restBlock: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  restLabel: {
    color: '#555555',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: MONO,
    marginBottom: 6,
  },
  restHint: {
    color: '#333333',
    fontSize: 11,
  },
  draftBlock: {
    borderWidth: 0.5,
    borderColor: '#F1C40F',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  draftTitle: {
    color: '#F1C40F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  draftInfo: {
    color: '#888888',
    fontSize: 12,
    fontFamily: MONO,
    marginBottom: 16,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  resumeBtn: {
    borderWidth: 0.5,
    borderColor: '#F1C40F',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resumeText: {
    color: '#F1C40F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  discardBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  discardText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  buttonGroup: {
    gap: 16,
  },
  button: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  pressed: {
    backgroundColor: '#151515',
  },
  buttonLabel: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  buttonHint: {
    color: '#555555',
    fontSize: 11,
    marginTop: 6,
  },
  status: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 32,
  },
});
