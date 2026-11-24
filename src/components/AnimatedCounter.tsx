import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  formatter: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export default function AnimatedCounter({
  value,
  formatter,
  durationMs = 650,
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const previousRef = useRef<number>(value);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayValue(value);
      previousRef.current = value;
      return;
    }

    const startValue = previousRef.current;
    const endValue = value;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endValue);
        previousRef.current = endValue;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <span className={className}>{formatter(displayValue)}</span>;
}
