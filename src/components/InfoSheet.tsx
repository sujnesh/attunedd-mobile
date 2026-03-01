import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { EDUCATION } from '../content/education';
import type { EducationTopic } from '../content/education';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Props {
  topic: EducationTopic | null;
  onDismiss: () => void;
}

export default function InfoSheet({ topic, onDismiss }: Props) {
  const { height: screenHeight } = useWindowDimensions();
  const sheetHeight = screenHeight * 0.55;
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const visible = topic !== null;
  const entry = topic ? EDUCATION[topic] : null;

  useEffect(() => {
    if (visible) {
      translateY.setValue(sheetHeight);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 25,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, sheetHeight, translateY, backdropOpacity]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: sheetHeight,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  if (!visible || !entry) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight, transform: [{ translateY }] },
          ]}>
          <View style={styles.handle} />

          <Text style={styles.title}>{entry.title.toUpperCase()}</Text>

          <Text style={styles.body}>{entry.body}</Text>

          <View style={styles.tipContainer}>
            <Text style={styles.tipLabel}>COACH TIP</Text>
            <Text style={styles.tipText}>{entry.coachTip}</Text>
          </View>

          <Pressable onPress={dismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>GOT IT</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#EAEAEA',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
    marginBottom: 20,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  tipContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#2ECC71',
    paddingLeft: 16,
    marginBottom: 32,
  },
  tipLabel: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
    marginBottom: 6,
  },
  tipText: {
    color: '#AAAAAA',
    fontSize: 13,
    lineHeight: 20,
  },
  dismissBtn: {
    alignSelf: 'center',
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  dismissText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
});
