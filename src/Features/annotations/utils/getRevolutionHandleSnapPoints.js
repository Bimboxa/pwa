import { DEG_TO_RAD } from "./getRevolutionAxisPlanFrame";

// Snap anchors of a centre + radius annotation (REVOLUTION_AXIS, DISC): the
// centre, then the ends of what is DRAWN — the two diameter ends of a full
// circle (`REVOLUTION_RIM::<0|1>`), the two sector ends of a partial
// revolution (`REVOLUTION_ANGLE::<START|END>`). Each end carries the handle
// part type a drag started on it drives (InteractionLayer snap-marker
// mousedown → applyDeltaPosToAnnotation). Deliberately id-less: they are
// derived from the scalars, not db.points rows (see getBestSnap).
export default function getRevolutionHandleSnapPoints(annotation, frame) {
  if (!frame) return null;
  const ends = annotation.partialRevolution
    ? [
        ["START", annotation.revolutionAngleStartDeg],
        ["END", annotation.revolutionAngleEndDeg],
      ].map(([key, deg]) => {
        const t = (Number(deg) || 0) * DEG_TO_RAD;
        return {
          x: frame.centerPx.x + frame.radiusPx * Math.cos(t),
          y: frame.centerPx.y - frame.radiusPx * Math.sin(t),
          partType: `REVOLUTION_ANGLE::${key}`,
        };
      })
    : frame.rimPx.map((p, i) => ({
        x: p.x,
        y: p.y,
        partType: `REVOLUTION_RIM::${i}`,
      }));
  return [{ x: frame.centerPx.x, y: frame.centerPx.y }, ...ends];
}
