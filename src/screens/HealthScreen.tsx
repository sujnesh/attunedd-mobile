import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getRecentActivities, type ActivityRow } from '../services/healthService';
import { getMeta } from '../services/metaStateService';
import { apiCached } from '../services/apiClient';
import { executeSql } from '../db/database';
import { ingestDeviceActivities } from '../health/ingestionEngine';
import type { WhoopRecentResponse, WhoopCycleData, WhoopSleepData } from '../types/api';
import {
  initAppleHealth,
  getPermissionStatus as getAppleHealthPermission,
  type PermissionStatus,
} from '../health/appleHealth';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const ZONE_LABELS: Record<number, string> = {
  1: 'Z1', 2: 'Z2', 3: 'Z3', 4: 'Z4', 5: 'Z5',
};

function recoveryColor(score: number): string {
  if (score >= 67) return '#2ECC71';
  if (score >= 34) return '#F1C40F';
  return '#E74C3C';
}

interface FlushResultData {
  sent: number;
  accepted: number;
  rejected: number;
  failed: number;
}

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cycles, setCycles] = useState<WhoopCycleData[]>([]);
  const [sleepData, setSleepData] = useState<WhoopSleepData[]>([]);

  // Diagnostics state
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('not_determined');
  const [activityCount, setActivityCount] = useState(0);
  const [lastIngestTime, setLastIngestTime] = useState<string | null>(null);
  const [lastFlushResult, setLastFlushResult] = useState<FlushResultData | null>(null);
  const [lastHealthError, setLastHealthError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncExpanded, setSyncExpanded] = useState(false);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [acts, syncTs] = await Promise.all([
        getRecentActivities(50),
        getMeta('last_sync_at'),
      ]);
      setActivities(acts);
      setLastSync(syncTs);

      // Request HealthKit access on first load (iOS only).
      // This registers the app in Settings → Health and shows the permission dialog.
      if (Platform.OS === 'ios') {
        try {
          await initAppleHealth();
        } catch (e) {
          console.warn('HealthKit init error:', e);
        }
        try {
          const status = await getAppleHealthPermission();
          setPermissionStatus(status);
        } catch {
          setPermissionStatus('not_determined');
        }
      } else {
        setPermissionStatus('unavailable');
      }

      // Load activity count
      try {
        const [countResult] = await executeSql(
          `SELECT COUNT(*) as cnt FROM external_activities;`
        );
        setActivityCount(countResult.rows.item(0)?.cnt ?? 0);
      } catch {
        setActivityCount(0);
      }

      // Load diagnostics from meta_state
      const [ingestTime, flushJson, healthErr] = await Promise.all([
        getMeta('last_ingest_time'),
        getMeta('last_flush_result_json'),
        getMeta('last_health_error'),
      ]);
      setLastIngestTime(ingestTime);
      setLastHealthError(healthErr);
      try {
        setLastFlushResult(flushJson ? JSON.parse(flushJson) : null);
      } catch {
        setLastFlushResult(null);
      }

      try {
        const whoop = await apiCached<WhoopRecentResponse>('/api/whoop/recent', 'cache_whoop_recent');
        setCycles(whoop.cycles);
        setSleepData(whoop.sleep);
      } catch {
        // Not connected — fine
      }
    } catch {
      // non-fatal
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const authToken = await getMeta('auth_token');
      if (authToken) {
        await ingestDeviceActivities(30, authToken);
      }
      await load();
    } catch {
      // non-fatal
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, load]);

  const handleGrantAccess = useCallback(async () => {
    if (Platform.OS !== 'ios' || granting) return;
    setGranting(true);
    try {
      await initAppleHealth();

      // Try immediate ingestion after granting
      try {
        const authToken = await getMeta('auth_token');
        if (authToken) {
          await ingestDeviceActivities(30, authToken);
        }
      } catch {
        // ingestion failure is non-fatal
      }

      await load();

      // Check if we actually got data — if not, guide user to Settings
      const status = await getAppleHealthPermission();
      if (status !== 'granted') {
        Alert.alert(
          'Health Access',
          'iOS only shows the permission dialog once. Go to Settings → Health → Attunedd to enable access.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'OK', style: 'cancel' },
          ],
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        'Health Access',
        `${msg}\n\nTry going to Settings → Health → Attunedd to enable access manually.`,
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } finally {
      setGranting(false);
    }
  }, [granting, load]);

  if (!loaded) return <View style={styles.root} />;

  const todayCycle = cycles.length > 0 ? cycles[0] : null;
  const lastSleep = sleepData.length > 0 ? sleepData[0] : null;
  const hasWhoopData = cycles.length > 0 || sleepData.length > 0;
  const hasActivities = activities.length > 0;
  const hasAnyData = hasWhoopData || hasActivities;

  const permissionLabel =
    permissionStatus === 'granted' ? 'GRANTED' :
    permissionStatus === 'denied' ? 'DENIED' :
    permissionStatus === 'unavailable' ? 'N/A' :
    'NOT ASKED';

  const permissionColor =
    permissionStatus === 'granted' ? '#2ECC71' :
    permissionStatus === 'denied' ? '#E74C3C' :
    '#888888';

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 24 }]}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>HEALTH</Text>

      {/* Recovery Section */}
      {todayCycle && todayCycle.recovery_score != null && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOVERY</Text>
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
                    {c.recovery_score ?? '\u2014'}
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
          <Text style={styles.sectionLabel}>SLEEP</Text>
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
          <Text style={styles.sectionLabel}>ACTIVITIES</Text>
          {activities.map((a) => (
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
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Enhanced empty state — context-aware */}
      {!hasAnyData && (
        <View style={styles.statusSection}>
          <Text style={styles.statusTitle}>HEALTH STATUS</Text>

          {permissionStatus !== 'granted' && Platform.OS === 'ios' && (
            <>
              <Text style={styles.statusMessage}>
                {permissionStatus === 'denied'
                  ? 'Apple Health access was denied. Open Settings to enable it.'
                  : 'Tap to grant Apple Health access so we can read your activity data.'}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.connectBtn, pressed && styles.connectBtnPressed]}
                onPress={permissionStatus === 'denied' ? () => Linking.openSettings() : handleGrantAccess}
                disabled={granting}>
                {granting ? (
                  <ActivityIndicator size="small" color="#0A0A0A" />
                ) : (
                  <Text style={styles.connectBtnText}>
                    {permissionStatus === 'denied' ? 'Open Settings' : 'Grant Access'}
                  </Text>
                )}
              </Pressable>
            </>
          )}

          {permissionStatus === 'granted' && (
            <Text style={styles.statusMessage}>
              Permissions granted. No recent activities found.
            </Text>
          )}

          {permissionStatus === 'unavailable' && (
            <>
              <View style={styles.connectionRow}>
                <Text style={styles.connectionLabel}>Apple Health</Text>
                <Text style={styles.connectionStatus}>Unavailable</Text>
              </View>
              <View style={styles.connectionRow}>
                <Text style={styles.connectionLabel}>WHOOP</Text>
                <Text style={styles.connectionStatus}>Not Connected</Text>
              </View>
            </>
          )}

          <View style={styles.whyBlock}>
            <Text style={styles.whyTitle}>Why this matters</Text>
            <Text style={styles.whyText}>
              Recovery data improves coaching accuracy. Without it, session limits default to conservative estimates.
            </Text>
          </View>
        </View>
      )}

      {/* Sync Details — collapsible */}
      <Pressable
        style={styles.syncToggle}
        onPress={() => setSyncExpanded((p) => !p)}>
        <Text style={styles.syncToggleText}>
          SYNC DETAILS {syncExpanded ? '\u25B2' : '\u25BC'}
        </Text>
      </Pressable>

      {syncExpanded && (
        <View style={styles.syncSection}>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Permission</Text>
            {permissionStatus === 'not_determined' && Platform.OS === 'ios' ? (
              <Pressable onPress={handleGrantAccess} disabled={granting}>
                <Text style={[styles.syncValue, { color: '#2ECC71' }]}>
                  {granting ? 'GRANTING...' : 'TAP TO GRANT'}
                </Text>
              </Pressable>
            ) : permissionStatus === 'denied' ? (
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={[styles.syncValue, { color: '#E74C3C' }]}>
                  DENIED — TAP TO FIX
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.syncValue, { color: permissionColor }]}>
                {permissionLabel}
              </Text>
            )}
          </View>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>WHOOP</Text>
            <Text style={styles.syncValue}>
              {hasWhoopData ? 'Connected' : 'Not Connected'}
            </Text>
          </View>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Last Ingest</Text>
            <Text style={styles.syncValue}>
              {lastIngestTime ? formatDate(lastIngestTime) : 'Never'}
            </Text>
          </View>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Activities</Text>
            <Text style={styles.syncValue}>{activityCount}</Text>
          </View>
          {lastFlushResult && (
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>Last Flush</Text>
              <Text style={styles.syncValue}>
                {lastFlushResult.sent}s/{lastFlushResult.accepted}a/{lastFlushResult.rejected}r/{lastFlushResult.failed}f
              </Text>
            </View>
          )}
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Last Error</Text>
            <Text style={[styles.syncValue, lastHealthError ? { color: '#E74C3C' } : {}]}>
              {lastHealthError ?? 'None'}
            </Text>
          </View>
        </View>
      )}

      {/* Refresh Now button */}
      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
        onPress={handleRefresh}
        disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator size="small" color="#0A0A0A" />
        ) : (
          <Text style={styles.refreshBtnText}>Refresh Now</Text>
        )}
      </Pressable>

      {lastSync && (
        <Text style={styles.syncTs}>Last sync: {formatDate(lastSync)}</Text>
      )}
    </ScrollView>
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
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 32,
    textAlign: 'center',
  },
  syncTs: {
    color: '#444444',
    fontSize: 10,
    fontFamily: MONO,
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: 1,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    paddingTop: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 16,
  },
  recoveryScore: {
    fontSize: 48,
    fontWeight: '200',
    fontFamily: MONO,
    textAlign: 'center',
    marginBottom: 20,
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
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  // Empty state — structured
  statusSection: {
    marginTop: 24,
  },
  statusTitle: {
    color: '#EAEAEA',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 24,
    textAlign: 'center',
  },
  statusMessage: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  connectionLabel: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  connectionStatus: {
    color: '#555555',
    fontSize: 13,
    fontFamily: MONO,
  },
  whyBlock: {
    marginTop: 28,
    marginBottom: 28,
  },
  whyTitle: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  whyText: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
  },
  connectBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2ECC71',
    marginBottom: 8,
  },
  connectBtnPressed: {
    backgroundColor: '#27AE60',
  },
  connectBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  // Sync details — collapsible
  syncToggle: {
    paddingVertical: 12,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1A1A',
    alignItems: 'center',
  },
  syncToggleText: {
    color: '#555555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  syncSection: {
    paddingVertical: 8,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  syncLabel: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1,
  },
  syncValue: {
    color: '#CCCCCC',
    fontSize: 11,
    fontFamily: MONO,
  },
  // Refresh button
  refreshBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2ECC71',
  },
  refreshBtnPressed: {
    backgroundColor: '#27AE60',
  },
  refreshBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
