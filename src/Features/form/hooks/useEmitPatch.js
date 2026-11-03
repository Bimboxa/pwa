import { useEffect, useRef } from "react";

// Merges a partial patch into the latest known value before calling onChange.
//
// Controlled style fields spread `{ ...value, field }` on every change. When
// two changes fire back to back (a numeric field commits on blur, then the
// click that stole the focus commits a preset / unit / second field), the
// second handler still closes over the `value` prop from before the first
// commit: an async DB write + liveQuery round trip has not fed the new value
// back yet. Spreading that stale value would silently revert the first commit.
//
// pendingRef accumulates every patch emitted since the last `value` received
// from the parent, and is cleared as soon as a new `value` arrives.
export default function useEmitPatch(value, onChange) {
  const pendingRef = useRef({});

  useEffect(() => {
    pendingRef.current = {};
  }, [value]);

  function emit(patch) {
    pendingRef.current = { ...pendingRef.current, ...patch };
    onChange({ ...value, ...pendingRef.current });
  }

  return emit;
}
