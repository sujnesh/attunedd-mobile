import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, Platform } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface FeedbackToastProps {
  message: string | null;
  type: 'info' | 'warning';
  onDismiss: () => void;
}

const COLORS = {
  info: { bg: '#0D1A0D', border: '#2ECC71', text: '#2ECC71' },
  warning: { bg: '#1A1A0D', border: '#F1C40F', text: '#F1C40F' },
};

export default function FeedbackToast({ message, type, onDismiss }: FeedbackToastProps) {
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      // Slide in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3s
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 60,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [message, onDismiss, translateY, opacity]);

  if (!message) return null;

  const colors = COLORS[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}>
      <Pressable onPress={onDismiss} style={styles.pressable}>
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 0.5,
    marginHorizontal: 16,
  },
  pressable: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontSize: 11,
    fontFamily: MONO,
    textAlign: 'center',
  },
});
