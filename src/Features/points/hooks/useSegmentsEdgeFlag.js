import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
} from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import { decodePartId } from "Features/annotations/utils/getContiguousSegmentChain";

import db from "App/db/db";

const ringIdxList = (annotation, ringKey, field) => {
  if (ringKey === "MAIN") return annotation?.[field] || [];
  const cutIdx = Number(ringKey.split("::")[1]);
  return annotation?.cuts?.[cutIdx]?.[field] || [];
};

// Unified state + bulk toggle for a per-segment edge flag stored as an array of
// segment indices on the annotation main contour (`annotation[field]`) and on
// each `annotation.cuts[cutIdx][field]`. Handles both single-segment selection
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
    const setFlag = !checked;

    const applyToList = (current, segIdxs) => {
      const next = new Set(current || []);
      for (const idx of segIdxs) {
        if (setFlag) next.add(idx);
        else next.delete(idx);
      }
      return [...next].sort((a, b) => a - b);
    };

    // When the flag is added, drop those segments from the opposite flag so the
    // two stay mutually exclusive. When the flag is removed, leave it alone.
    const clearList = (current, segIdxs) => {
      if (!setFlag || !clearField) return current;
      const next = new Set(current || []);
      let changed = false;
      for (const idx of segIdxs) {
        if (next.delete(idx)) changed = true;
      }
      return changed ? [...next].sort((a, b) => a - b) : current;
    };

    const update = {};

    const mainSegs = byRing.get("MAIN");
    if (mainSegs) {
      update[field] = applyToList(record[field], mainSegs);
      if (clearField) {
        const cleared = clearList(record[clearField], mainSegs);
        if (cleared !== record[clearField]) update[clearField] = cleared;
      }
    }

    const cutRings = [...byRing.keys()].filter((k) => k !== "MAIN");
    if (cutRings.length > 0) {
      const cuts = record.cuts || [];
      update.cuts = cuts.map((cut, i) => {
        const segs = byRing.get(`CUT::${i}`);
        if (!segs) return cut;
        const nextCut = { ...cut, [field]: applyToList(cut[field], segs) };
        if (clearField) {
          nextCut[clearField] = clearList(cut[clearField], segs);
        }
        return nextCut;
      });
    }

    if (Object.keys(update).length === 0) return;
    await db.annotations.update(annotationId, update);
  };

  return { checked, indeterminate, count, toggle };
}
