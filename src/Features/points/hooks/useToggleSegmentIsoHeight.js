import { useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import { buildSegmentFlagChanges } from "Features/annotations/utils/segmentFlags";

import db from "App/db/db";

// Toggles the sub-selected segment's isoHeight (contour line) flag, on the
// annotation main contour or on the matching `annotation.cuts[cutIdx]`.
// Persisted as start-point ids (segmentFlags.js): the transient segIdx from
// the partId is mapped to a point id via the resolved annotation, and the raw
// db record is read back so we never write resolved pixel-space points.
// Dexie liveQuery refreshes the UI automatically.
export default function useToggleSegmentIsoHeight() {
  const selectedItem = useSelector(selectSelectedItem);
  const annotation = useSelectedAnnotation();

  return async () => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    const partId = selectedItem?.partId;
    const parts = String(partId || "").split("::");
    const partType = parts[1];
    if (
      !annotationId ||
      !partId ||
      !annotation ||
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

    const record = await db.annotations.get(annotationId);
    if (!record) return;

    const ringKey = cutIdx == null ? "MAIN" : `CUT::${cutIdx}`;
    const changes = buildSegmentFlagChanges({
      record,
      resolvedAnnotation: annotation,
      ops: [
        {
          idxField: "isoHeightSegmentsIdx",
          ringKey,
          segIdxs: [segIdx],
          mode: "toggle",
        },
      ],
    });
    if (changes) await db.annotations.update(annotationId, changes);
  };
}
