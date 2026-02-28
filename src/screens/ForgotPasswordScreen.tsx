import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../services/apiClient';
import type { ForgotPasswordProps } from '../navigation/types';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);

  const handleSendReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api('/api/auth/forgot_password', {
        method: 'POST',
        body: { email: email.trim() },
        skipAuth: true,
      });
      Alert.alert('Check your email', 'If an account exists, a reset code has been sent.');
      setStep('reset');
    } catch {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!token.trim() || !password) return;
    setLoading(true);
    try {
      await api('/api/auth/reset_password', {
        method: 'POST',
        body: { token: token.trim(), password, password_confirmation: passwordConfirmation },
        skipAuth: true,
      });
      Alert.alert('Password Reset', 'Your password has been reset. Please log in.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        const parsed = err.body as { errors?: string[] } | null;
        const msg = parsed?.errors?.join('\n') ?? 'Invalid or expired reset code';
        Alert.alert('Reset Failed', msg);
      } else {
        Alert.alert('Error', 'Could not connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 48 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>RESET PASSWORD</Text>

      {step === 'email' ? (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor="#444444"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={handleSendReset}
          />
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={handleSendReset}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'SENDING...' : 'SEND RESET CODE'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="reset code from email"
            placeholderTextColor="#444444"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="new password"
            placeholderTextColor="#444444"
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            placeholder="confirm password"
            placeholderTextColor="#444444"
            secureTextEntry
            returnKeyType="send"
            onSubmitEditing={handleReset}
          />
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={handleReset}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'RESETTING...' : 'RESET PASSWORD'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backText}>BACK TO LOGIN</Text>
      </Pressable>
    </KeyboardAvoidingView>
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
  form: {
    gap: 16,
  },
  input: {
    color: '#EAEAEA',
    fontSize: 14,
    fontFamily: MONO,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#151515',
    borderWidth: 0.5,
    borderColor: '#333333',
  },
  button: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  pressed: {
    backgroundColor: '#151515',
  },
  buttonText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  backLink: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
