import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import { decodePartId } from "Features/annotations/utils/getContiguousSegmentChain";
import { buildSegmentFlagChanges } from "Features/annotations/utils/segmentFlags";

import db from "App/db/db";

const ringIdxList = (annotation, ringKey, field) => {
  if (ringKey === "MAIN") return annotation?.[field] || [];
  const cutIdx = Number(ringKey.split("::")[1]);
  return annotation?.cuts?.[cutIdx]?.[field] || [];
};

// Unified state + bulk toggle for a per-segment edge flag on the annotation
// main contour and on each `annotation.cuts[cutIdx]`. `field` is the legacy
// index-based name ("xxxSegmentsIdx"); reads go through the effective indices
// recomputed by useAnnotationsV2, writes persist the start-point-id arrays
// (see segmentFlags.js). Handles both single-segment selection
// (selectedItem.partId) and multi-segment selection (selectedPartIds).
//
// `field` is the flag being toggled (e.g. "isExtEdgeSegmentsIdx"); `clearField`
// is the mutually-exclusive opposite flag (e.g. "isIntEdgeSegmentsIdx") that is
// cleared on the same segments whenever the flag is added, so a segment is
// never simultaneously forced-exterior and forced-interior.
//
// Returns { checked, indeterminate, count, toggle }:
//   - checked       : every selected segment is already flagged
//   - indeterminate : some-but-not-all selected segments are flagged
//   - toggle()      : if all flagged → unset all, else → set all (single write)
export default function useSegmentsEdgeFlag(field, clearField) {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const annotation = useSelectedAnnotation();

  // The selected segments — multi takes priority, else the single sub-selection.
  const partIds =
    selectedPartIds.length >= 1
      ? selectedPartIds
      : selectedItem?.partId
        ? [selectedItem.partId]
        : [];

  // Decode to { ringKey, segIdx }, keeping only valid segment parts.
  const decoded = partIds.map(decodePartId).filter(Boolean);

  const flags = decoded.map((d) =>
    ringIdxList(annotation, d.ringKey, field).includes(d.segIdx)
  );
  const count = decoded.length;
  const flaggedCount = flags.filter(Boolean).length;
  const checked = count > 0 && flaggedCount === count;
  const indeterminate = flaggedCount > 0 && flaggedCount < count;

  const toggle = async () => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    if (!annotationId || decoded.length === 0 || !annotation) return;

    // Read the raw record so we never write resolved pixel-space points back.
    const record = await db.annotations.get(annotationId);
    if (!record) return;

    // Group selected segIdx by ring.
    const byRing = new Map();
    for (const { ringKey, segIdx } of decoded) {
      if (!byRing.has(ringKey)) byRing.set(ringKey, new Set());
      byRing.get(ringKey).add(segIdx);
    }

    // If every selected segment is already flagged → remove all, else add all.
    // buildSegmentFlagChanges persists the flag as start-point ids (mapped from
    // the resolved rings), clears the mutually-exclusive opposite flag on the
    // same segments when adding, and migrates the row off the legacy idx
    // fields on first write.
    const setFlag = !checked;
    const ops = [...byRing].map(([ringKey, segIdxs]) => ({
      idxField: field,
      ringKey,
      segIdxs: [...segIdxs],
      mode: setFlag ? "set" : "remove",
      clearIdxField: clearField,
    }));

    const changes = buildSegmentFlagChanges({
      record,
      resolvedAnnotation: annotation,
      ops,
    });
    if (changes) await db.annotations.update(annotationId, changes);
  };

  return { checked, indeterminate, count, toggle };
}
