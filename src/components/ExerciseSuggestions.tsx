import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

interface Props {
  suggestions: string[];
  onSelect: (name: string) => void;
}

export default function ExerciseSuggestions({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      {suggestions.map((name) => (
        <Pressable
          key={name}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          onPress={() => onSelect(name)}>
          <Text style={styles.text} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111111',
    borderTopWidth: 0.5,
    borderTopColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  pressed: {
    backgroundColor: '#1A1A1A',
  },
  text: {
    color: '#AAAAAA',
    fontSize: 13,
    fontFamily: MONO,
  },
});
