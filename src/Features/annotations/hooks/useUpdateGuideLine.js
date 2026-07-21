import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Generic patch of one guideLine entry in the selected annotation's ordered
// `guideLines` sequence (isStairs, stairsCount, ...). Same write pattern as
// useApplyGuideLineSlope: raw read + remap + update, Dexie liveQuery drives
// the refresh.
export default function useUpdateGuideLine() {
  const annotation = useSelectedAnnotation();

  return async (index, patch) => {
    if (!annotation?.id || !Number.isInteger(index) || index < 0) return;
    if (!patch || typeof patch !== "object") return;

    const sanitized = { ...patch };
    if ("stairsCount" in sanitized) {
      sanitized.stairsCount = Math.max(
        1,
        Math.round(Number(sanitized.stairsCount) || 1)
      );
    }
    if ("isStairs" in sanitized) {
      sanitized.isStairs = Boolean(sanitized.isStairs);
    }

    const raw = await db.annotations.get(annotation.id);
    if (!raw || !Array.isArray(raw.guideLines) || !raw.guideLines[index])
      return;

    const guideLines = raw.guideLines.map((g, i) =>
      i === index ? { ...g, ...sanitized } : g
    );
    await db.annotations.update(annotation.id, { guideLines });
  };
}
