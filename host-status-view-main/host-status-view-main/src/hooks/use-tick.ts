import { useEffect, useState } from "react";

export function useTick(intervalMs = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return tick;
}
