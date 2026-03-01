import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../services/apiClient';
import { setMeta } from '../services/metaStateService';
import { completeOnboarding } from '../navigation/AppNavigator';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

type OptionKey = string;

interface OptionGroup {
  label: string;
  key: string;
  options: { value: OptionKey; label: string }[];
}

const TRAINING_TYPES: OptionGroup = {
  label: 'TRAINING TYPE',
  key: 'training_type',
  options: [
    { value: 'bodybuilding', label: 'BODYBUILDING' },
    { value: 'running', label: 'RUNNING' },
    { value: 'hybrid', label: 'HYBRID' },
  ],
};

const GOALS: OptionGroup = {
  label: 'PRIMARY GOAL',
  key: 'primary_goal',
  options: [
    { value: 'hypertrophy', label: 'HYPERTROPHY' },
    { value: 'strength', label: 'STRENGTH' },
    { value: 'fat_loss', label: 'FAT LOSS' },
    { value: 'endurance', label: 'ENDURANCE' },
  ],
};

const EXPERIENCE: OptionGroup = {
  label: 'EXPERIENCE LEVEL',
  key: 'experience_level',
  options: [
    { value: 'beginner', label: 'BEGINNER' },
    { value: 'intermediate', label: 'INTERMEDIATE' },
    { value: 'advanced', label: 'ADVANCED' },
  ],
};

const DAYS: OptionGroup = {
  label: 'DAYS PER WEEK',
  key: 'days_per_week',
  options: [
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
    { value: '6', label: '6' },
  ],
};

const EQUIPMENT: OptionGroup = {
  label: 'EQUIPMENT',
  key: 'equipment',
  options: [
    { value: 'gym', label: 'FULL GYM' },
    { value: 'home', label: 'HOME' },
    { value: 'minimal', label: 'MINIMAL' },
  ],
};

const DURATION: OptionGroup = {
  label: 'SESSION DURATION',
  key: 'session_minutes',
  options: [
    { value: '30', label: '30 MIN' },
    { value: '45', label: '45 MIN' },
    { value: '60', label: '60 MIN' },
    { value: '90', label: '90 MIN' },
  ],
};

const GROUPS = [TRAINING_TYPES, GOALS, EXPERIENCE, DAYS, EQUIPMENT, DURATION];

const DEFAULTS: Record<string, string> = {
  training_type: 'bodybuilding',
  primary_goal: 'hypertrophy',
  experience_level: 'intermediate',
  days_per_week: '4',
  equipment: 'gym',
  session_minutes: '60',
};

