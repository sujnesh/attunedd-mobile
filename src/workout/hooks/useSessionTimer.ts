import { useEffect, useState } from 'react';

export function useSessionTimer(startedAt: number | null): string {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (startedAt == null) return;

    const update = () => {
      const diff = Math.floor((Date.now() - startedAt) / 1000);
      const hours = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      const pad = (n: number) => String(n).padStart(2, '0');

      setElapsed(
        hours > 0
          ? `${pad(hours)}:${pad(mins)}:${pad(secs)}`
          : `${pad(mins)}:${pad(secs)}`,
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}
