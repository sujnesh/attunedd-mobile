import React, { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import {
  loadLatestEvaluation,
  triggerManualEvaluation,
  type ReadinessState,
} from '../services/readinessService';
import type { ParsedCaps } from '../services/metaStateService';
import { getMeta } from '../services/metaStateService';
import {
  buildExplanation,
  type ExplanationOutput,
} from '../services/explanationEngine';
import { apiCached } from '../services/apiClient';
import { deriveCaps } from '../state/evaluationEngine';
import { executeSql } from '../db/database';
import DailyCheckIn from '../components/DailyCheckIn';
import {
  saveCheckIn,
  getLastCheckIn,
  shouldShowCheckIn,
  getCheckInContext,
  type CheckInData,
} from '../services/checkInService';
import type { RootTabParamList } from '../navigation/types';
import type {
  CoachingTodayResponse,
  ProjectionDay,
  ProjectionsResponse,
  CurrentPlanResponse,
  PlanDayData,
} from '../types/api';

interface RecentWorkout {
  mode: string;
  stress: number;
  completedAt: string;
}

const BAND_COLORS: Record<string, string> = {
  green: '#2ECC71',
  yellow: '#F1C40F',
  red: '#E74C3C',
  optimal: '#2ECC71',
  suboptimal: '#F1C40F',
  high_risk: '#E74C3C',
};

const BAND_LABELS: Record<string, string> = {
  green: 'READY',
  yellow: 'CAUTION',
  red: 'REST',
  optimal: 'READY',
  suboptimal: 'CAUTION',
  high_risk: 'REST',
};

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

function mapServerToReadinessState(server: CoachingTodayResponse): ReadinessState {
  const score = Math.round(server.adaptation_score);
  const band = server.risk_band;
  const policyCaps = server.policy_caps as Record<string, number | boolean>;
  const caps: ParsedCaps = {
    maxRpe: (policyCaps.max_rpe as number) ?? deriveCaps(band).max_rpe,
    maxStressPct: (policyCaps.max_allowed_stress_pct as number) ?? deriveCaps(band).max_allowed_stress_pct,
    blockHeavyNeural: (policyCaps.block_heavy_neural as boolean) ?? deriveCaps(band).block_heavy_neural,
    maxCardioZone: (policyCaps.max_cardio_zone as number) ?? deriveCaps(band).max_cardio_zone,
  };

  return {
    data: {
      score,
      band,
      caps,
      timestamp: Date.now(),
      penalties: server.penalties,
      rawMetrics: server.raw_metrics,
      source: 'server',
      coaching: server.coaching,
    },
    isStale: false,
  };
}

function buildHeadline(
  coaching: CoachingTodayResponse['coaching'] | null | undefined,
  explanation: ExplanationOutput,
  penalties: { category: string; reason: string; points: number }[],
  rawMetrics: Record<string, unknown>,
  checkIn?: CheckInData | null,
): string {
  // Check-in signals take priority over generic "no penalties" messages
  if (checkIn && penalties.length === 0) {
    if (checkIn.energy <= 2) return 'Low energy noted. Adjust intensity today.';
    if (checkIn.sleepQuality <= 2) return 'Poor sleep reported. Recovery priority.';
    if (checkIn.soreness >= 4) return 'High soreness noted. Consider lighter load.';
  }

  // Use server coaching headline if available and not generic fluff
  if (coaching?.headline) {
    const lower = coaching.headline.toLowerCase();
    // Filter out generic motivational lines
    if (!lower.includes('push hard') && !lower.includes('fully recovered')) {
      return coaching.headline;
    }
  }

  // Build from penalties — reference actual cause
  if (penalties.length > 0) {
    const top = penalties.sort((a, b) => b.points - a.points)[0];
    if (top.category === 'recovery_window') return 'Recovery window active.';
    if (top.category === 'systemic_fatigue') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') return `Training load elevated ${Math.round((ratio - 1) * 100)}%.`;
      return 'Training load elevated.';
    }
    if (top.category === 'load_management') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') return `Load ratio ${ratio.toFixed(2)}x baseline.`;
      return 'Training load elevated.';
    }
    if (top.category === 'override_behavior') return 'Recent overrides affecting recovery.';
    return top.reason;
  }

  // No penalties — clean state
  return 'Recovery on track.';
}