const GENDERS = [
  { value: 'male', label: 'MALE' },
  { value: 'female', label: 'FEMALE' },
  { value: 'other', label: 'OTHER' },
  { value: 'prefer_not_to_say', label: 'PREFER NOT TO SAY' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>(DEFAULTS);
  const [trainingHistory, setTrainingHistory] = useState('');
  const [liftUnit, setLiftUnit] = useState<'kg' | 'lb'>('kg');
  const [bench, setBench] = useState('');
  const [squat, setSquat] = useState('');
  const [deadlift, setDeadlift] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Demographics
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [weight, setWeight] = useState('');

  const isBeginner = selections.experience_level === 'beginner';
  // Step 0: Demographics, Step 1: Training prefs, Step 2: History, Step 3: Lifts
  const totalSteps = isBeginner ? 2 : 4;

  const select = (key: string, value: string) => {
    setSelections((prev) => ({ ...prev, [key]: value }));
  };

  const getHeightCm = (): number | null => {
    if (heightUnit === 'cm') {
      const val = parseInt(heightCm, 10);
      return isNaN(val) || val <= 0 ? null : val;
    }
    const ft = parseInt(heightFt, 10) || 0;
    const inches = parseInt(heightIn, 10) || 0;
    const totalCm = Math.round((ft * 12 + inches) * 2.54);
    return totalCm > 0 ? totalCm : null;
  };

  const getWeightKg = (): number | null => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return null;
    return weightUnit === 'kg' ? val : Math.round(val * 0.4536 * 10) / 10;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        preferences: {
          training_type: selections.training_type,
          primary_goal: selections.primary_goal,
          experience_level: selections.experience_level,
          days_per_week: parseInt(selections.days_per_week, 10),
          equipment: selections.equipment,
          session_minutes: parseInt(selections.session_minutes, 10),
          training_history: trainingHistory || undefined,
          current_lifts: buildCurrentLifts(),
        },
        demographics: {
          age: parseInt(age, 10) || undefined,
          gender: gender || undefined,
          height_cm: getHeightCm() ?? undefined,
          weight_kg: getWeightKg() ?? undefined,
        },
      };
      await api('/api/onboarding/preferences', {
        method: 'POST',
        body,
      });

      // Persist demographics & lifts locally so Settings can read them
      await Promise.all([
        setMeta('user_demographics_json', JSON.stringify(body.demographics)),
        body.preferences && (body.preferences as Record<string, unknown>).current_lifts
          ? setMeta('user_lifts_json', JSON.stringify((body.preferences as Record<string, unknown>).current_lifts))
          : Promise.resolve(),
        trainingHistory ? setMeta('user_training_history', trainingHistory) : Promise.resolve(),
      ]).catch(() => {});

      await completeOnboarding();
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = err.body as { errors?: string[] } | null;
        const msg = parsed?.errors?.join('\n') ?? 'Could not save preferences';
        Alert.alert('Error', msg);
      } else {
        Alert.alert('Error', 'Could not connect to server');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const buildCurrentLifts = () => {
    const b = parseFloat(bench);
    const s = parseFloat(squat);
    const d = parseFloat(deadlift);
    if (!b && !s && !d) return undefined;
    return {
      bench: b || undefined,
      squat: s || undefined,
      deadlift: d || undefined,
      unit: liftUnit,
    };
  };

  const handleNext = () => {
    if (step === 1 && isBeginner) {
      // Skip history/lifts for beginners
      handleSubmit();
    } else if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
      ]}>
      {/* Progress dots */}
      {totalSteps > 1 && (
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Step 0: Demographics */}
      {step === 0 && (
        <>
          <Text style={styles.title}>ABOUT YOU</Text>
          <Text style={styles.subtitle}>
            Helps us personalize your training plan. All fields optional.
          </Text>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>AGE</Text>
            <TextInput
              style={styles.numberInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={age}
              onChangeText={setAge}
              maxLength={3}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>GENDER</Text>
            <View style={styles.optionsRow}>
              {GENDERS.map((opt) => {
                const selected = gender === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setGender(opt.value)}
                    style={[styles.option, selected && styles.optionSelected]}>
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>HEIGHT</Text>
            <View style={styles.unitRow}>
              <Pressable
                onPress={() => setHeightUnit('cm')}
                style={[styles.unitBtn, heightUnit === 'cm' && styles.unitBtnActive]}>
                <Text style={[styles.unitText, heightUnit === 'cm' && styles.unitTextActive]}>CM</Text>
              </Pressable>
              <Pressable
                onPress={() => setHeightUnit('ft')}
                style={[styles.unitBtn, heightUnit === 'ft' && styles.unitBtnActive]}>
                <Text style={[styles.unitText, heightUnit === 'ft' && styles.unitTextActive]}>FT/IN</Text>
              </Pressable>
            </View>
            {heightUnit === 'cm' ? (
              <TextInput
                style={styles.numberInput}
                keyboardType="numeric"
                placeholder="\u2014 cm"
                placeholderTextColor="#444444"
                value={heightCm}
                onChangeText={setHeightCm}
                maxLength={3}
              />
            ) : (
              <View style={styles.heightFtRow}>
                <TextInput
                  style={styles.numberInput}
                  keyboardType="numeric"
                  placeholder="ft"
                  placeholderTextColor="#444444"
                  value={heightFt}
                  onChangeText={setHeightFt}
                  maxLength={1}
                />
                <Text style={styles.heightSep}>&apos;</Text>
                <TextInput
                  style={styles.numberInput}
                  keyboardType="numeric"
                  placeholder="in"
                  placeholderTextColor="#444444"
                  value={heightIn}
                  onChangeText={setHeightIn}
                  maxLength={2}
                />
                <Text style={styles.heightSep}>&quot;</Text>
              </View>
            )}
          </View>

          <View style={styles.group}>
            <Text style={styles.groupLabel}>WEIGHT</Text>
            <View style={styles.unitRow}>
              <Pressable
                onPress={() => setWeightUnit('kg')}
                style={[styles.unitBtn, weightUnit === 'kg' && styles.unitBtnActive]}>
                <Text style={[styles.unitText, weightUnit === 'kg' && styles.unitTextActive]}>KG</Text>
              </Pressable>
              <Pressable
                onPress={() => setWeightUnit('lb')}
                style={[styles.unitBtn, weightUnit === 'lb' && styles.unitBtnActive]}>
                <Text style={[styles.unitText, weightUnit === 'lb' && styles.unitTextActive]}>LB</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.numberInput}
              keyboardType="numeric"
              placeholder={`\u2014 ${weightUnit}`}
              placeholderTextColor="#444444"
              value={weight}
              onChangeText={setWeight}
              maxLength={5}
            />
          </View>
        </>
      )}

      {/* Step 1: Training preferences */}
      {step === 1 && (
        <>
          <Text style={styles.title}>SET UP YOUR PROFILE</Text>
          <Text style={styles.subtitle}>
            Tell us about your training so we can calibrate coaching.
          </Text>

          {GROUPS.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.optionsRow}>
                {group.options.map((opt) => {
                  const selected = selections[group.key] === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => select(group.key, opt.value)}
                      style={[styles.option, selected && styles.optionSelected]}>
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Step 2: Training history */}
      {step === 2 && (
        <>
          <Text style={styles.title}>TELL US ABOUT YOUR TRAINING</Text>
          <Text style={styles.subtitle}>
            What have your last few workouts looked like?
          </Text>

          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={5}
            maxLength={500}
            placeholder="e.g., I usually do push/pull/legs, bench around 80kg, squat 100kg, run 5k twice a week"
            placeholderTextColor="#444444"
            value={trainingHistory}
            onChangeText={setTrainingHistory}
            textAlignVertical="top"
          />
        </>
      )}

      {/* Step 3: Current lifts */}
      {step === 3 && (
        <>
          <Text style={styles.title}>YOUR CURRENT LIFTS</Text>
          <Text style={styles.subtitle}>
            Approximate 1-rep max or recent heavy set. Helps us calibrate your
            plan.
          </Text>

          <View style={styles.unitRow}>
            <Pressable
              onPress={() => setLiftUnit('kg')}
              style={[
                styles.unitBtn,
                liftUnit === 'kg' && styles.unitBtnActive,
              ]}>
              <Text
                style={[
                  styles.unitText,
                  liftUnit === 'kg' && styles.unitTextActive,
                ]}>
                KG
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLiftUnit('lb')}
              style={[
                styles.unitBtn,
                liftUnit === 'lb' && styles.unitBtnActive,
              ]}>
              <Text
                style={[
                  styles.unitText,
                  liftUnit === 'lb' && styles.unitTextActive,
                ]}>
                LB
              </Text>
            </Pressable>
          </View>

          <View style={styles.liftRow}>
            <Text style={styles.liftLabel}>BENCH PRESS</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={bench}
              onChangeText={setBench}
            />
          </View>
          <View style={styles.liftRow}>
            <Text style={styles.liftLabel}>SQUAT</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={squat}
              onChangeText={setSquat}
            />
          </View>
          <View style={styles.liftRow}>
            <Text style={styles.liftLabel}>DEADLIFT</Text>
            <TextInput
              style={styles.liftInput}
              keyboardType="numeric"
              placeholder="\u2014"
              placeholderTextColor="#444444"
              value={deadlift}
              onChangeText={setDeadlift}
            />
          </View>
        </>
      )}

      <View style={styles.btnRow}>
        {step > 0 && (
          <Pressable
            onPress={() => setStep(step - 1)}
            style={styles.backBtn}>
            <Text style={styles.backText}>BACK</Text>
          </Pressable>
        )}

        {step > 1 && step < totalSteps - 1 && (
          <Pressable onPress={() => setStep(step + 1)} style={styles.skipBtn}>
            <Text style={styles.skipText}>SKIP</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleNext}
          style={[styles.submitBtn, submitting && styles.submitDisabled]}
          disabled={submitting}>
          <Text style={styles.submitText}>
            {submitting
              ? 'SAVING...'
              : step === totalSteps - 1
                ? 'CONTINUE'
                : 'NEXT'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  dotActive: {
    backgroundColor: '#EAEAEA',
  },
  title: {
    color: '#EAEAEA',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  group: {
    marginBottom: 24,
  },
  groupLabel: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionSelected: {
    borderColor: '#22C55E',
    backgroundColor: '#0D1A0D',
  },
  optionText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    fontFamily: MONO,
  },
  optionTextSelected: {
    color: '#22C55E',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 16,
    fontFamily: MONO,
    width: 80,
    textAlign: 'center',
    paddingVertical: 10,
  },
  heightFtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightSep: {
    color: '#555555',
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 14,
    lineHeight: 22,
    padding: 16,
    minHeight: 120,
    fontFamily: MONO,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  unitBtn: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  unitBtnActive: {
    borderColor: '#22C55E',
    backgroundColor: '#0D1A0D',
  },
  unitText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  unitTextActive: {
    color: '#22C55E',
  },
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222222',
    paddingBottom: 12,
  },
  liftLabel: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  liftInput: {
    borderWidth: 1,
    borderColor: '#333333',
    color: '#EAEAEA',
    fontSize: 16,
    fontFamily: MONO,
    width: 80,
    textAlign: 'center',
    paddingVertical: 8,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  backText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  skipBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  skipText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
  },
});
