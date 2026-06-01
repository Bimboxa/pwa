import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import { decodePartId } from "Features/annotations/utils/getContiguousSegmentChain";

import db from "App/db/db";

const ringIdxList = (annotation, ringKey) => {
  if (ringKey === "MAIN") return annotation?.isExtEdgeSegmentsIdx || [];
  const cutIdx = Number(ringKey.split("::")[1]);
  return annotation?.cuts?.[cutIdx]?.isExtEdgeSegmentsIdx || [];
};

// Unified state + bulk toggle for the per-segment `isExtEdge` flag ("Segment
// extérieur"), stored as `isExtEdgeSegmentsIdx` on the annotation main contour
// and on each `annotation.cuts[cutIdx]`. Handles both single-segment selection
// (selectedItem.partId) and multi-segment selection (selectedPartIds).
//
// Returns { checked, indeterminate, count, toggle }:
//   - checked       : every selected segment is already flagged
//   - indeterminate : some-but-not-all selected segments are flagged
//   - toggle()      : if all flagged → unset all, else → set all (single write)
export default function useSegmentsExtEdge() {
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
    ringIdxList(annotation, d.ringKey).includes(d.segIdx)
  );
  const count = decoded.length;
  const flaggedCount = flags.filter(Boolean).length;
  const checked = count > 0 && flaggedCount === count;
  const indeterminate = flaggedCount > 0 && flaggedCount < count;

  const toggle = async () => {
    const annotationId = selectedItem?.nodeId || selectedItem?.id;
    if (!annotationId || decoded.length === 0) return;

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
    const setExt = !checked;

    const applyToList = (current, segIdxs) => {
      const next = new Set(current || []);
      for (const idx of segIdxs) {
        if (setExt) next.add(idx);
        else next.delete(idx);
      }
      return [...next].sort((a, b) => a - b);
    };

    const update = {};

    const mainSegs = byRing.get("MAIN");
    if (mainSegs) {
      update.isExtEdgeSegmentsIdx = applyToList(
        record.isExtEdgeSegmentsIdx,
        mainSegs
      );
    }

    const cutRings = [...byRing.keys()].filter((k) => k !== "MAIN");
    if (cutRings.length > 0) {
      const cuts = record.cuts || [];
      update.cuts = cuts.map((cut, i) => {
        const segs = byRing.get(`CUT::${i}`);
        if (!segs) return cut;
        return {
          ...cut,
          isExtEdgeSegmentsIdx: applyToList(cut.isExtEdgeSegmentsIdx, segs),
        };
      });
    }

    if (Object.keys(update).length === 0) return;
    await db.annotations.update(annotationId, update);
  };

  return { checked, indeterminate, count, toggle };
}
