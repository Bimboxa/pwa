// Camera of a 3D reconstruction at a time of its video: linear interpolation
// between the two samples around `timeS`.
//
// samples: [{timeS, position: [x, y, z], forward: [x, y, z], hfovDeg?}],
// SORTED by timeS (getCameraPathSamples). Before the first / after the last
// sample, that sample is held.
// → {position: [x, y, z], forward: [x, y, z] (unit), hfovDeg: number | null}
//   or null without any sample.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return length > 1e-9 ? [x / length, y / length, z / length] : null;
}

export default function getCameraPathPoseAtTime(samples, timeS) {
  if (!samples?.length) return null;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const hold = (sample) => ({
    position: [...sample.position],
    forward: normalize(sample.forward) ?? [0, 0, -1],
    hfovDeg: sample.hfovDeg ?? null,
  });
  if (!(timeS > first.timeS)) return hold(first);
  if (timeS >= last.timeS) return hold(last);

  // last sample whose time is <= timeS
  let low = 0;
  let high = samples.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (samples[middle].timeS <= timeS) low = middle;
    else high = middle;
  }
  const a = samples[low];
  const b = samples[high];
  const span = b.timeS - a.timeS;
  const t = span > 0 ? (timeS - a.timeS) / span : 0;

  // the two directions are a fraction of a second apart: a normalized lerp
  // is a slerp to the eye (opposite directions fall back on the nearest)
  const forward = normalize([
    lerp(a.forward[0], b.forward[0], t),
    lerp(a.forward[1], b.forward[1], t),
    lerp(a.forward[2], b.forward[2], t),
  ]) ??
    normalize(t < 0.5 ? a.forward : b.forward) ?? [0, 0, -1];

  return {
    position: [
      lerp(a.position[0], b.position[0], t),
      lerp(a.position[1], b.position[1], t),
      lerp(a.position[2], b.position[2], t),
    ],
    forward,
    hfovDeg:
      a.hfovDeg != null && b.hfovDeg != null
        ? lerp(a.hfovDeg, b.hfovDeg, t)
        : (a.hfovDeg ?? b.hfovDeg ?? null),
  };
}

// Frames of a video that got a camera from the AI, as time-sorted samples.
export function getCameraPathSamples(frames) {
  return (frames ?? [])
    .filter(
      (frame) =>
        Number.isFinite(frame?.timeS) &&
        Array.isArray(frame.pose?.position) &&
        Array.isArray(frame.pose?.forward)
    )
    .map((frame) => ({
      timeS: frame.timeS,
      position: frame.pose.position,
      forward: frame.pose.forward,
      hfovDeg: frame.pose.hfovDeg ?? null,
    }))
    .sort((a, b) => a.timeS - b.timeS);
}
