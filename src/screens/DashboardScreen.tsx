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
import {
  buildExplanation,
  type ExplanationOutput,
  type PenaltyRow,
  type LimitRow,
} from '../services/explanationEngine';
import { apiCached } from '../services/apiClient';
import { deriveCaps } from '../state/evaluationEngine';
import { executeSql } from '../db/database';
import InfoChip from '../components/InfoChip';
import type { RootTabParamList } from '../navigation/types';
import type {
  CoachingTodayResponse,
  ProjectionDay,
  HeavySessionSimulation,
  ProjectionsResponse,
  CurrentPlanResponse,
  PlanDayData,
  PlanExercise,
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

const TONE_COLORS: Record<string, string> = {
  encouraging: '#2ECC71',
  cautionary: '#F1C40F',
  protective: '#E74C3C',
  neutral: '#888888',
};

const BAND_LABELS: Record<string, string> = {
  green: 'OPTIMAL',
  yellow: 'SUBOPTIMAL',
  red: 'HIGH RISK',
  optimal: 'OPTIMAL',
  suboptimal: 'SUBOPTIMAL',
  high_risk: 'HIGH RISK',
};

function formatTimestamp(ts: number | null): string {
  if (ts == null || ts <= 0) return '—';
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}  ${hours}:${minutes}`;
}

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

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const [state, setState] = useState<ReadinessState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [projections, setProjections] = useState<ProjectionDay[]>([]);
  const [heavySim, setHeavySim] = useState<HeavySessionSimulation | null>(null);
  const [isWelcome, setIsWelcome] = useState(false);
  const [todayPlan, setTodayPlan] = useState<PlanDayData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      // Try server first
      const serverData = await apiCached<CoachingTodayResponse>('/api/coaching/today', 'cache_coaching_today');
      const mapped = mapServerToReadinessState(serverData);
      setState(mapped);
      // Welcome state: server returned data but no penalties (new user)
      setIsWelcome(serverData.penalties.length === 0);
      setLoaded(true);
    } catch {
      // Fall back to local evaluation
      try {
        const local = await loadLatestEvaluation();
        setState(local);
        setIsWelcome(false);
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
      setHeavySim(body.heavy_session_simulation);
    } catch {
      // projection fetch failure is non-fatal
    }
  }, []);

  const fetchTodayPlan = useCallback(async () => {
    try {
      const body = await apiCached<CurrentPlanResponse>('/api/plans/current', 'cache_plans_current');
      const today = body.week?.find((d) => d.today);
      setTodayPlan(today ?? null);
    } catch {
      // plan fetch failure is non-fatal
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

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      fetchProjections();
      fetchTodayPlan();
      fetchRecentWorkouts();
    }, [loadDashboard, fetchProjections, fetchTodayPlan, fetchRecentWorkouts])
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const freshData = await triggerManualEvaluation();
      setState({ data: freshData, isStale: false });
      setIsWelcome(false);
    } catch {
      // refresh failure is non-fatal
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
          Complete your first workout to see your readiness score and coaching insights
        </Text>
        <Pressable
          onPress={handleRefresh}
          style={styles.refreshButton}
          disabled={refreshing}>
          <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
            {refreshing ? 'REFRESHING' : 'REFRESH'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const coaching = data.coaching;
  const accent = coaching?.tone
    ? (TONE_COLORS[coaching.tone] ?? BAND_COLORS[data.band] ?? '#888888')
    : (BAND_COLORS[data.band] ?? '#888888');
  const bandLabel = BAND_LABELS[data.band] ?? data.band.toUpperCase();

  const explanation = buildExplanation({
    score: data.score,
    band: data.band,
    penalties: data.penalties,
    rawMetrics: data.rawMetrics,
    caps: data.caps,
  });

  // Use server coaching headline when available, fall back to local explanation
  const headline = coaching?.headline ?? explanation.decisionLine;

  return (
    <ScrollView
      style={styles.scrollRoot}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
    >
      {/* Coach Section — the primary AI-driven experience */}
      <Text style={styles.coachLabel}>YOUR COACH</Text>
      <InfoChip topic="adaptation_score" color={accent}>
        <Text style={[styles.score, { color: accent }]}>{data.score}</Text>
      </InfoChip>
      <Text style={styles.scoreExplainer}>
        READINESS SCORE
      </Text>
      <Text style={styles.scoreDetail}>
        {data.score >= 80
          ? 'You\'re well recovered. Push hard today.'
          : data.score >= 60
          ? 'Moderate recovery. Train smart, respect the caps.'
          : data.score >= 40
          ? 'Under-recovered. Keep it light or rest.'
          : 'Significantly fatigued. Rest recommended.'}
      </Text>
      <View style={styles.bandRow}>
        <InfoChip topic="risk_band" color={accent}>
          <Text style={[styles.bandLabel, { color: accent }]}>{bandLabel}</Text>
        </InfoChip>
      </View>
      <Text style={styles.decisionLine}>{headline}</Text>
      <Text style={styles.coachAttribution}>
        AI analysis based on your training history, recovery data, and goals
      </Text>

      {/* Score breakdown hint */}
      <Text style={styles.scoreBreakdownHint}>
        Score = 100 minus recovery penalties. Tap the score to learn more.
      </Text>

      {isWelcome && (
        <Text style={styles.welcomeHint}>
          Complete your first workout to see detailed coaching insights
        </Text>
      )}

      {/* Coaching insights — nudges and positive notes prominently */}
      {coaching?.positive_notes && coaching.positive_notes.length > 0 ? (
        <PositiveNotesSection notes={coaching.positive_notes} />
      ) : null}

      {coaching?.nudges && coaching.nudges.length > 0 ? (
        <View style={styles.coachingInsights}>
          <Text style={styles.insightsHeader}>COACH INSIGHTS</Text>
          {coaching.nudges.map((nudge, i) => (
            <Text key={i} style={styles.insightText}>{nudge}</Text>
          ))}
        </View>
      ) : null}

      {todayPlan && (
        <TodayPlanCard
          day={todayPlan}
          onStartWorkout={() => navigation.navigate('Train', { screen: 'TrainHome' })}
          onViewPlan={() => navigation.navigate('Train', { screen: 'PlanDetail' })}
        />
      )}

      {recentWorkouts.length > 0 && (
        <RecentWorkoutsSection
          workouts={recentWorkouts}
          onViewAll={() => navigation.navigate('Train', { screen: 'WorkoutHistory' })}
        />
      )}

      {!isWelcome && explanation.hasServerData ? (
        <WhyTodaySection explanation={explanation} score={data.score} />
      ) : !isWelcome && data.source === 'local' ? (
        <Text style={styles.syncHint}>Full analysis available after sync</Text>
      ) : null}

      {!isWelcome && <SessionLimitsSection limits={explanation.sessionLimits} />}

      {projections.length > 0 && (
        <ProjectionsSection projections={projections} heavySim={heavySim} />
      )}

      <Text style={styles.timestamp}>{formatTimestamp(data.timestamp)}</Text>

      <Pressable
        onPress={handleRefresh}
        style={styles.refreshButton}
        disabled={refreshing}>
        <Text style={[styles.refreshText, refreshing && styles.refreshing]}>
          {refreshing ? 'REFRESHING' : 'REFRESH'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function PositiveNotesSection({ notes }: { notes: string[] }) {
  return (
    <View style={styles.positiveContainer}>
      {notes.map((note, i) => (
        <Text key={i} style={styles.positiveText}>{note}</Text>
      ))}
    </View>
  );
}

function WhyTodaySection({ explanation, score }: { explanation: ExplanationOutput; score: number }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>WHY THIS SCORE</Text>
      {explanation.penaltyBreakdown.map((row, i) => (
        <PenaltyRowView key={i} row={row} />
      ))}
      <Text style={styles.totalLine}>
        (total: -{explanation.totalDeducted} from 100)
      </Text>
    </View>
  );
}

function PenaltyRowView({ row }: { row: PenaltyRow }) {
  return (
    <View style={styles.penaltyRow}>
      <View style={styles.penaltyHeader}>
        <Text style={styles.penaltyIcon}>{row.icon}</Text>
        <Text style={styles.penaltyCategory}>{row.category}</Text>
        <Text style={styles.penaltyPoints}>-{row.points}</Text>
      </View>
      <Text style={styles.penaltyDescription}>{row.description}</Text>
    </View>
  );
}

function SessionLimitsSection({ limits }: { limits: LimitRow[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>SESSION LIMITS</Text>
      {limits.map((limit, i) => (
        <View key={i} style={styles.capsRow}>
          <Text style={styles.capsLabel}>{limit.label}</Text>
          <Text style={[styles.capsValue, limit.restricted && styles.capsRestricted]}>
            {limit.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TodayPlanCard({
  day,
  onStartWorkout,
  onViewPlan,
}: {
  day: PlanDayData;
  onStartWorkout: () => void;
  onViewPlan: () => void;
}) {
  const sessionLabel = day.session_type.replace(/_/g, ' ').toUpperCase();
  const mainBlock = day.blocks.find((b) => b.name === 'Main');
  const mainExercises = mainBlock?.exercises?.filter((e) => e.sets) ?? [];

  if (day.rest_day) {
    return (
      <Pressable style={styles.todayCard} onPress={onViewPlan}>
        <Text style={styles.todayHeader}>AI-GENERATED PLAN</Text>
        <Text style={styles.todaySessionType}>REST DAY</Text>
        {day.rationale ? (
          <Text style={styles.todayRationale}>{day.rationale}</Text>
        ) : null}
        <Text style={styles.viewPlanHint}>TAP FOR FULL PLAN</Text>
      </Pressable>
    );
  }

  if (day.workout_status === 'completed') {
    return (
      <Pressable style={styles.todayCard} onPress={onViewPlan}>
        <Text style={styles.todayHeader}>AI-GENERATED PLAN</Text>
        <Text style={styles.todaySessionType}>{sessionLabel}</Text>
        <Text style={styles.todayCompleted}>COMPLETED</Text>
        <Text style={styles.viewPlanHint}>TAP FOR FULL PLAN</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.todayCard} onPress={onViewPlan}>
      <Text style={styles.todayHeader}>AI-GENERATED PLAN</Text>
      <Text style={styles.todaySessionType}>{sessionLabel}</Text>
      {day.rationale ? (
        <Text style={styles.todayRationaleProminent}>{day.rationale}</Text>
      ) : null}
      {mainExercises.slice(0, 4).map((ex, i) => (
        <Text key={i} style={styles.todayExercise}>
          {ex.name}
          {ex.sets && ex.rep_range ? `  ${ex.sets}\u00D7${ex.rep_range}` : ''}
        </Text>
      ))}
      {mainExercises.length > 4 && (
        <Text style={styles.todayMore}>+{mainExercises.length - 4} more</Text>
      )}
      <Pressable
        onPress={onStartWorkout}
        style={({ pressed }) => [
          styles.startBtn,
          pressed && styles.startBtnPressed,
        ]}>
        <Text style={styles.startBtnText}>START WORKOUT</Text>
      </Pressable>
      <Text style={styles.viewPlanHint}>TAP CARD FOR FULL PLAN DETAILS</Text>
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
        <Text style={styles.sectionHeader}>RECENT WORKOUTS</Text>
        <Text style={styles.viewAllText}>VIEW ALL</Text>
      </Pressable>
      {workouts.map((w, i) => {
        const d = new Date(w.completedAt);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const modeLabel = (w.mode ?? 'workout').replace(/_/g, ' ').toUpperCase();
        return (
          <View key={i} style={styles.recentRow}>
            <Text style={styles.recentDate}>{dateStr}</Text>
            <Text style={styles.recentMode}>{modeLabel}</Text>
            <Text style={styles.recentStress}>{w.stress} stress</Text>
          </View>
        );
      })}
    </View>
  );
}

const MODE_COLORS: Record<string, string> = {
  push: '#2ECC71',
  maintain: '#888888',
  fatigue_management: '#F1C40F',
};

function formatProjectionDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatSessionType(type: string): string {
  return type.replace(/_/g, ' ').toUpperCase();
}

function ProjectionsSection({
  projections,
  heavySim,
}: {
  projections: ProjectionDay[];
  heavySim: HeavySessionSimulation | null;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>NEXT 2 DAYS</Text>
      {projections.map((p) => (
        <View key={p.date} style={styles.projectionDay}>
          <View style={styles.projectionHeader}>
            <Text style={styles.projectionDate}>{formatProjectionDate(p.date)}</Text>
            <Text style={[styles.projectionMode, { color: MODE_COLORS[p.coaching_mode] ?? '#888888' }]}>
              {p.coaching_mode.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.projectionType}>
            {formatSessionType(p.session_type)}
          </Text>
          {p.rest_reason ? (
            <Text style={styles.projectionRest}>{p.rest_reason}</Text>
          ) : p.primary_muscles.length > 0 ? (
            <Text style={styles.projectionMuscles}>
              {p.primary_muscles.map((m) => m.replace(/_/g, ' ')).join(', ')}
            </Text>
          ) : null}
        </View>
      ))}
      {heavySim && (
        <View style={styles.simBlock}>
          <Text style={styles.simLabel}>HEAVY SESSION IMPACT</Text>
          <View style={styles.simRow}>
            <Text style={styles.simMetric}>STRAIN RATIO</Text>
            <Text style={styles.simValue}>
              {heavySim.current_strain_ratio} → {heavySim.projected_strain_ratio}
            </Text>
          </View>
          {heavySim.warning && (
            <Text style={styles.simWarning}>{heavySim.warning}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

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
  welcomeHint: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  pending: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 200,
    fontFamily: MONO,
  },
  score: {
    fontSize: 64,
    fontWeight: '200',
    fontFamily: MONO,
    letterSpacing: 2,
    marginBottom: 4,
  },
  bandLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 12,
  },
  decisionLine: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  coachLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 12,
    fontFamily: MONO,
  },
  scoreExplainer: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 4,
    marginBottom: 8,
    fontFamily: MONO,
  },
  scoreDetail: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  scoreBreakdownHint: {
    color: '#333333',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 24,
  },
  coachAttribution: {
    color: '#444444',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  coachingInsights: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#222244',
    backgroundColor: '#0A0A14',
    padding: 16,
    marginBottom: 24,
  },
  insightsHeader: {
    color: '#6666AA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 10,
    fontFamily: MONO,
  },
  insightText: {
    color: '#9999CC',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    paddingLeft: 8,
  },
  positiveContainer: {
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  positiveText: {
    color: '#2ECC71',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
    paddingLeft: 12,
  },
  syncHint: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  section: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222222',
    paddingTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 16,
  },
  penaltyRow: {
    marginBottom: 16,
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  penaltyIcon: {
    color: '#888888',
    fontSize: 14,
    width: 20,
  },
  penaltyCategory: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  penaltyPoints: {
    color: '#E74C3C',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: MONO,
  },
  penaltyDescription: {
    color: '#888888',
    fontSize: 12,
    marginLeft: 20,
    lineHeight: 16,
  },
  totalLine: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  capsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  capsLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
  },
  capsValue: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: MONO,
  },
  capsRestricted: {
    color: '#F1C40F',
  },
  timestamp: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    marginTop: 32,
    letterSpacing: 1,
  },
  refreshButton: {
    marginTop: 24,
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
  projectionDay: {
    marginBottom: 16,
  },
  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectionDate: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  projectionMode: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  projectionType: {
    color: '#CCCCCC',
    fontSize: 13,
    fontFamily: MONO,
    marginBottom: 2,
  },
  projectionRest: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 16,
  },
  projectionMuscles: {
    color: '#555555',
    fontSize: 11,
    letterSpacing: 1,
  },
  simBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#222222',
    paddingTop: 12,
    marginTop: 4,
  },
  simLabel: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  simRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  simMetric: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
  },
  simValue: {
    color: '#EAEAEA',
    fontSize: 12,
    fontFamily: MONO,
  },
  simWarning: {
    color: '#F1C40F',
    fontSize: 11,
    marginTop: 6,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  recentDate: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
    width: 40,
  },
  recentMode: {
    color: '#CCCCCC',
    fontSize: 12,
    flex: 1,
  },
  recentStress: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
  },
  bandRow: {
    marginBottom: 12,
  },
  todayCard: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#222222',
    padding: 16,
    marginBottom: 24,
  },
  todayHeader: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 8,
    fontFamily: MONO,
  },
  todaySessionType: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  todayRationale: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  todayRationaleProminent: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
    fontStyle: 'italic',
    borderLeftWidth: 2,
    borderLeftColor: '#2ECC71',
    paddingLeft: 12,
  },
  todayExercise: {
    color: '#CCCCCC',
    fontSize: 12,
    fontFamily: MONO,
    paddingVertical: 4,
  },
  todayMore: {
    color: '#555555',
    fontSize: 11,
    fontFamily: MONO,
    marginTop: 4,
    marginBottom: 8,
  },
  todayCompleted: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  startBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2ECC71',
  },
  startBtnPressed: {
    backgroundColor: '#0D1A0D',
  },
  startBtnText: {
    color: '#2ECC71',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  viewPlanHint: {
    color: '#444444',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
    textAlign: 'center',
    marginTop: 12,
  },
});
