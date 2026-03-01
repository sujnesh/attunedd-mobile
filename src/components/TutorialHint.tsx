import React, { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMeta, setMeta } from '../services/metaStateService';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Props {
  hintKey: string;
  message: string;
  visible: boolean;
}

export default function TutorialHint({ hintKey, message, visible }: Props) {
  const [show, setShow] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }

    getMeta(`hint_seen_${hintKey}`).then((val) => {
      if (val !== 'true') {
        setShow(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [visible, hintKey, opacity]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShow(false);
      setMeta(`hint_seen_${hintKey}`, 'true');
    });
  };

  if (!show) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Pressable onPress={dismiss} style={styles.inner}>
        <View style={styles.arrow} />
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  inner: {
    backgroundColor: '#1A2A1A',
    borderWidth: 0.5,
    borderColor: '#2ECC71',
    padding: 12,
    borderRadius: 4,
  },
  arrow: {
    position: 'absolute',
    top: -6,
    left: 24,
    width: 12,
    height: 12,
    backgroundColor: '#1A2A1A',
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderColor: '#2ECC71',
    transform: [{ rotate: '45deg' }],
  },
  text: {
    color: '#CCCCCC',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: MONO,
  },
});
