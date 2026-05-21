import { useMemo } from "react";
import { useSelector } from "react-redux";

import {
  selectSelectedItem,
  selectSelectedPartIds,
  selectSelectedPointIds,
} from "Features/selection/selectionSlice";

import useSelectedAnnotation from "./useSelectedAnnotation";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getContiguousSegmentChain, {
  decodePartId,
  getContiguousSegmentChains,
} from "../utils/getContiguousSegmentChain";
import getAnnotationQties from "../utils/getAnnotationQties";

// Partition selected partIds by their kind (segments vs cut segments vs
// whole cuts) so the multi-selection UI can branch by category.
function partitionPartIds(partIds) {
  const segments = [];
  const cutSegments = [];
  const cuts = [];
  (partIds || []).forEach((id) => {
    if (!id || typeof id !== "string") return;
    const partType = id.split("::")[1];
    if (partType === "SEG") segments.push(id);
    else if (partType === "CUT_SEG") cutSegments.push(id);
    else if (partType === "CUT") cuts.push(id);
  });
  return { segments, cutSegments, cuts };
}

// Build a richer view of the current annotation sub-selection (segment(s),
// cut/opening, vertex, guideLine) so toolbars / panels / clone code can branch
// on a single resolved object instead of decoding partId strings themselves.
//
// Returns: {
//   kind: "NONE" | "SEGMENT" | "SEGMENTS" | "CUT_SEG" | "CUT" | "POINT" | "GUIDE",
//   captionFr: string,           // "Segment" / "Segments" / "Ouverture" / "Point" / "Guide"
//   label: string,               // user-facing detail (e.g. "Segment 3", "Ouverture #1", "2 segments")
//   pointRefs: [{id, ...}],       // ordered DB-style refs spanning the part (used for clone)
//   geometryPx: [{x, y, ...}],    // same as pointRefs but in pixel space (used for measurements)
//   contiguous?: boolean,        // for SEGMENTS — false when chain is broken
//   targetAnnotationType: "POLYLINE" | "POLYGON" | null,  // suggested type for a clone
// }
//
// Returns { kind: "NONE" } when no annotation is selected or the selection is
// on the whole annotation (partType === "MAIN" or no part).
export default function useSelectedAnnotationPart() {
  const selectedItem = useSelector(selectSelectedItem);
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const selectedPointIds = useSelector(selectSelectedPointIds);
  const annotation = useSelectedAnnotation();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  return useMemo(() => {
    if (!annotation || !selectedItem) return { kind: "NONE" };

    const { partId, partType, pointId } = selectedItem;
    const effectivePartType =
      partType ||
      (selectedPartIds.length > 0
        ? decodePartId(selectedPartIds[0])?.ringKey === "MAIN"
          ? "SEG"
          : "CUT_SEG"
        : null);

    // --- MIXED selection: points AND segments simultaneously ---------------
    // Detect this BEFORE the single-kind branches so heterogeneous lasso
    // selections (points + segments together) get the sectioned UI.
    const partition = partitionPartIds(selectedPartIds);
    const totalPartsSelected =
      partition.segments.length + partition.cutSegments.length + partition.cuts.length;
    const hasMultiplePoints = selectedPointIds.length >= 1;
    const isMixed =
      (hasMultiplePoints && totalPartsSelected > 0) ||
      (selectedPointIds.length >= 2 && totalPartsSelected === 0) ||
      (partition.cuts.length > 0 && (partition.segments.length + partition.cutSegments.length) > 0);

    if (isMixed) {
      const groups = buildGroups({
        annotation,
        pointIds: selectedPointIds,
        partition,
        meterByPx,
      });
      const totalCount = groups.reduce((acc, g) => acc + g.count, 0);
      return {
        kind: "MIXED",
        captionFr: "Multi-sélection",
        label: groups
          .map((g) => `${g.count} ${g.captionFr.toLowerCase()}${g.count > 1 ? "s" : ""}`)
          .join(", ") || `${totalCount} éléments`,
        groups,
        pointIds: selectedPointIds,
        partIds: selectedPartIds,
        targetAnnotationType: null,
      };
    }

    if (!effectivePartType || effectivePartType === "MAIN") {
      return { kind: "NONE" };
    }

    // --- VERTEX (single point) -------------------------------------------------
    if (effectivePartType === "VERTEX" || pointId || selectedPointIds.length > 0) {
      const id = pointId || selectedPointIds[0];
      if (!id) return { kind: "NONE" };
      const found = findPointInAnnotation(annotation, id);
      if (!found) return { kind: "NONE" };
      return {
        kind: "POINT",
        captionFr: "Point",
        label: found.label,
        pointRefs: [found.ref],
        geometryPx: [found.pointPx],
        targetAnnotationType: null,
      };
    }

    // --- GUIDE (whole guideLine) ----------------------------------------------
    if (effectivePartType === "GUIDE") {
      const guidePx = annotation.guideLine || [];
      if (guidePx.length < 2) return { kind: "NONE" };
      return {
        kind: "GUIDE",
        captionFr: "Guide",
        label: `Guide (${guidePx.length} points)`,
        pointRefs: guidePx,
        geometryPx: guidePx,
        targetAnnotationType: "POLYLINE",
      };
    }

    // --- CUT (whole opening) --------------------------------------------------
    if (effectivePartType === "CUT") {
      // partId form: "{annotationId}::CUT::{cutIdx}"
      const cutIdx = Number(partId?.split("::")[2]);
      if (!Number.isFinite(cutIdx)) return { kind: "NONE" };
      const cut = annotation.cuts?.[cutIdx];
      const cutPoints = cut?.points || [];
      if (cutPoints.length < 3) return { kind: "NONE" };
      return {
        kind: "CUT",
        captionFr: "Ouverture",
        label: `Ouverture #${cutIdx + 1}`,
        pointRefs: cutPoints,
        geometryPx: cutPoints,
        targetAnnotationType: "POLYGON",
        cutIdx,
      };
    }

    // --- SEGMENT / SEGMENTS (single or chain on main or cut ring) -------------
    if (effectivePartType === "SEG" || effectivePartType === "CUT_SEG") {
      // Multi-selection takes priority when 2+ parts are queued.
      const effectivePartIds =
        selectedPartIds.length >= 2
          ? selectedPartIds
          : partId
            ? [partId]
            : [];

      if (effectivePartIds.length === 0) return { kind: "NONE" };

      const chain = getContiguousSegmentChain(annotation, effectivePartIds);

      if (effectivePartIds.length === 1) {
        // Single segment — resolve directly so we still get geometry when the
        // single-item path of the chain util returns "contiguous: true" with 2 pts.
        const refs = chain.contiguous ? chain.pointRefs : null;
        if (!refs || refs.length < 2) return { kind: "NONE" };
        const isCut = effectivePartType === "CUT_SEG";
        const segIdx = chain.startSegIdx;
        return {
          kind: isCut ? "CUT_SEG" : "SEGMENT",
          captionFr: "Segment",
          label: `Segment ${segIdx + 1}`,
          pointRefs: refs,
          geometryPx: refs,
          targetAnnotationType: "POLYLINE",
          contiguous: true,
          ringKey: chain.ringKey,
        };
      }

      // Multi-segment — always compute the full set of contiguous chains so
      // the toolbar / clone hook can batch-create one polyline per chain.
      const chains = getContiguousSegmentChains(annotation, effectivePartIds);
      const contiguous = chains.length === 1;

      return {
        kind: "SEGMENTS",
        captionFr: "Segments",
        label: contiguous
          ? `${effectivePartIds.length} segments`
          : `${effectivePartIds.length} segments (${chains.length} chaînes)`,
        pointRefs: contiguous ? chains[0]?.pointRefs ?? [] : [],
        geometryPx: contiguous ? chains[0]?.pointRefs ?? [] : [],
        targetAnnotationType: "POLYLINE",
        contiguous,
        chains,
        ringKey: contiguous ? chains[0]?.ringKey : null,
      };
    }

    return { kind: "NONE" };
  }, [annotation, selectedItem, selectedPartIds, selectedPointIds, meterByPx]);
}

