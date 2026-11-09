import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// useZoomPanTransform — wheel zoom (anchored on the cursor) + drag pan of an
// element filling `stageRef`, as a CSS transform `translate(tx,ty) scale(k)`
// with transform-origin 0 0. Same wheel formula as LocalScanSlicePreview.
// `reset()` returns to the identity.
// ---------------------------------------------------------------------------

const WHEEL_SENSITIVITY = 0.002;
const WHEEL_CLAMP = 200;

export default function useZoomPanTransform({
  stageRef,
  minK = 1,
  maxK = 20,
} = {}) {
  const [transform, setTransform] = useState({ k: 1, tx: 0, ty: 0 });
  const [panning, setPanning] = useState(false);
  const panRef = useRef(null);

  const clampK = useCallback(
    (k) => Math.min(maxK, Math.max(minK, k)),
    [minK, maxK]
  );

  const zoomAt = useCallback(
    (factor, cx, cy) => {
      setTransform((t) => {
        const k = clampK(t.k * factor);
        if (k === t.k) return t;
        const ratio = k / t.k;
        return {
          k,
          tx: cx - (cx - t.tx) * ratio,
          ty: cy - (cy - t.ty) * ratio,
        };
      });
    },
    [clampK]
  );

  // Non-passive wheel listener: the dialog must not scroll behind.
  useEffect(() => {
    const el = stageRef?.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = Math.max(-WHEEL_CLAMP, Math.min(WHEEL_CLAMP, e.deltaY));
      zoomAt(
        Math.exp(-dy * WHEEL_SENSITIVITY),
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stageRef, zoomAt]);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
  }, []);

  const onPointerMove = useCallback((e) => {
    const start = panRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    panRef.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, tx: t.tx + dx, ty: t.ty + dy }));
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!panRef.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    setPanning(false);
  }, []);

  const reset = useCallback(() => setTransform({ k: 1, tx: 0, ty: 0 }), []);

  const isIdentity =
    transform.k === 1 && transform.tx === 0 && transform.ty === 0;

  return {
    transform,
    cssTransform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.k})`,
    isIdentity,
    panning,
    reset,
    zoomAt,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
