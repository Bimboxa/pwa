import buildAnnotationEdgeRings from "./buildAnnotationEdgeRings";
import findSharedEdgeChains from "./findSharedEdgeChains";
import computeAutoWallChains from "./computeAutoWallChains";

// Shared "Parois auto" computation: from a selected POLYGON/POLYLINE and the
// other annotations on the same baseMap, find the boundary portions shared with
// adjacent surfaces (1 cm tolerance) and turn them into vertical wall chains
// (per-vertex offsetBottom/offsetTop, iso/stairs aware).
//
// Extracted from useApplyAutoWalls so both "Générer" (creates new wall
// annotations) and "Convertir en paroie" (updates the selected annotation in
// place) run EXACTLY the same geometry. Pure (no hooks / no db) — node-replayable
// like the utils it composes.
//
// Returns:
//   { ok: true, wallChains, imageSize, meterByPx }
//   { ok: false, errorKey, imageSize?, meterByPx? }
// errorKey ∈ INVALID_SELECTION | NO_IMAGE_SIZE | NO_SCALE | NO_ADJACENT_EDGE |
//            NO_WALLS

const THRESHOLD_M = 0.01; // 1 cm adjacency tolerance

export default function getSelectedAnnotationWallChains({
  selectedAnnotation,
  annotations,
  baseMap,
}) {
  const selected = selectedAnnotation;
  if (!selected?.id || !["POLYGON", "POLYLINE"].includes(selected.type)) {
    return { ok: false, errorKey: "INVALID_SELECTION" };
  }

  const imageSize = baseMap?.image?.imageSize;
  if (!imageSize?.width || !imageSize?.height) {
    return { ok: false, errorKey: "NO_IMAGE_SIZE" };
  }

  const meterByPx = baseMap?.getMeterByPx?.();
  if (!meterByPx || meterByPx <= 0) {
    return { ok: false, errorKey: "NO_SCALE", imageSize };
  }

  const thresholdPx = THRESHOLD_M / meterByPx;

  // Candidates: other surfaces on the same baseMap. Wall-like polylines
  // (previous auto walls, slope walls with per-vertex offsetBottom) are
  // excluded — their top is not a surface top, chaining walls to walls creates
  // noise. Plain-height polylines (e.g. acrotères) stay valid.
  const candidates = (annotations ?? []).filter(
    (a) =>
      ["POLYGON", "POLYLINE"].includes(a.type) &&
      a.baseMapId === selected.baseMapId &&
      a.id !== selected.id &&
      a.autoGenKind !== "AUTO_WALLS" &&
      !(
        a.type === "POLYLINE" &&
        a.points?.some(
          (p) => (p.offsetBottom ?? 0) !== 0 || (p.offsetTop ?? 0) !== 0
        )
      )
  );

  const sourceRings = buildAnnotationEdgeRings(selected);
  const neighbors = candidates
    .map((a) => ({ annotation: a, rings: buildAnnotationEdgeRings(a) }))
    .filter((n) => n.rings.length);

  const sharedChains = findSharedEdgeChains({
    sourceRings,
    neighbors,
    thresholdPx,
  });
  if (!sharedChains.length) {
    return { ok: false, errorKey: "NO_ADJACENT_EDGE", imageSize, meterByPx };
  }

  const wallChains = computeAutoWallChains({
    selectedAnnotation: selected,
    sharedChains,
    thresholdPx,
    meterByPx,
  });
  if (!wallChains.length) {
    return { ok: false, errorKey: "NO_WALLS", imageSize, meterByPx };
  }

  return { ok: true, wallChains, imageSize, meterByPx };
}
