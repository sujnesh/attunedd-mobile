import React, { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getRecentActivities, type ActivityRow } from '../services/healthService';
import { getMeta } from '../services/metaStateService';
import { apiCached } from '../services/apiClient';
import type { WhoopRecentResponse, WhoopCycleData, WhoopSleepData } from '../types/api';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const ZONE_LABELS: Record<number, string> = {
  1: 'Z1',
  2: 'Z2',
  3: 'Z3',
  4: 'Z4',
  5: 'Z5',
};

function recoveryColor(score: number): string {
  if (score >= 67) return '#2ECC71';
  if (score >= 34) return '#F1C40F';
  return '#E74C3C';
}

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cycles, setCycles] = useState<WhoopCycleData[]>([]);
  const [sleepData, setSleepData] = useState<WhoopSleepData[]>([]);

  const load = useCallback(async () => {
    try {
      const [acts, syncTs] = await Promise.all([
        getRecentActivities(50),
        getMeta('last_sync_at'),
      ]);
      setActivities(acts);
      setLastSync(syncTs);

      // Fetch WHOOP recovery data (non-blocking)
      try {
        const whoop = await apiCached<WhoopRecentResponse>('/api/whoop/recent', 'cache_whoop_recent');
        setCycles(whoop.cycles);
        setSleepData(whoop.sleep);
      } catch {
        // Not connected or no data — fine
      }
    } catch {
      // DB or meta read failed — still show screen with empty state
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!loaded) return <View style={styles.root} />;

  const todayCycle = cycles.length > 0 ? cycles[0] : null;
  const lastSleep = sleepData.length > 0 ? sleepData[0] : null;
  const hasWhoopData = cycles.length > 0 || sleepData.length > 0;
  const hasActivities = activities.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
      <Text style={styles.title}>HEALTH</Text>

      {lastSync && (
        <Text style={styles.syncTs}>Last sync: {formatDate(lastSync)}</Text>
      )}

      <ScrollView style={styles.list}>
        {/* Recovery Section */}
        {todayCycle && todayCycle.recovery_score != null && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>RECOVERY</Text>
            <Text style={[styles.recoveryScore, { color: recoveryColor(todayCycle.recovery_score) }]}>
              {todayCycle.recovery_score}%
            </Text>
            <View style={styles.metricsRow}>
              {todayCycle.hrv_rmssd != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{todayCycle.hrv_rmssd}</Text>
                  <Text style={styles.metricLabel}>HRV</Text>
                </View>
              )}
              {todayCycle.resting_hr != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{todayCycle.resting_hr}</Text>
                  <Text style={styles.metricLabel}>RHR</Text>
                </View>
              )}
              {todayCycle.strain != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{todayCycle.strain}</Text>
                  <Text style={styles.metricLabel}>STRAIN</Text>
                </View>
              )}
            </View>
            {cycles.length > 1 && (
              <View style={styles.trendRow}>
                <Text style={styles.trendLabel}>7-DAY TREND</Text>
                <View style={styles.trendValues}>
                  {cycles.map((c) => (
                    <Text
                      key={c.date}
                      style={[
                        styles.trendValue,
                        c.recovery_score != null && { color: recoveryColor(c.recovery_score) },
                      ]}>
                      {c.recovery_score ?? '—'}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Sleep Section */}
        {lastSleep && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>SLEEP</Text>
            <View style={styles.metricsRow}>
              {lastSleep.performance_percentage != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{lastSleep.performance_percentage}%</Text>
                  <Text style={styles.metricLabel}>PERFORMANCE</Text>
                </View>
              )}
              {lastSleep.efficiency != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{lastSleep.efficiency}%</Text>
                  <Text style={styles.metricLabel}>EFFICIENCY</Text>
                </View>
              )}
              {lastSleep.total_sleep_hours != null && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{lastSleep.total_sleep_hours}h</Text>
                  <Text style={styles.metricLabel}>HOURS</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Activities Section */}
        {hasActivities && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>ACTIVITIES</Text>
            {activities.map(a => (
              <View key={a.localId} style={styles.activityRow}>
                <View style={styles.activityLeft}>
                  <Text style={styles.activityDate}>
                    {formatTimestamp(a.startTime)}
                  </Text>
                  <Text style={styles.activitySource}>
                    {a.source.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.activityMiddle}>
                  <Text style={styles.activityDuration}>
                    {Math.round(a.durationMinutes)}m
                  </Text>
                  <Text style={styles.activityZone}>
                    {ZONE_LABELS[a.derivedZone] ?? `Z${a.derivedZone}`}
                  </Text>
                </View>
                <View style={styles.activityRight}>
                  <Text style={styles.activityAsu}>
                    {a.computedAsu.toFixed(1)}
                  </Text>
                  <Text style={[
                    styles.syncFlag,
                    a.syncedFlag ? styles.synced : styles.unsynced,
                  ]}>
                    {a.syncedFlag ? 'SYNCED' : 'PENDING'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!hasWhoopData && !hasActivities && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No health data yet</Text>
            <Text style={styles.emptyText}>
              Connect WHOOP in Settings to see recovery, HRV, and sleep metrics
            </Text>
            <Text style={styles.emptyText}>
              Apple Health activities (runs, walks) will appear here automatically once permissions are granted
            </Text>
            <Text style={styles.emptyText}>
              Your workout data from the Train tab will also sync here
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 24,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  syncTs: {
    color: '#555555',
    fontSize: 10,
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
  },
  list: {
    flex: 1,
  },
  section: {
    borderTopWidth: 0.5,
    borderTopColor: '#222222',
    paddingTop: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
  },
  recoveryScore: {
    fontSize: 48,
    fontWeight: '200',
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#EAEAEA',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: MONO,
    marginBottom: 4,
  },
  metricLabel: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  trendRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#1A1A1A',
  },
  trendLabel: {
    color: '#444444',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  trendValues: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trendValue: {
    color: '#555555',
    fontSize: 12,
    fontFamily: MONO,
    fontWeight: '500',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1A1A1A',
  },
  activityLeft: {
    flex: 1,
  },
  activityDate: {
    color: '#EAEAEA',
    fontSize: 12,
    fontFamily: MONO,
  },
  activitySource: {
    color: '#555555',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  activityMiddle: {
    alignItems: 'center',
    width: 60,
  },
  activityDuration: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  activityZone: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    width: 64,
  },
  activityAsu: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
  },
  syncFlag: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  synced: {
    color: '#2ECC71',
  },
  unsynced: {
    color: '#F1C40F',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONO,
    letterSpacing: 2,
    marginBottom: 16,
  },
  emptyText: {
    color: '#333333',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
});