function buildWhyBullets(
  penalties: { category: string; reason: string; points: number; metric_key: string }[],
  rawMetrics: Record<string, unknown>,
): string[] {
  const bullets: string[] = [];

  if (penalties.length === 0) {
    // Positive state — show what's clear
    const capacity = rawMetrics.capacity_score;
    if (typeof capacity === 'number') {
      bullets.push(`Recovery at ${Math.round(capacity * 100)}%`);
    }
    const ratio = rawMetrics.rolling_strain_ratio;
    if (typeof ratio === 'number') {
      bullets.push(`Load ratio ${ratio.toFixed(2)}x`);
    }
    bullets.push('No recovery concerns');
    bullets.push('No heavy lift fatigue');
    return bullets;
  }

  for (const p of penalties.sort((a, b) => b.points - a.points).slice(0, 4)) {
    if (p.category === 'recovery_window') {
      bullets.push('Recovery window active');
    } else if (p.category === 'systemic_fatigue') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') {
        bullets.push(`Load ratio ${ratio.toFixed(2)}x`);
      } else {
        bullets.push('Training load elevated');
      }
    } else if (p.category === 'load_management') {
      const ratio = rawMetrics.rolling_strain_ratio;
      if (typeof ratio === 'number') {
        bullets.push(`Load ratio ${ratio.toFixed(2)}x`);
      } else {
        bullets.push('Training load elevated');
      }
    } else if (p.category === 'override_behavior') {
      const count = rawMetrics.overrides_14d ?? rawMetrics.overrides_7d;
      if (typeof count === 'number') {
        bullets.push(`${count} recent rest overrides`);
      } else {
        bullets.push('Recent rest day overrides');
      }
    } else {
      bullets.push(p.reason);
    }
  }

  const capacity = rawMetrics.capacity_score;
  if (typeof capacity === 'number' && !bullets.some((b) => b.includes('Recovery'))) {
    bullets.push(`Recovery at ${Math.round(capacity * 100)}%`);
  }

  return bullets;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [state, setState] = useState<ReadinessState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [projections, setProjections] = useState<ProjectionDay[]>([]);
  const [todayPlan, setTodayPlan] = useState<PlanDayData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState<CheckInData | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const serverData = await apiCached<CoachingTodayResponse>('/api/coaching/today', 'cache_coaching_today');
      const mapped = mapServerToReadinessState(serverData);
      setState(mapped);
      setLoaded(true);
    } catch {
      try {
        const local = await loadLatestEvaluation();
        setState(local);
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    }
  }, []);

  const fetchProjections = useCallback(async () => {
    try {
      const body = await apiCached<ProjectionsResponse>('/api/coaching/projections', 'cache_projections');
      setProjections(body.projections);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchTodayPlan = useCallback(async () => {
    try {
      const body = await apiCached<CurrentPlanResponse>('/api/plans/current', 'cache_plans_current');
      const today = body.week?.find((d) => d.today);
      setTodayPlan(today ?? null);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchRecentWorkouts = useCallback(async () => {
    try {
      const [result] = await executeSql(
        `SELECT coaching_mode AS mode, actual_stress, completed_at FROM workout_logs
         WHERE status = 'completed'
         ORDER BY completed_at DESC LIMIT 3;`
      );
      const workouts: RecentWorkout[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        workouts.push({
          mode: row.mode,
          stress: Math.round(row.actual_stress),
          completedAt: row.completed_at,
        });
      }
      setRecentWorkouts(workouts);
    } catch {
      // non-fatal
    }
  }, []);

  const checkDailyCheckIn = useCallback(async () => {
    try {
      const lastDate = await getMeta('last_checkin_date');
      if (shouldShowCheckIn(lastDate)) {
        setShowCheckIn(true);
      } else {
        const existing = await getLastCheckIn();
        setCheckInState(existing);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      fetchProjections();
      fetchTodayPlan();
      fetchRecentWorkouts();
      checkDailyCheckIn();
    }, [loadDashboard, fetchProjections, fetchTodayPlan, fetchRecentWorkouts, checkDailyCheckIn])
  );

  const handleCheckInSubmit = useCallback(async (data: CheckInData) => {
    await saveCheckIn(data);
    setCheckInState(data);
    setShowCheckIn(false);
    loadDashboard();
  }, [loadDashboard]);

  const handleCheckInSkip = useCallback(() => {
    setShowCheckIn(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const freshData = await triggerManualEvaluation();
      setState({ data: freshData, isStale: false });
    } catch {
      // non-fatal
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  if (!loaded) return <View style={styles.root} />;

  const data = state?.data ?? null;

  if (!data || data.score == null || !data.band || !data.caps) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Text style={styles.welcomeTitle}>ATTUNEDD</Text>
        <Text style={styles.welcomeMessage}>
          Complete your first workout to see your readiness score and coaching.
        </Text>
        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={refreshing}>
          <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const accent = BAND_COLORS[data.band] ?? '#888888';
  const bandLabel = BAND_LABELS[data.band] ?? data.band.toUpperCase();

  const explanation = buildExplanation({
    score: data.score,
    band: data.band,
    penalties: data.penalties,
    rawMetrics: data.rawMetrics,
    caps: data.caps,
  });

  const headline = buildHeadline(data.coaching, explanation, data.penalties, data.rawMetrics, checkInState);
  const whyBullets = buildWhyBullets(data.penalties, data.rawMetrics);
  const checkInBullets = checkInState ? getCheckInContext(checkInState) : [];
  const isHighRisk = data.band === 'high_risk' || data.band === 'red';
  const hasPendingSession = todayPlan && !todayPlan.rest_day && todayPlan.workout_status !== 'completed';
  const showTrainCTA = hasPendingSession && !showCheckIn && !isHighRisk;

  return (
    <>
    <DailyCheckIn
      visible={showCheckIn}
      onSubmit={handleCheckInSubmit}
      onSkip={handleCheckInSkip}
    />
    <ScrollView
      style={styles.scrollRoot}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 }]}
    >
      {/* 1. Coaching Headline — primary, dominant */}
      <Text style={[styles.headline, { color: accent }]}>{headline}</Text>

      {/* 2. Readiness Score + Band */}
      <Text style={[styles.score, { color: accent }]}>{data.score}</Text>
      <Text style={[styles.bandLabel, { color: accent }]}>{bandLabel}</Text>

      {/* 3. Dynamic Action Block — one visible at a time */}
      {isHighRisk ? (
        <View style={styles.actionBlock}>
          <Text style={styles.actionHeading}>Recovery day recommended</Text>
          <Text style={styles.actionSubtext}>
            {explanation.decisionLine}
          </Text>
          {todayPlan && (
            <Pressable
              onPress={() => navigation.navigate('Train', { screen: 'PlanDetail' })}
              style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>View plan</Text>
            </Pressable>
          )}
        </View>
      ) : todayPlan ? (
        <TodayPlanCard
          day={todayPlan}
          caps={data.caps}
          showCTA={!!showTrainCTA}
          onStartWorkout={() => navigation.navigate('Train', { screen: 'TrainHome' })}
          onViewPlan={() => navigation.navigate('Train', { screen: 'PlanDetail' })}
        />
      ) : projections.length > 0 ? (
        <ProjectionsSection projections={projections} />
      ) : null}

      {/* 4. Train Today CTA — only when not competing with check-in/recovery */}
      {showTrainCTA && !todayPlan && (
        <Pressable
          onPress={() => navigation.navigate('Train', { screen: 'TrainHome' })}
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}>
          <Text style={styles.startBtnText}>Train today</Text>
        </Pressable>
      )}

      {/* 5. Context — merged recovery context + insights, secondary */}
      {(whyBullets.length > 0 || checkInBullets.length > 0 ||
        (data.coaching?.nudges && data.coaching.nudges.length > 0)) && (
        <View style={styles.contextSection}>
          {whyBullets.map((bullet, i) => (
            <Text key={`p-${i}`} style={styles.contextBullet}>{'\u2022'} {bullet}</Text>
          ))}
          {checkInBullets.map((bullet, i) => (
            <Text key={`c-${i}`} style={styles.contextBulletHighlight}>{'\u2022'} {bullet}</Text>
          ))}
          {data.coaching?.nudges?.map((nudge, i) => (
            <Text key={`n-${i}`} style={styles.contextBullet}>{'\u2022'} {nudge}</Text>
          ))}
        </View>
      )}

      {/* Coming up — simplified projections (only if not already shown in action block) */}
      {projections.length > 0 && todayPlan && (
        <ProjectionsSection projections={projections} />
      )}

      {/* Recent sessions */}
      {recentWorkouts.length > 0 && (
        <RecentWorkoutsSection
          workouts={recentWorkouts}
          onViewAll={() => navigation.navigate('Train', { screen: 'WorkoutHistory' })}
        />
      )}

      <Pressable
        onPress={handleRefresh}
        style={styles.refreshButton}
        disabled={refreshing}>
        <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Text>
      </Pressable>
    </ScrollView>
    </>
  );
}

function TodayPlanCard({
  day,
  caps,
  showCTA,
  onStartWorkout,
  onViewPlan,
}: {
  day: PlanDayData;
  caps: ParsedCaps;
  showCTA: boolean;
  onStartWorkout: () => void;
  onViewPlan: () => void;
}) {
  const sessionLabel = day.session_type.replace(/_/g, ' ');
  const sessionTitle = sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1);
  const mainBlock = day.blocks.find((b) => b.name === 'Main');
  const mainExercises = mainBlock?.exercises?.filter((e) => e.sets) ?? [];
  const primaryMuscles = mainExercises
    .map((e) => e.name)
    .slice(0, 3)
    .join(', ');

  if (day.rest_day) {
    return (
      <Pressable style={styles.todayCard} onPress={onViewPlan}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayType}>Rest day</Text>
        {day.rationale ? (
          <Text style={styles.todayContext}>{day.rationale}</Text>
        ) : (
          <Text style={styles.todayContext}>Recovery priority scheduled.</Text>
        )}
      </Pressable>
    );
  }

  if (day.workout_status === 'completed') {
    return (
      <Pressable style={styles.todayCard} onPress={onViewPlan}>
        <Text style={styles.todayLabel}>Today</Text>
        <Text style={styles.todayType}>{sessionTitle}</Text>
        <Text style={styles.todayCompleted}>Completed</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.todayCard} onPress={onViewPlan}>
      <Text style={styles.todayLabel}>Today</Text>
      <Text style={styles.todayType}>{sessionTitle}</Text>
      {day.rationale ? (
        <Text style={styles.todayRationale}>{day.rationale}</Text>
      ) : null}
      {primaryMuscles ? (
        <Text style={styles.todayMuscles}>{primaryMuscles}</Text>
      ) : null}
      {caps.maxStressPct < 100 && (
        <Text style={styles.todayCap}>Intensity capped at {caps.maxStressPct}%</Text>
      )}
      {showCTA && (
        <Pressable
          onPress={onStartWorkout}
          style={({ pressed }) => [
            styles.startBtn,
            pressed && styles.startBtnPressed,
          ]}>
          <Text style={styles.startBtnText}>Train today</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function RecentWorkoutsSection({
  workouts,
  onViewAll,
}: {
  workouts: RecentWorkout[];
  onViewAll: () => void;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onViewAll} style={styles.recentHeader}>
        <Text style={styles.sectionLabel}>Recent</Text>
        <Text style={styles.viewAllText}>View all</Text>
      </Pressable>
      {workouts.map((w, i) => {
        const d = new Date(w.completedAt);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const modeLabel = (w.mode ?? 'workout').replace(/_/g, ' ');
        return (
          <View key={i} style={styles.recentRow}>
            <Text style={styles.recentDate}>{dateStr}</Text>
            <Text style={styles.recentMode}>{modeLabel}</Text>
            <Text style={styles.recentStress}>{w.stress}</Text>
          </View>
        );
      })}
    </View>
  );
}

function formatProjectionDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[d.getDay()];
}

function ProjectionsSection({
  projections,
}: {
  projections: ProjectionDay[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Coming up</Text>
      {projections.map((p) => {
        const sessionType = p.session_type.replace(/_/g, ' ');
        const sessionTitle = sessionType.charAt(0).toUpperCase() + sessionType.slice(1);

        let detail: string | null = null;
        if (p.rest_reason) {
          detail = p.rest_reason;
        } else if (p.primary_muscles.length > 0) {
          detail = p.primary_muscles.map((m) => m.replace(/_/g, ' ')).join(', ');
        }

        return (
          <View key={p.date} style={styles.projectionDay}>
            <Text style={styles.projectionDate}>
              {formatProjectionDate(p.date)} {'\u2014'} {sessionTitle}
            </Text>
            {detail && (
              <Text style={styles.projectionMetric}>{detail}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollRoot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeTitle: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 6,
    marginTop: 160,
    marginBottom: 24,
    fontFamily: MONO,
  },
  welcomeMessage: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  // 1. Coaching headline — dominant element
  headline: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  // 2. Score + band
  score: {
    fontSize: 56,
    fontWeight: '200',
    fontFamily: MONO,
    letterSpacing: 2,
    marginBottom: 6,
  },
  bandLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 5,
    marginBottom: 32,
  },
  // 3. Dynamic action block
  actionBlock: {
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 4,
    marginBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    alignItems: 'center',
  },
  actionHeading: {
    color: '#E74C3C',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionSubtext: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  secondaryBtnText: {
    color: '#888888',
    fontSize: 13,
    letterSpacing: 1,
  },
  // 5. Context section — merged recovery + insights
  contextSection: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    paddingTop: 20,
    marginBottom: 24,
  },
  contextBullet: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 22,
    paddingLeft: 4,
  },
  contextBulletHighlight: {
    color: '#F1C40F',
    fontSize: 13,
    lineHeight: 22,
    paddingLeft: 4,
  },
  // Sections
  section: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    paddingTop: 24,
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 16,
  },
  // Today's plan
  todayCard: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 4,
    marginBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
  },
  todayLabel: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 10,
  },
  todayType: {
    color: '#EAEAEA',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  todayContext: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
  },
  todayRationale: {
    color: '#999999',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  todayMuscles: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 6,
  },
  todayCap: {
    color: '#F1C40F',
    fontSize: 12,
    fontFamily: MONO,
    marginBottom: 8,
  },
  todayCompleted: {
    color: '#2ECC71',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  startBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2ECC71',
  },
  startBtnPressed: {
    backgroundColor: '#27AE60',
  },
  startBtnText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Recent workouts
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    color: '#555555',
    fontSize: 11,
    letterSpacing: 1,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  recentDate: {
    color: '#888888',
    fontSize: 12,
    fontFamily: MONO,
    width: 40,
  },
  recentMode: {
    color: '#CCCCCC',
    fontSize: 13,
    flex: 1,
  },
  recentStress: {
    color: '#888888',
    fontSize: 12,
    fontFamily: MONO,
  },
  // Projections
  projectionDay: {
    marginBottom: 16,
  },
  projectionDate: {
    color: '#CCCCCC',
    fontSize: 13,
    fontWeight: '500',
  },
  projectionMetric: {
    color: '#666666',
    fontSize: 12,
    marginTop: 4,
  },
  // Refresh
  refreshButton: {
    marginTop: 32,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  refreshText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: MONO,
  },
  refreshing: {
    color: '#333333',
  },
});
