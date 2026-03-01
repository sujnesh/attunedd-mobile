import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../services/apiClient';
import { executeSql } from '../../db/database';
import type { WorkoutHistoryEntry, WorkoutHistoryResponse } from '../../types/api';
import type { WorkoutHistoryProps } from '../../navigation/types';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

async function fetchLocalWorkouts(): Promise<WorkoutHistoryEntry[]> {
  const [logResult] = await executeSql(
    `SELECT local_id, server_id, coaching_mode, actual_stress, allowed_stress,
            started_at, completed_at
     FROM workout_logs WHERE status = 'completed'
     ORDER BY completed_at DESC LIMIT 20;`
  );
  const entries: WorkoutHistoryEntry[] = [];
  for (let i = 0; i < logResult.rows.length; i++) {
    const row = logResult.rows.item(i);
    const [setResult] = await executeSql(
      `SELECT exercise_name, set_number, weight, reps, rpe, stress_units
       FROM exercise_sets WHERE workout_log_local_id = ?
       ORDER BY local_id;`,
      [row.local_id]
    );
    const sets: WorkoutHistoryEntry['exercise_sets'] = [];
    for (let j = 0; j < setResult.rows.length; j++) {
      const s = setResult.rows.item(j);
      sets.push({
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        stress_units: s.stress_units,
        cap_override: false,
      });
    }
    entries.push({
      id: row.server_id ? Number(row.server_id) : row.local_id,
      status: 'completed',
      coaching_mode: row.coaching_mode,
      actual_stress: row.actual_stress,
      allowed_stress: row.allowed_stress,
      started_at: row.started_at,
      completed_at: row.completed_at,
      risk_band: null,
      exercise_sets: sets,
    });
  }
  return entries;
}

export default function WorkoutHistoryScreen({ navigation }: WorkoutHistoryProps) {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    const body = await api<WorkoutHistoryResponse>(`/api/workout_logs?page=${p}`);
    return body;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Try server first
        const body = await fetchPage(1);
        if (body.workouts.length > 0) {
          setWorkouts(body.workouts);
          setHasMore(body.has_more);
          setPage(1);
        } else {
          // Server returned empty — check local database
          const local = await fetchLocalWorkouts();
          setWorkouts(local);
          setHasMore(false);
        }
      } catch {
        // Server unreachable — fall back to local database
        try {
          const local = await fetchLocalWorkouts();
          setWorkouts(local);
          setHasMore(false);
        } catch {
          // no data available
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchPage]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const body = await fetchPage(nextPage);
      setWorkouts(prev => [...prev, ...body.workouts]);
      setHasMore(body.has_more);
      setPage(nextPage);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const renderWorkout = ({ item }: { item: WorkoutHistoryEntry }) => {
    const exercises = groupExercises(item.exercise_sets);
    const date = item.completed_at ? formatDate(item.completed_at) : '—';
    const stressPct = item.allowed_stress && item.allowed_stress > 0
      ? Math.round(((item.actual_stress ?? 0) / item.allowed_stress) * 100)
      : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>{date}</Text>
          <View style={styles.cardMeta}>
            {item.coaching_mode && (
              <Text style={styles.cardMode}>{item.coaching_mode.toUpperCase()}</Text>
            )}
            {item.risk_band && (
              <Text style={[styles.cardBand, bandColor(item.risk_band)]}>
                {item.risk_band.toUpperCase()}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.stressRow}>
          <Text style={styles.stressLabel}>STRESS</Text>
          <Text style={styles.stressNum}>
            {Math.round(item.actual_stress ?? 0)}
            {item.allowed_stress != null && item.allowed_stress > 0 && (
              <Text style={styles.stressDenom}> / {Math.round(item.allowed_stress)}</Text>
            )}
          </Text>
          {stressPct != null && (
            <Text style={styles.stressPctText}>{stressPct}%</Text>
          )}
        </View>
        {exercises.map(([name, sets]) => (
          <View key={name} style={styles.exerciseRow}>
            <Text style={styles.exerciseName}>{name}</Text>
            <Text style={styles.exerciseSummary}>
              {sets.length} set{sets.length !== 1 ? 's' : ''}
              {bestSet(sets)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'} BACK</Text>
        </Pressable>
        <Text style={styles.headerTitle}>HISTORY</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#555555" />
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No completed workouts yet</Text>
        </View>
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderWorkout}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#555555" style={styles.footer} /> : null
          }
        />
      )}
    </View>
  );
}

function groupExercises(
  sets: WorkoutHistoryEntry['exercise_sets'],
): [string, WorkoutHistoryEntry['exercise_sets']][] {
  const map = new Map<string, WorkoutHistoryEntry['exercise_sets']>();
  for (const s of sets) {
    const group = map.get(s.exercise_name) ?? [];
    group.push(s);
    map.set(s.exercise_name, group);
  }
  return Array.from(map.entries());
}

function bestSet(sets: WorkoutHistoryEntry['exercise_sets']): string {
  const withWeight = sets.filter(s => s.weight != null && s.weight > 0);
  if (withWeight.length === 0) return '';
  const top = withWeight.reduce((a, b) => ((a.weight ?? 0) > (b.weight ?? 0) ? a : b));
  const rir = top.rpe != null ? 10 - top.rpe : null;
  return ` — ${top.weight}x${top.reps}${rir != null ? ` r${rir}` : ''}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function bandColor(band: string) {
  switch (band) {
    case 'green': return { color: '#2ECC71' };
    case 'yellow': return { color: '#F1C40F' };
    case 'red': return { color: '#E74C3C' };
    default: return { color: '#888888' };
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
  },
  backBtn: {
    width: 80,
  },
  backText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerTitle: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#333333',
    fontSize: 13,
    fontFamily: MONO,
  },
  list: {
    padding: 16,
  },
  card: {
    borderWidth: 0.5,
    borderColor: '#222222',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONO,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  cardMode: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardBand: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A1A',
  },
  stressLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  stressNum: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '200',
    fontFamily: MONO,
  },
  stressDenom: {
    color: '#555555',
    fontSize: 12,
  },
  stressPctText: {
    color: '#888888',
    fontSize: 11,
    fontFamily: MONO,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  exerciseName: {
    color: '#AAAAAA',
    fontSize: 11,
    fontFamily: MONO,
    flex: 1,
  },
  exerciseSummary: {
    color: '#555555',
    fontSize: 10,
    fontFamily: MONO,
  },
  footer: {
    paddingVertical: 20,
  },
});
