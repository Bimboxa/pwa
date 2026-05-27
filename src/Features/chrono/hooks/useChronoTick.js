import { useEffect, useState } from "react";

export default function useChronoTick(enabled, intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
