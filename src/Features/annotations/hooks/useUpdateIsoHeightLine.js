import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

// Generic patch of one isoHeightLine entry in the selected annotation's
// `isoHeightLines` sequence (height, ...). Same write pattern as
// useUpdateGuideLine: raw read + remap + update, Dexie liveQuery drives the
// refresh.
export default function useUpdateIsoHeightLine() {
  const annotation = useSelectedAnnotation();

  return async (index, patch) => {
    if (!annotation?.id || !Number.isInteger(index) || index < 0) return;
    if (!patch || typeof patch !== "object") return;

    const sanitized = { ...patch };
    if ("height" in sanitized) {
      sanitized.height = Number(sanitized.height) || 0;
    }

    const raw = await db.annotations.get(annotation.id);
    if (!raw || !Array.isArray(raw.isoHeightLines) || !raw.isoHeightLines[index])
      return;

    const isoHeightLines = raw.isoHeightLines.map((l, i) =>
      i === index ? { ...l, ...sanitized } : l
    );
    await db.annotations.update(annotation.id, { isoHeightLines });
  };
}
