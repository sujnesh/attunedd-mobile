import React, { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getActiveDraft,
  discardDraft,
  type DraftInfo,
} from '../../workout/controller/useActiveWorkout';
import { executeSql, generateUUID, nowISO } from '../../db/database';
import { deriveCaps } from '../../state/evaluationEngine';
import { getMeta, setMeta } from '../../services/metaStateService';
import {
  initializeSession,
  serialize,
} from '../../workout/core/sessionState';
import { createOverrideTracker } from '../../workout/core/overrideTracker';
import type { TrainHomeProps } from '../../navigation/types';
import type { PolicyCaps } from '../../engine/types';
import type { PlanDayData, CurrentPlanResponse } from '../../types/api';
import { apiCached } from '../../services/apiClient';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DEVIATION_REASONS = [
  'Feeling different today',
  'Want to train other muscles',
  'Equipment unavailable',
  'Just exploring',
] as const;

export default function TrainHomeScreen({ navigation }: TrainHomeProps) {
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [todaySession, setTodaySession] = useState<PlanDayData | null>(null);
  const [week, setWeek] = useState<PlanDayData[]>([]);
  const [showDeviationPicker, setShowDeviationPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getActiveDraft().then(setDraft).catch(() => setDraft(null));
      fetchTodayPlan(setPlanName, setTodaySession, setWeek);
    }, [])
  );

  const handleStart = async (mode: 'planned' | 'free_form') => {
    if (starting) return;
    setStarting(true);
    try {
      if (draft) {
        await discardDraft(draft.draftId);
        setDraft(null);
      }

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
      // non-fatal
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

  const mainExercises = todaySession
    ? todaySession.blocks
        .filter((b) => b.name === 'Main')
        .flatMap((b) => b.exercises)
    : [];

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 48 }]}
      contentContainerStyle={styles.content}>

      {/* Today's prescription — dominant element */}
      {todaySession && !todaySession.rest_day && (
        <Pressable
          style={({ pressed }) => [styles.prescriptionBlock, pressed && styles.pressed]}
          onPress={() => navigation.navigate('PlanDetail')}>
          <Text style={styles.prescriptionLabel}>TODAY'S PRESCRIPTION</Text>
          <Text style={styles.prescriptionType}>
            {formatSessionType(todaySession.session_type)}
          </Text>
          {todaySession.rationale && (
            <Text style={styles.prescriptionRationale}>{todaySession.rationale}</Text>
          )}
          {mainExercises.slice(0, 4).map((ex, i) => (
            <Text key={i} style={styles.prescriptionExercise}>
              {ex.name}
              {ex.sets && ex.rep_range ? `  ${ex.sets}\u00D7${ex.rep_range}` : ''}
            </Text>
          ))}
          {mainExercises.length > 4 && (
            <Text style={styles.prescriptionMore}>+{mainExercises.length - 4} more</Text>
          )}

          {todaySession.workout_status === 'completed' && (
            <Text style={styles.completedTag}>Completed</Text>
          )}

          {todaySession.workout_status !== 'completed' && (
            <Pressable
              onPress={() => handleStart('planned')}
              style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
              disabled={starting}>
              <Text style={styles.startBtnText}>
                {starting ? 'Starting...' : 'Start Session'}
              </Text>
            </Pressable>
          )}
        </Pressable>
      )}

      {todaySession?.rest_day && (
        <Pressable
          style={({ pressed }) => [styles.restBlock, pressed && styles.pressed]}
          onPress={() => navigation.navigate('PlanDetail')}>
          <Text style={styles.prescriptionLabel}>TODAY'S PRESCRIPTION</Text>
          <Text style={styles.restType}>Rest Day</Text>
          {todaySession.rationale ? (
            <Text style={styles.restRationale}>{todaySession.rationale}</Text>
          ) : (
            <Text style={styles.restRationale}>Recovery priority scheduled.</Text>
          )}
        </Pressable>
      )}

      {!todaySession && (
        <View style={styles.noPlanBlock}>
          <Text style={styles.noPlanTitle}>No plan generated yet</Text>
          <Text style={styles.noPlanText}>
            Complete onboarding to receive your training prescription.
          </Text>
        </View>
      )}

      {/* In-progress draft */}
      {draft && (
        <View style={styles.draftBlock}>
          <Text style={styles.draftLabel}>IN PROGRESS</Text>
          <Text style={styles.draftInfo}>
            {draft.mode === 'planned' ? 'Planned' : 'Free form'} {'\u2014'} {draft.setCount} sets
          </Text>
          <View style={styles.draftActions}>
            <Pressable
              style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}
              onPress={handleResume}>
              <Text style={styles.resumeText}>Resume</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.discardBtn, pressed && styles.pressed]}
              onPress={handleDiscard}>
              <Text style={styles.discardText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Secondary: Free form option */}
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        onPress={() => {
          // Show deviation picker if a planned (non-rest, non-completed) session exists
          const hasPlannedSession = todaySession &&
            !todaySession.rest_day &&
            todaySession.workout_status !== 'completed';
          if (hasPlannedSession) {
            setShowDeviationPicker(true);
          } else {
            handleStart('free_form');
          }
        }}
        disabled={starting}>
        <Text style={styles.secondaryLabel}>Free Form Session</Text>
        <Text style={styles.secondaryHint}>Open session, log any exercise</Text>
      </Pressable>

      {/* Deviation reason picker */}
      <Modal
        visible={showDeviationPicker}
        transparent
        animationType="fade"
        statusBarTranslucent>
        <View style={styles.deviationOverlay}>
          <View style={styles.deviationCard}>
            <Text style={styles.deviationTitle}>WHY FREE FORM?</Text>
            <Text style={styles.deviationSubtitle}>
              You have a planned session today. Why are you deviating?
            </Text>
            {DEVIATION_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={({ pressed }) => [
                  styles.deviationOption,
                  pressed && styles.deviationOptionPressed,
                ]}
                onPress={async () => {
                  await setMeta('last_freeform_reason', reason);
                  setShowDeviationPicker(false);
                  handleStart('free_form');
                }}>
                <Text style={styles.deviationOptionText}>{reason}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowDeviationPicker(false)}
              style={styles.deviationCancel}>
              <Text style={styles.deviationCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Week schedule */}
      {week.length > 0 && (
        <WeekSchedule week={week} onViewPlan={() => navigation.navigate('PlanDetail')} />
      )}

      {/* History link */}
      <Pressable
        style={styles.historyLink}
        onPress={() => navigation.navigate('WorkoutHistory')}>
        <Text style={styles.historyText}>View History</Text>
      </Pressable>
    </ScrollView>
  );
}

