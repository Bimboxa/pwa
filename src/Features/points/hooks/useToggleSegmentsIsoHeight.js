import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import { decodePartId } from "Features/annotations/utils/getContiguousSegmentChain";

import db from "App/db/db";

const ringIdxList = (annotation, ringKey) => {
  if (ringKey === "MAIN") return annotation?.isoHeightSegmentsIdx || [];
  const cutIdx = Number(ringKey.split("::")[1]);
  return annotation?.cuts?.[cutIdx]?.isoHeightSegmentsIdx || [];
};

// Multi-segment counterpart of useToggleSegmentIsoHeight: unified state + bulk
// toggle for the per-segment `isoHeight` (contour line) flag, stored as
// `isoHeightSegmentsIdx` on the main contour and on each `annotation.cuts[i]`.
// Handles both single-segment selection (selectedItem.partId) and multi-segment
// selection (selectedPartIds). Mirrors useSegmentsExtEdge.
//
// Returns { checked, indeterminate, count, toggle }.
export default function useToggleSegmentsIsoHeight() {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const annotation = useSelectedAnnotation();

  const partIds =
    selectedPartIds.length >= 1
      ? selectedPartIds
      : selectedItem?.partId
        ? [selectedItem.partId]
        : [];

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

    const record = await db.annotations.get(annotationId);
    if (!record) return;

    const byRing = new Map();
    for (const { ringKey, segIdx } of decoded) {
      if (!byRing.has(ringKey)) byRing.set(ringKey, new Set());
      byRing.get(ringKey).add(segIdx);
    }

    const setIso = !checked;

    const applyToList = (current, segIdxs) => {
      const next = new Set(current || []);
      for (const idx of segIdxs) {
        if (setIso) next.add(idx);
        else next.delete(idx);
      }
      return [...next].sort((a, b) => a - b);
    };

    const update = {};

    const mainSegs = byRing.get("MAIN");
    if (mainSegs) {
      update.isoHeightSegmentsIdx = applyToList(
        record.isoHeightSegmentsIdx,
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
          isoHeightSegmentsIdx: applyToList(cut.isoHeightSegmentsIdx, segs),
        };
      });
    }

    if (Object.keys(update).length === 0) return;
    await db.annotations.update(annotationId, update);
  };

  return { checked, indeterminate, count, toggle };
}