// Build the sections shown by the mixed-selection UI. Each group describes a
// homogeneous bucket the user can inspect or trim independently. Each group
// carries `length` / `surface` in meters (or null when not applicable) so the
// toolbar can render measurements identical to the multi-annotation pattern.
function buildGroups({ annotation, pointIds, partition, meterByPx }) {
  const groups = [];

  if (pointIds.length > 0) {
    const items = pointIds.map((id) => {
      const hit = findPointInAnnotation(annotation, id);
      return {
        id,
        label: hit?.label || `Point`,
        pointPx: hit?.pointPx,
      };
    });
    groups.push({
      kind: "POINTS",
      captionFr: "Point",
      count: items.length,
      items,
    });
  }

  const segIds = [...partition.segments, ...partition.cutSegments];
  if (segIds.length > 0) {
    const items = segIds.map((id) => {
      const decoded = decodePartId(id);
      return {
        id,
        label:
          decoded?.ringKey === "MAIN"
            ? `Segment ${decoded.segIdx + 1}`
            : `Segment ouverture #${Number(decoded?.ringKey?.split("::")[1]) + 1} (${decoded?.segIdx + 1})`,
      };
    });
    const totalLength = sumSegmentsLength({ annotation, segIds, meterByPx });
    groups.push({
      kind: "SEGMENTS",
      captionFr: "Segment",
      count: items.length,
      items,
      length: totalLength,
      surface: null,
    });
  }

  if (partition.cuts.length > 0) {
    const items = partition.cuts.map((id) => {
      const idx = Number(id.split("::")[2]);
      return { id, label: `Ouverture #${idx + 1}` };
    });
    const { length: cutsLength, surface: cutsSurface } = sumCutsMetrics({
      annotation,
      cutPartIds: partition.cuts,
      meterByPx,
    });
    groups.push({
      kind: "CUTS",
      captionFr: "Ouverture",
      count: items.length,
      items,
      length: cutsLength,
      surface: cutsSurface,
    });
  }

  return groups;
}

