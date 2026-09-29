import { easeInOutCubic } from "Features/pov/utils/getPovFlightPose";

// Animates a camera matrix { x, y, k } from `from` to `to` (same model as
// flyCamera2d in restorePovViewService): the scale eases geometrically
// (log-lerp, constant perceived zoom speed) and the WORLD point displayed at
// `center` (screen px) is lerped, so the move reads as one travelling.
//
// onTick(matrix) is called every frame, ending exactly on `to`.
// Returns cancel() — a cancelled flight never calls onDone.
export default function flyCameraMatrix({
  from,
  to,
  center,
  durationMs = 450,
  onTick,
  onDone,
}) {
  if (!(from?.k > 0) || !(to?.k > 0) || !(durationMs > 0)) {
    onTick?.(to);
    onDone?.();
    return () => {};
  }

  const cx = center?.x ?? 0;
  const cy = center?.y ?? 0;
  const w0 = { x: (cx - from.x) / from.k, y: (cy - from.y) / from.k };
  const w1 = { x: (cx - to.x) / to.k, y: (cy - to.y) / to.k };
  const logK0 = Math.log(from.k);
  const logK1 = Math.log(to.k);

  let rafId = null;
  let cancelled = false;
  const startedAt = performance.now();

  const tick = (now) => {
    if (cancelled) return;
    const t = Math.min(1, (now - startedAt) / durationMs);
    if (t >= 1) {
      onTick?.(to);
      onDone?.();
      return;
    }
    const s = easeInOutCubic(t);
    const k = Math.exp(logK0 + (logK1 - logK0) * s);
    const wx = w0.x + (w1.x - w0.x) * s;
    const wy = w0.y + (w1.y - w0.y) * s;
    onTick?.({ x: cx - k * wx, y: cy - k * wy, k });
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}
