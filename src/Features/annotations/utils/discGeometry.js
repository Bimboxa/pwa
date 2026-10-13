// Geometry of a DISC annotation, shared by the 2D node (NodeDiscStatic), the
// 3D build (buildDiscObject3D) and the quantities (getAnnotationQties).
//
// Storage contract (same as the plan-view REVOLUTION_AXIS, see
// getRevolutionAxisPlanFrame): a CENTRE (`point`) + `radiusM`, and an optional
// sector — `partialRevolution` with `revolutionAngleStartDeg` /
// `revolutionAngleEndDeg` in the plan LOCAL metre frame (y up, degrees, CCW
// from local +X). The kept material runs CCW from start to end; a span of 0
// (mod 360°) is a full disc.

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const FULL_SPAN_EPS = 1e-6;

// Samples of the dome profile (rim → apex). 24 keeps the lathe smooth while
// the quantities stay cheap.
export const DOME_PROFILE_SAMPLES = 24;

/**
 * Angular sector of a disc, in radians (plan local frame).
 * @returns {{start:number, end:number, span:number, isSector:boolean}}
 *   `isSector` false ⇒ full disc (start 0, span 2π).
 */
export function getDiscSector(annotation) {
  if (!annotation?.partialRevolution) {
    return { start: 0, end: TWO_PI, span: TWO_PI, isSector: false };
  }
  const start = (Number(annotation.revolutionAngleStartDeg) || 0) * DEG;
  const end = (Number(annotation.revolutionAngleEndDeg) || 0) * DEG;
  let span = (end - start) % TWO_PI;
  if (span < 0) span += TWO_PI;
  // start ≡ end: degenerate sector, treated as the full disc (same rule as
  // the revolution axis base circle).
  if (span < FULL_SPAN_EPS) {
    return { start, end: start + TWO_PI, span: TWO_PI, isSector: false };
  }
  return { start, end: start + span, span, isSector: true };
}

/**
 * « Coupole » profile: a quarter ellipse from the rim (R, 0) to the apex
 * (0, H) — vertical tangent at the rim, horizontal at the apex.
 * @returns {{r:number, h:number}[]} radius / height pairs, rim first.
 */
export function getDomeProfile(
  radiusM,
  heightM,
  samples = DOME_PROFILE_SAMPLES
) {
  const n = Math.max(2, samples);
  const profile = [];
  for (let i = 0; i <= n; i++) {
    const t = (Math.PI / 2) * (i / n);
    profile.push({ r: radiusM * Math.cos(t), h: heightM * Math.sin(t) });
  }
  return profile;
}

/**
 * Surface of the 3D shape of a disc, in m².
 * - standard: the plane area of the disc / sector (span/2 · R²);
 * - dome: the developed area of the dome (Pappus on the sampled profile,
 *   Σ π·(r1+r2)·segLen for a full turn), scaled by the sector fraction.
 */
export function getDiscSurfaceM2({
  radiusM,
  span = TWO_PI,
  heightM = 0,
  isDome = false,
}) {
  const R = Number(radiusM) || 0;
  if (R <= 0) return 0;
  const fraction = span / TWO_PI;
  const H = Number(heightM) || 0;
  if (!isDome || H <= 0) return (span / 2) * R * R;
  const profile = getDomeProfile(R, H);
  let surface = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i];
    const b = profile[i + 1];
    const segLen = Math.hypot(b.r - a.r, b.h - a.h);
    surface += Math.PI * (a.r + b.r) * segLen;
  }
  return surface * fraction;
}

export function isDiscDome(annotation) {
  return annotation?.shape3D?.key === "DISC_DOME";
}
