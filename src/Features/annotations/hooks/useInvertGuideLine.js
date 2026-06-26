import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Inverts the ramp direction of one guideLine by reversing the order of its
// point references. The ramp base (low point) is the FIRST point and height
// rises in drawing order (see getGuideLinesRampOffsets), so reversing the refs
// flips base <-> top while keeping slopePct positive. Only the {pointId,type}
// refs are reordered — db.points is untouched.
export default function useInvertGuideLine() {
  const annotation = useSelectedAnnotation();

  return async ({ index }) => {
    if (!annotation?.id || !Number.isInteger(index) || index < 0) return;

    const raw = await db.annotations.get(annotation.id);
    if (!raw || !Array.isArray(raw.guideLines) || !raw.guideLines[index]) return;

    const guideLines = raw.guideLines.map((g, i) =>
      i === index ? { ...g, points: [...(g.points || [])].reverse() } : g
    );
    await db.annotations.update(annotation.id, { guideLines });
  };
}
