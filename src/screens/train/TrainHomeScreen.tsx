import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startWorkout } from '../../services/workoutService';
import type { TrainHomeProps } from '../../navigation/types';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function TrainHomeScreen({ navigation }: TrainHomeProps) {
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);

  const handleStart = async (mode: 'planned' | 'free_form') => {
    if (starting) return;
    setStarting(true);
    try {
      const { workoutId, mobileLocalId } = await startWorkout(mode);
      const screen = mode === 'planned' ? 'ActiveWorkout' : 'FreeFormWorkout';
      navigation.navigate(screen, { workoutId, mobileLocalId });
    } catch {
      // start failure is non-fatal
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48 }]}>
      <Text style={styles.title}>TRAIN</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 32,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    marginBottom: 48,
    textAlign: 'center',
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
