import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import db from "App/db/db";

const toggleIdx = (list, idx) =>
  list.includes(idx) ? list.filter((i) => i !== idx) : [...list, idx];

// Toggles the sub-selected segment's isoHeight (contour line) flag. Stored as
// `isoHeightSegmentsIdx` on the annotation main contour, or on the matching
// `annotation.cuts[cutIdx]`. Reads the raw db record so we never write resolved
// pixel-space points back. Dexie liveQuery refreshes the UI automatically.
export default function useToggleSegmentIsoHeight() {
  const selectedItem = useSelector(selectSelectedItem);

  return async () => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    const partId = selectedItem?.partId;
    const parts = String(partId || "").split("::");
    const partType = parts[1];
    if (
      !annotationId ||
      !partId ||
      (partType !== "SEG" && partType !== "CUT_SEG")
    )
      return;

    let cutIdx = null;
    let segIdx = null;
    if (partType === "SEG") {
      segIdx = Number(parts[2]);
    } else {
      cutIdx = Number(parts[2]);
      segIdx = Number(parts[3]);
    }
    if (!Number.isInteger(segIdx)) return;

    const annotation = await db.annotations.get(annotationId);
    if (!annotation) return;

    if (cutIdx == null) {
      const current = annotation.isoHeightSegmentsIdx || [];
      await db.annotations.update(annotationId, {
        isoHeightSegmentsIdx: toggleIdx(current, segIdx),
      });
      return;
    }

    const cuts = annotation.cuts || [];
    if (!cuts[cutIdx]) return;
    const newCuts = cuts.map((cut, i) => {
      if (i !== cutIdx) return cut;
      const current = cut.isoHeightSegmentsIdx || [];
      return { ...cut, isoHeightSegmentsIdx: toggleIdx(current, segIdx) };
    });
    await db.annotations.update(annotationId, { cuts: newCuts });
  };
}