function WeekSchedule({ week, onViewPlan }: { week: PlanDayData[]; onViewPlan: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.weekBlock, pressed && styles.pressed]}
      onPress={onViewPlan}>
      <Text style={styles.weekLabel}>THIS WEEK</Text>
      {week.map((day) => {
        const d = new Date(day.date + 'T00:00:00');
        const dayLabel = DAYS[d.getDay()];
        const isCompleted = day.workout_status === 'completed';
        const isFuture = !day.today && new Date(day.date) > new Date();

        return (
          <View
            key={day.date}
            style={[styles.weekRow, day.today && styles.weekRowToday]}>
            <Text
              style={[
                styles.weekDay,
                day.today && styles.weekDayToday,
                isFuture && styles.weekDimmed,
              ]}>
              {dayLabel}
            </Text>
            <Text
              style={[
                styles.weekSession,
                day.rest_day && styles.weekRest,
                isFuture && styles.weekDimmed,
              ]}
              numberOfLines={1}>
              {day.rest_day ? 'Rest' : formatSessionType(day.session_type)}
            </Text>
            {isCompleted && (
              <Text style={styles.weekCompleted}>{'\u2713'}</Text>
            )}
          </View>
        );
      })}
    </Pressable>
  );
}

async function fetchTodayPlan(
  setPlanName: (n: string | null) => void,
  setTodaySession: (s: PlanDayData | null) => void,
  setWeek: (w: PlanDayData[]) => void,
) {
  try {
    const body = await apiCached<CurrentPlanResponse>('/api/plans/current', 'cache_plans_current');
    setPlanName(body.plan?.name ?? null);
    const today = body.week?.find((d) => d.today) ?? null;
    setTodaySession(today);
    setWeek(body.week ?? []);
  } catch {
    // Non-fatal
  }
}

function formatSessionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  // Prescription block — dominant
  prescriptionBlock: {
    paddingVertical: 24,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  prescriptionLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  prescriptionType: {
    color: '#EAEAEA',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  prescriptionRationale: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  prescriptionExercise: {
    color: '#999999',
    fontSize: 13,
    fontFamily: MONO,
    paddingVertical: 3,
  },
  prescriptionMore: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
    marginTop: 4,
    marginBottom: 8,
  },
  completedTag: {
    color: '#2ECC71',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 12,
  },
  // Primary CTA
  startBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2ECC71',
  },
  startBtnPressed: {
    backgroundColor: '#27AE60',
  },
  startBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Rest day
  restBlock: {
    paddingVertical: 24,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  restType: {
    color: '#888888',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  restRationale: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },
  // No plan
  noPlanBlock: {
    paddingVertical: 32,
    marginBottom: 32,
  },
  noPlanTitle: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noPlanText: {
    color: '#555555',
    fontSize: 13,
    lineHeight: 20,
  },
  pressed: {
    backgroundColor: '#111111',
  },
  // Draft
  draftBlock: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1C40F',
  },
  draftLabel: {
    color: '#F1C40F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 8,
  },
  draftInfo: {
    color: '#888888',
    fontSize: 13,
    marginBottom: 16,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 20,
  },
  resumeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#F1C40F',
  },
  resumeText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  discardBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  discardText: {
    color: '#555555',
    fontSize: 13,
    letterSpacing: 1,
  },
  // Secondary button
  secondaryBtn: {
    paddingVertical: 18,
    paddingHorizontal: 4,
    marginBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
  },
  secondaryLabel: {
    color: '#CCCCCC',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  secondaryHint: {
    color: '#555555',
    fontSize: 12,
  },
  // Week
  weekBlock: {
    paddingVertical: 16,
    marginBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
  },
  weekLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekRowToday: {
    backgroundColor: '#111111',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  weekDay: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
    width: 44,
  },
  weekDayToday: {
    color: '#2ECC71',
  },
  weekSession: {
    color: '#CCCCCC',
    fontSize: 13,
    flex: 1,
  },
  weekRest: {
    color: '#555555',
  },
  weekDimmed: {
    color: '#444444',
  },
  weekCompleted: {
    color: '#2ECC71',
    fontSize: 13,
    width: 20,
    textAlign: 'right',
  },
  // History
  historyLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  historyText: {
    color: '#555555',
    fontSize: 12,
    letterSpacing: 1,
  },
  // Deviation picker
  deviationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deviationCard: {
    backgroundColor: '#111111',
    width: '100%',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222222',
  },
  deviationTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  deviationSubtitle: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  deviationOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
  },
  deviationOptionPressed: {
    backgroundColor: '#1A1A1A',
  },
  deviationOptionText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  deviationCancel: {
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  deviationCancelText: {
    color: '#555555',
    fontSize: 12,
    letterSpacing: 1,
  },
});