function sumSegmentsLength({ annotation, segIds, meterByPx }) {
  if (!annotation || !meterByPx) return null;
  let totalPx = 0;
  for (const id of segIds) {
    const decoded = decodePartId(id);
    if (!decoded) continue;
    const ringPoints =
      decoded.ringKey === "MAIN"
        ? annotation.points
        : annotation.cuts?.[Number(decoded.ringKey.split("::")[1])]?.points;
    const ringLen = ringPoints?.length ?? 0;
    if (ringLen < 2) continue;
    const isClosed =
      decoded.ringKey === "MAIN"
        ? annotation.type === "POLYGON" || annotation.closeLine === true
        : true;
    const i0 = decoded.segIdx;
    const i1 = (i0 + 1) % ringLen;
    if (!isClosed && i0 >= ringLen - 1) continue;
    const p0 = ringPoints[i0];
    const p1 = ringPoints[i1];
    if (!p0 || !p1) continue;
    totalPx += Math.hypot(p1.x - p0.x, p1.y - p0.y);
  }
  return totalPx * meterByPx;
}

function sumCutsMetrics({ annotation, cutPartIds, meterByPx }) {
  if (!annotation || !meterByPx) return { length: null, surface: null };
  let totalLength = 0;
  let totalSurface = 0;
  for (const id of cutPartIds) {
    const cutIdx = Number(id.split("::")[2]);
    const cut = annotation.cuts?.[cutIdx];
    if (!cut?.points || cut.points.length < 3) continue;
    const qty = getAnnotationQties({
      annotation: { type: "POLYGON", points: cut.points },
      meterByPx,
    });
    totalLength += qty?.length || 0;
    totalSurface += qty?.surface || 0;
  }
  return {
    length: totalLength > 0 ? totalLength : null,
    surface: totalSurface > 0 ? totalSurface : null,
  };
}

function findPointInAnnotation(annotation, pointId) {
  const rings = [
    { ring: annotation.points, label: "Sommet" },
    ...((annotation.cuts || []).map((c, i) => ({
      ring: c?.points,
      label: `Sommet ouverture #${i + 1}`,
    }))),
    { ring: annotation.innerPoints, label: "Point intérieur" },
    { ring: annotation.guideLine, label: "Point guide" },
  ];
  for (const { ring, label } of rings) {
    if (!Array.isArray(ring)) continue;
    const idx = ring.findIndex((p) => p && p.id === pointId);
    if (idx >= 0) {
      return { ref: ring[idx], pointPx: ring[idx], label: `${label} ${idx + 1}` };
    }
  }
  return null;
}
