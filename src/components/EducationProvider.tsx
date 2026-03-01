import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { EducationTopic } from '../content/education';
import InfoSheet from './InfoSheet';

interface EducationContextValue {
  openTopic: (topic: EducationTopic) => void;
}

const EducationContext = createContext<EducationContextValue | null>(null);

export function useEducation(): EducationContextValue {
  const ctx = useContext(EducationContext);
  if (!ctx) {
    throw new Error('useEducation must be used within EducationProvider');
  }
  return ctx;
}

interface Props {
  children: ReactNode;
}

export default function EducationProvider({ children }: Props) {
  const [activeTopic, setActiveTopic] = useState<EducationTopic | null>(null);

  const openTopic = useCallback((topic: EducationTopic) => {
    setActiveTopic(topic);
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveTopic(null);
  }, []);

  const value = useMemo(() => ({ openTopic }), [openTopic]);

  return (
    <EducationContext.Provider value={value}>
      {children}
      <InfoSheet topic={activeTopic} onDismiss={handleDismiss} />
    </EducationContext.Provider>
  );
}
