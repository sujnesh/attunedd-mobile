import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseSetInput } from '../../services/setParser';
import { useActiveWorkout } from '../../workout/controller/useActiveWorkout';
import type { Deviation } from '../../workout/core/deviationEngine';
import type { SessionSet } from '../../workout/core/sessionState';
import type { PlannedWorkoutProps } from '../../navigation/types';
import type { PlanBlock, PlanExercise, CurrentPlanResponse, PlanDayData } from '../../types/api';
import { apiCached } from '../../services/apiClient';
import { useSessionTimer } from '../../workout/hooks/useSessionTimer';
import InfoChip from '../../components/InfoChip';
import { useEducation } from '../../components/EducationProvider';
import TutorialHint from '../../components/TutorialHint';
import { getMeta, setMeta } from '../../services/metaStateService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function PlannedWorkoutScreen({ route, navigation }: PlannedWorkoutProps) {
  const { draftId } = route.params;
  const insets = useSafeAreaInsets();
  const { openTopic } = useEducation();
  const {
    session,
    nudge,
    fatigueExercises,
    loading,
    finishing,
    initSession,
    submitSet,
    confirmOverride,
    undoLastSet,
    finishSession,
  } = useActiveWorkout();

  const inputRef = useRef<TextInput>(null);
  const timer = useSessionTimer(session?.startedAt ?? null);
  const [input, setInput] = useState('');
  const [deviation, setDeviation] = useState<Deviation | null>(null);
  const [pendingParsed, setPendingParsed] = useState<{
    exerciseName: string;
    weight: number | null;
    reps: number;
    rpe: number;
  } | null>(null);
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>([]);
  const [todayRationale, setTodayRationale] = useState<string | null>(null);
  const [isFirstWorkout, setIsFirstWorkout] = useState(false);
  const [setsLogged, setSetsLogged] = useState(0);

  useEffect(() => {
    initSession('planned', draftId);
    fetchTodayData(setPlanBlocks, setTodayRationale);
    getMeta('first_workout_completed').then((val) => {
      setIsFirstWorkout(val !== 'true');
    });
  }, [draftId, initSession]);

  useEffect(() => {
    setSetsLogged(session?.sets.length ?? 0);
  }, [session?.sets.length]);

  const handleSubmit = async () => {
    const parsed = parseSetInput(input.trim());
    if (!parsed) return;

    const dev = await submitSet(parsed.exerciseName, parsed.weight, parsed.reps, parsed.rpe);
    if (dev) {
      setDeviation(dev);
      setPendingParsed(parsed);
      return;
    }

    setInput('');
    setDeviation(null);
    setPendingParsed(null);
  };

  const handleOverride = async () => {
    if (!pendingParsed || !deviation) return;
    await confirmOverride(
      pendingParsed.exerciseName,
      pendingParsed.weight,
      pendingParsed.reps,
      pendingParsed.rpe,
      deviation,
    );
    setInput('');
    setDeviation(null);
    setPendingParsed(null);
  };

  const handleDismiss = () => {
    setDeviation(null);
    setPendingParsed(null);
  };

  const handleExerciseTap = (exerciseName: string) => {
    setInput(exerciseName.toLowerCase() + ' ');
    inputRef.current?.focus();
  };

  const handleFinish = () => {
    const setCount = session?.sets.length ?? 0;
    Alert.alert(
      'Finish Session?',
      `${setCount} set${setCount !== 1 ? 's' : ''} logged`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: doFinish },
      ],
    );
  };

  const doFinish = async () => {
    try {
      if (isFirstWorkout) {
        await setMeta('first_workout_completed', 'true');
      }
      const debrief = await finishSession();
      if (debrief) {
        navigation.replace('PostWorkoutDebrief', { debrief });
      } else {
        navigation.popToTop();
      }
    } catch {
      Alert.alert('Sync Failed', 'Could not reach server. Please retry.', [
        { text: 'OK' },
      ]);
    }
  };

  if (loading || !session) return <View style={styles.root} />;

  const stressPct = session.allowedStress > 0
    ? Math.round((session.cumulativeStress / session.allowedStress) * 100)
    : null;

  const loggedByExercise = groupByExercise(session.sets);
  const mainExercises = planBlocks
    .filter((b) => b.name === 'Main')
    .flatMap((b) => b.exercises)
    .filter((ex) => ex.sets);
  const prescribedNames = new Set(mainExercises.map((ex) => ex.name.toLowerCase()));
  const additionalExercises = loggedByExercise.filter(
    ([name]) => !prescribedNames.has(name.toLowerCase()),
  );

  const halfBudget = session.allowedStress > 0 && stressPct !== null && stressPct >= 45 && stressPct <= 55;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>PLANNED SESSION</Text>
          <Text style={styles.timerText}>{timer}</Text>
        </View>
        <View style={styles.stressRow}>
          <InfoChip topic="stress_units">
            <Text style={styles.stressValue}>
              {Math.round(session.cumulativeStress)}
              {session.allowedStress > 0 && (
                <Text style={styles.stressDenom}> / {Math.round(session.allowedStress)}</Text>
              )}
            </Text>
          </InfoChip>
          {stressPct != null && (
            <Text style={[styles.stressPct, stressPct >= 85 && styles.stressWarn]}>
              {stressPct}%
            </Text>
          )}
        </View>
        <View style={styles.capsRow}>
          <InfoChip topic="rpe">
            <Text style={styles.capChip}>RPE {session.caps.max_rpe}</Text>
          </InfoChip>
          <InfoChip topic="stress_budget">
            <Text style={styles.capChip}>{session.caps.max_allowed_stress_pct}%</Text>
          </InfoChip>
          {session.caps.block_heavy_neural && (
            <Text style={[styles.capChip, styles.capAlert]}>NO HEAVY</Text>
          )}
        </View>
      </View>

      {nudge && (
        <View style={styles.nudgeBar}>
          <Text style={styles.nudgeText}>{nudge}</Text>
        </View>
      )}

      <ScrollView style={styles.setList} keyboardShouldPersistTaps="handled">
        {todayRationale && (
          <Text style={styles.rationale}>{todayRationale}</Text>
        )}

        <TutorialHint
          hintKey="first_workout_exercises"
          message="These exercises were picked for your goals. Tap any for details."
          visible={isFirstWorkout && mainExercises.length > 0 && setsLogged === 0}
        />

        {mainExercises.map((ex, i) => {
          const logged = loggedByExercise.find(
            ([name]) => name.toLowerCase() === ex.name.toLowerCase(),
          );
          const loggedSets = logged?.[1] ?? [];
          const isFatigued = fatigueExercises.has(ex.name);

          return (
            <ExerciseCard
              key={i}
              exercise={ex}
              loggedSets={loggedSets}
              isFatigued={isFatigued}
              onTap={() => handleExerciseTap(ex.name)}
              onInfoTap={() => {
                if (ex.description || ex.coaching_tip) {
                  openTopic('rpe'); // fallback; ideally exercise-specific
                }
              }}
            />
          );
        })}

        {additionalExercises.length > 0 && (
          <>
            <Text style={styles.additionalLabel}>ADDITIONAL</Text>
            {additionalExercises.map(([name, sets]) => (
              <View key={name} style={styles.exerciseBlock}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{name.toUpperCase()}</Text>
                  {fatigueExercises.has(name) && (
                    <Text style={styles.fatigueTag}>FATIGUE</Text>
                  )}
                </View>
                {sets.map((s, j) => (
                  <SetRowView key={j} set={s} />
                ))}
              </View>
            ))}
          </>
        )}

        {mainExercises.length === 0 && loggedByExercise.length === 0 && (
          <Text style={styles.emptyHint}>Log sets below{'\n'}e.g. bench press 135x5@8</Text>
        )}

        <TutorialHint
          hintKey="first_workout_input"
          message="Type your set: 80x8@7 means 80kg for 8 reps at effort level 7"
          visible={isFirstWorkout && setsLogged === 0 && mainExercises.length > 0}
        />

        <TutorialHint
          hintKey="first_workout_stress"
          message={`Nice! That added stress to your budget. You have ${session.allowedStress > 0 ? Math.round(session.allowedStress - session.cumulativeStress) : '—'} remaining.`}
          visible={isFirstWorkout && setsLogged === 1}
        />

        <TutorialHint
          hintKey="first_workout_halfway"
          message="Halfway through today's budget. Pacing well."
          visible={isFirstWorkout && halfBudget}
        />
      </ScrollView>

      {deviation && (
        <View style={styles.warningBar}>
          <Text style={styles.warningText}>{deviation.message}</Text>
          <View style={styles.warningActions}>
            <Pressable onPress={handleOverride} style={styles.warningBtn}>
              <Text style={styles.overrideText}>OVERRIDE</Text>
            </Pressable>
            <Pressable onPress={handleDismiss} style={styles.warningBtn}>
              <Text style={styles.dismissText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="bench press 135x5@8"
          placeholderTextColor="#444444"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
        {session.sets.length > 0 && (
          <Pressable onPress={undoLastSet} style={styles.undoBtn}>
            <Text style={styles.undoText}>UNDO</Text>
          </Pressable>
        )}
        <Pressable onPress={handleSubmit} style={styles.sendBtn}>
          <Text style={styles.sendText}>LOG</Text>
        </Pressable>
        <Pressable
          onPress={handleFinish}
          style={styles.finishBtn}
          disabled={finishing}>
          <Text style={styles.finishText}>
            {finishing ? '...' : 'DONE'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ExerciseCard({
  exercise,
  loggedSets,
  isFatigued,
  onTap,
  onInfoTap,
}: {
  exercise: PlanExercise;
  loggedSets: SessionSet[];
  isFatigued: boolean;
  onTap: () => void;
  onInfoTap: () => void;
}) {
  const target = exercise.sets && exercise.rep_range
    ? `${exercise.sets}\u00D7${exercise.rep_range}`
    : '';

  return (
    <Pressable onPress={onTap} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{exercise.name.toUpperCase()}</Text>
          {target ? <Text style={styles.cardTarget}>{target}</Text> : null}
        </View>
        <View style={styles.cardMeta}>
          {exercise.rpe_target && (
            <InfoChip topic="rpe">
              <Text style={styles.cardRpe}>@RPE {exercise.rpe_target}</Text>
            </InfoChip>
          )}
          {(exercise.description || exercise.coaching_tip) && (
            <Pressable onPress={onInfoTap} hitSlop={8}>
              <Text style={styles.infoBtn}>?</Text>
            </Pressable>
          )}
        </View>
      </View>

      {exercise.description && (
        <Text style={styles.cardContext} numberOfLines={1}>
          {exercise.description}
        </Text>
      )}

      {isFatigued && (
        <View style={styles.fatigueRow}>
          <InfoChip topic="fatigue_detected">
            <Text style={styles.fatigueTag}>FATIGUE DETECTED</Text>
          </InfoChip>
        </View>
      )}

      {loggedSets.map((s, i) => (
        <SetRowView key={i} set={s} />
      ))}

      {loggedSets.length < (exercise.sets ?? 0) && (
        <Text style={styles.cardSlot}>
          #{loggedSets.length + 1}  tap to log
        </Text>
      )}
    </Pressable>
  );
}

function SetRowView({ set }: { set: SessionSet }) {
  return (
    <View style={styles.setRow}>
      <Text style={styles.setNum}>#{set.setNumber}</Text>
      <Text style={styles.setText}>
        {set.weight != null ? `${set.weight}\u00D7` : ''}{set.reps}@{set.rpe}
      </Text>
      <Text style={styles.setStress}>{Math.round(set.stressUnits)}</Text>
      {set.capOverride && <Text style={styles.overrideTag}>OVR</Text>}
    </View>
  );
}

async function fetchTodayData(
  setBlocks: (b: PlanBlock[]) => void,
  setRationale: (r: string | null) => void,
) {
  try {
    const body = await apiCached<CurrentPlanResponse>('/api/plans/current', 'cache_plans_current');
    const today = body.week?.find((d: PlanDayData) => d.today);
    if (today?.blocks) {
      setBlocks(today.blocks);
    }
    setRationale(today?.rationale ?? null);
  } catch {
    // Non-fatal
  }
}

function groupByExercise(sets: SessionSet[]): [string, SessionSet[]][] {
  const map = new Map<string, SessionSet[]>();
  for (const s of sets) {
    const group = map.get(s.exerciseName) ?? [];
    group.push(s);
    map.set(s.exerciseName, group);
  }
  return Array.from(map.entries());
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
  },
  timerText: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
  },
  stressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stressValue: {
    color: '#EAEAEA',
    fontSize: 28,
    fontWeight: '200',
    fontFamily: MONO,
  },
  stressDenom: {
    color: '#555555',
    fontSize: 16,
  },
  stressPct: {
    color: '#888888',
    fontSize: 14,
    fontFamily: MONO,
  },
  stressWarn: {
    color: '#F1C40F',
  },
  capsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  capChip: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capAlert: {
    color: '#E74C3C',
    borderColor: '#E74C3C',
  },
  nudgeBar: {
    backgroundColor: '#0D0D1A',
    borderBottomWidth: 0.5,
    borderBottomColor: '#333366',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  nudgeText: {
    color: '#8888CC',
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
  },
  setList: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  rationale: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  card: {
    borderWidth: 0.5,
    borderColor: '#222222',
    padding: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flex: 1,
  },
  cardName: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardTarget: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardRpe: {
    color: '#888888',
    fontSize: 10,
    fontFamily: MONO,
  },
  infoBtn: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '600',
    width: 20,
    height: 20,
    textAlign: 'center',
    lineHeight: 20,
    borderWidth: 0.5,
    borderColor: '#333333',
    borderRadius: 10,
  },
  cardContext: {
    color: '#555555',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 6,
  },
  fatigueRow: {
    marginBottom: 4,
  },
  cardSlot: {
    color: '#333333',
    fontSize: 11,
    fontFamily: MONO,
    paddingVertical: 6,
  },
  additionalLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 12,
  },
  exerciseBlock: {
    marginBottom: 20,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  exerciseName: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  fatigueTag: {
    color: '#E74C3C',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    borderWidth: 0.5,
    borderColor: '#E74C3C',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  setNum: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    width: 24,
  },
  setText: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
    flex: 1,
  },
  setStress: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    width: 48,
    textAlign: 'right',
  },
  overrideTag: {
    color: '#F1C40F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyHint: {
    color: '#333333',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 80,
    lineHeight: 22,
    fontFamily: MONO,
  },
  warningBar: {
    backgroundColor: '#1A1000',
    borderTopWidth: 0.5,
    borderTopColor: '#F1C40F',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  warningText: {
    color: '#F1C40F',
    fontSize: 12,
    marginBottom: 8,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 16,
  },
  warningBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  overrideText: {
    color: '#E74C3C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  dismissText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    backgroundColor: '#0D0D0D',
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#151515',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  undoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  undoText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sendText: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  finishBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  finishText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
