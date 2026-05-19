// Cheap per-tick map: every ramp point's absolute offsetTop for the current
// moved height. Linear constant-slope ramp: offsetTop = zIso + (zMoved-zIso)·t,
// where t is the normalized cumulative rail-chain length from buildRampLayout
// (iso end t=0 ⇒ zIso, moved end t=1 ⇒ zMoved).
export default function rampOffsetTopByPointId({ tById, zIso, zMoved }) {
  const out = new Map();
  if (!tById) return out;
  const dz = zMoved - zIso;
  for (const [id, t] of tById.entries()) {
    out.set(id, zIso + dz * t);
  }
  return out;
}
