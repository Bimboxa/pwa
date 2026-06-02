import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Sets the slope (%) of one guideLine in the selected annotation's ordered
// `guideLines` sequence. offsetTop is NOT written here — it is derived at
// resolve time (useAnnotationsV2) from the guideLines + slopes, so the 3D mesh
// and quantities update automatically and stay consistent with the contour.
export default function useApplyGuideLineSlope() {
  const annotation = useSelectedAnnotation();

  return async (index, slopePct) => {
    if (!annotation?.id || !Number.isInteger(index) || index < 0) return;

    const raw = await db.annotations.get(annotation.id);
    if (!raw || !Array.isArray(raw.guideLines) || !raw.guideLines[index]) return;

    const guideLines = raw.guideLines.map((g, i) =>
      i === index ? { ...g, slopePct: Number(slopePct) || 0 } : g
    );
    await db.annotations.update(annotation.id, { guideLines });
  };
}
