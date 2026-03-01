import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CheckInData } from '../services/checkInService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface DailyCheckInProps {
  visible: boolean;
  onSubmit: (data: CheckInData) => void;
  onSkip: () => void;
}

interface RatingRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function RatingRow({ label, value, onChange }: RatingRowProps) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.ratingBoxes}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[
              styles.ratingBox,
              n === value && styles.ratingBoxSelected,
            ]}>
            <Text
              style={[
                styles.ratingBoxText,
                n === value && styles.ratingBoxTextSelected,
              ]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function DailyCheckIn({ visible, onSubmit, onSkip }: DailyCheckInProps) {
  const [energy, setEnergy] = useState(3);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [soreness, setSoreness] = useState(3);
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    onSubmit({
      energy,
      sleepQuality,
      soreness,
      note: note.trim() || undefined,
    });
    // Reset for next time
    setEnergy(3);
    setSleepQuality(3);
    setSoreness(3);
    setNote('');
  };

  const handleSkip = () => {
    setEnergy(3);
    setSleepQuality(3);
    setSoreness(3);
    setNote('');
    onSkip();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>DAILY CHECK-IN</Text>

          <RatingRow label="ENERGY" value={energy} onChange={setEnergy} />
          <RatingRow label="SLEEP QUALITY" value={sleepQuality} onChange={setSleepQuality} />
          <RatingRow label="MUSCLE SORENESS" value={soreness} onChange={setSoreness} />

          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Optional note..."
            placeholderTextColor="#444444"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={140}
          />

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
            onPress={handleSubmit}>
            <Text style={styles.doneBtnText}>DONE</Text>
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#111111',
    width: '100%',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222222',
  },
  title: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 24,
    textAlign: 'center',
  },
  ratingRow: {
    marginBottom: 20,
  },
  ratingLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  ratingBoxes: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingBox: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  ratingBoxSelected: {
    borderColor: '#2ECC71',
    backgroundColor: '#0D1A0D',
  },
  ratingBoxText: {
    color: '#555555',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: MONO,
  },
  ratingBoxTextSelected: {
    color: '#2ECC71',
  },
  noteInput: {
    color: '#EAEAEA',
    fontSize: 13,
    fontFamily: MONO,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0A0A0A',
    borderWidth: 0.5,
    borderColor: '#222222',
    marginBottom: 24,
  },
  doneBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#2ECC71',
    marginBottom: 12,
  },
  doneBtnPressed: {
    backgroundColor: '#27AE60',
  },
  doneBtnText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  skipText: {
    color: '#555555',
    fontSize: 12,
    letterSpacing: 1,
  },
});
