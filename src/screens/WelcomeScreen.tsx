import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Page {
  tag: string;
  headline: string;
  body: string;
}

const PAGES: Page[] = [
  {
    tag: 'YOUR ADAPTIVE COACH',
    headline: 'Training that adapts to YOU',
    body: 'Attunedd adjusts your workouts based on how your body is recovering. Train harder when you\u2019re ready. Pull back when you need it.',
  },
  {
    tag: 'EVERY REP HAS A REASON',
    headline: 'We tell you why',
    body: 'Every exercise, every set, every rest day \u2014 your coach explains the reasoning. No guesswork.',
  },
  {
    tag: 'RECOVERY-DRIVEN',
    headline: 'Connect WHOOP or train smart without it',
    body: 'With WHOOP, we use your recovery data automatically. Without it, we learn from your workout responses.',
  },
];

interface Props {
  onComplete: () => void;
}

export default function WelcomeScreen({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const handleMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      setCurrentPage(page);
    },
    [width],
  );

  const isLastPage = currentPage === PAGES.length - 1;

  return (
    <View style={styles.container}>
      <Pressable onPress={onComplete} style={styles.skipBtn}>
        <Text style={styles.skipText}>SKIP</Text>
      </Pressable>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}>
        {PAGES.map((page, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <Text style={styles.tag}>{page.tag}</Text>
            <Text style={styles.headline}>{page.headline}</Text>
            <Text style={styles.body}>{page.body}</Text>
          </View>
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentPage && styles.dotActive]}
            />
          ))}
        </View>

        {isLastPage ? (
          <Pressable
            onPress={onComplete}
            style={({ pressed }) => [
              styles.ctaBtn,
              pressed && styles.ctaBtnPressed,
            ]}>
            <Text style={styles.ctaText}>GET STARTED</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              const next = currentPage + 1;
              scrollRef.current?.scrollTo({ x: next * width, animated: true });
              setCurrentPage(next);
            }}
            style={({ pressed }) => [
              styles.nextBtn,
              pressed && styles.nextBtnPressed,
            ]}>
            <Text style={styles.nextText}>NEXT</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  tag: {
    color: '#2ECC71',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    fontFamily: MONO,
    marginBottom: 16,
  },
  headline: {
    color: '#EAEAEA',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: 16,
  },
  body: {
    color: '#888888',
    fontSize: 15,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
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
  ctaBtn: {
    backgroundColor: '#2ECC71',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 4,
  },
  ctaBtnPressed: {
    backgroundColor: '#27AE60',
  },
  ctaText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: MONO,
  },
  nextBtn: {
    borderWidth: 0.5,
    borderColor: '#333333',
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  nextBtnPressed: {
    backgroundColor: '#151515',
  },
  nextText: {
    color: '#EAEAEA',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: MONO,
  },
});
