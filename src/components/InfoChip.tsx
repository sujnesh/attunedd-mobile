import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { ReactNode } from 'react';
import type { EducationTopic } from '../content/education';
import { useEducation } from './EducationProvider';

interface Props {
  topic: EducationTopic;
  children: ReactNode;
  color?: string;
}

export default function InfoChip({ topic, children, color }: Props) {
  const { openTopic } = useEducation();

  return (
    <Pressable onPress={() => openTopic(topic)} hitSlop={6}>
      <Text style={[styles.text, color ? { color } : undefined]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#EAEAEA',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: '#555555',
  },
});
