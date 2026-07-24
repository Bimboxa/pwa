import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Draws a profileLine on the target POLYLINE from a SOURCE annotation flagged
// `isProfile` (a COMPLETELY FREE polyline drawn on an elevation drawing — Z /
// U shapes welcome): the source X axis becomes the SIGNED section abscissa
// and the source Y axis the heights, both scaled to meters via the source
// baseMap's meterByPx.
//
// Registration:
//   - the source vertex flagged `isBasePoint` ("Point de référence") is the
//     origin (s = 0, height = 0). It is POSITIONED ON the guide crossing —
//     which projects onto the nearest extremity of the polyline projection in
//     the section view — so the extrusion registers exactly on the guide.
//     Without a base point, the origin falls back to the first vertex's x /
//     the lowest vertex's y.
//   - segments listed in the source's `hiddenSegmentsIdx` are NOT drawn (the
//     longest visible run is kept) — typically used to hold the base point
//     at a distance from the real start of the profile.
//
// The generated plan chain is laid along the NORMAL of the target's seed
// segment through its midpoint (the base point AT the midpoint, so the
// profile crosses the guide there). The plan points are collinear on that
// axis — in 2D the profile reads as a plain segment, its own projection. The
// line stores `sourceAnnotationId` so it can be re-generated ("Actualiser")
// after the source annotation is edited.
//
// Replaces the profileLine at `profileIndex` when given (its old point rows
// are deleted), else appends a new line. Returns the written line's index, or
// null when the inputs are degenerate.
export default async function applyProfileFromAnnotationService({
  annotationId,
  sourceAnnotationId,
  profileIndex = null,
  seedSegmentIndex = 0,
  // Which extremity of the polyline projection the base point touches:
  // false = nearest one (default), true = the opposite one ("Inverser").
  invert = false,
  dispatch,
}) {
  if (!annotationId || !sourceAnnotationId) return null;

  // --- target annotation + its baseMap frame ---
  const ann = await db.annotations.get(annotationId);
  if (!ann) return null;
  const baseMap = await db.baseMaps.get(ann.baseMapId);
  const imageSize = baseMap?.image?.imageSize;
  const meterByPx = baseMap?.meterByPx;
  if (!imageSize?.width || !imageSize?.height || !meterByPx) return null;

  const targetRefs = (ann.points ?? []).filter((p) => p?.id);
  const targetRows = await db.points.bulkGet(targetRefs.map((p) => p.id));
  const guideRaw = targetRefs
    .map((ref, i) => {
      const p = targetRows[i];
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
      return {
        x: p.x * imageSize.width,
        y: p.y * imageSize.height,
        type: ref.type,
      };
    })
    .filter(Boolean);
  if (guideRaw.length < 2) return null;
  const isClosed = ann.closeLine || ann.type === "POLYGON";
  // Arc-expand EXACTLY like the elevation section view (guideTrait) and the
  // 3D sweep, so the projection extremities computed here coincide with the
  // grey trait's ends on screen — anchoring on raw chord vertices would stop
  // SHORT of an arc's real bulge.
  const guidePts = expandArcsInPath(guideRaw, 6, !!isClosed);
  if (guidePts.length < 2) return null;

  // --- source annotation (the "profil" drawing) in ITS pixel frame ---
  const src = await db.annotations.get(sourceAnnotationId);
  if (!src) return null;
  const srcBaseMap = await db.baseMaps.get(src.baseMapId);
  const srcImageSize = srcBaseMap?.image?.imageSize;
  // Unscaled source drawings fall back to the target scale (1 px = 1 px).
  const srcMeterByPx = srcBaseMap?.meterByPx || meterByPx;
  if (!srcImageSize?.width || !srcImageSize?.height) return null;

  const srcRefs = src.points ?? [];
  const srcRows = await db.points.bulkGet(
    srcRefs.map((p) => p?.id).filter(Boolean)
  );
  const srcPts = srcRefs
    .map((ref, i) => {
      const p = srcRows[i];
      if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
      return {
        x: p.x * srcImageSize.width,
        y: p.y * srcImageSize.height,
        // preserve arc control points (S-C-S) — the section curve supports
        // them natively
        type: ref?.type === "circle" ? "circle" : "square",
        isBasePoint: Boolean(ref?.isBasePoint),
      };
    })
    .filter(Boolean);
  if (srcPts.length < 2) return null;

  // Registration origin: the "Point de référence" vertex (may live on a
  // hidden spacer segment). Fallback: first vertex x / lowest vertex y.
  const refPt = srcPts.find((p) => p.isBasePoint) ?? null;
  const xRef = refPt ? refPt.x : srcPts[0].x;
  const yRef = refPt ? refPt.y : Math.max(...srcPts.map((p) => p.y));

  // Drop hidden segments: keep the LONGEST visible run of consecutive
  // segments (the drawn shape must stay one polyline).
  const hiddenSet = new Set(
    (Array.isArray(src.hiddenSegmentsIdx) ? src.hiddenSegmentsIdx : []).filter(
      (i) => Number.isInteger(i)
    )
  );
  // A closed source (circle / closed polyline) stays closed only when nothing
  // was hidden — hiding a segment cuts the loop into an open run.
  const srcClosed = !!src.closeLine;
  let visiblePts = srcPts;
  if (hiddenSet.size) {
    const runs = [];
    let run = null;
    for (let i = 0; i < srcPts.length - 1; i += 1) {
      if (hiddenSet.has(i)) {
        run = null;
        continue;
      }
      if (!run) {
        run = { start: i, end: i + 1, length: 0 };
        runs.push(run);
      }
      run.end = i + 1;
      run.length += Math.hypot(
        srcPts[i + 1].x - srcPts[i].x,
        srcPts[i + 1].y - srcPts[i].y
      );
    }
    if (!runs.length) return null;
    const best = runs.reduce((a, b) => (b.length > a.length ? b : a));
    visiblePts = srcPts.slice(best.start, best.end + 1);
  }
  if (visiblePts.length < 2) return null;

  // Section samples (SIGNED abscissa — the shape is free, Z / U fold-backs
  // included): s relative to the reference x, height up from the reference y
  // (the base point sits at s = 0, height = 0).
  const samples = visiblePts.map((p) => ({
    s: ((p.x - xRef) * srcMeterByPx) / meterByPx, // target plan px
    height: (yRef - p.y) * srcMeterByPx, // meters
    type: p.type,
  }));

  // --- plan placement: along the seed segment's normal through its midpoint.
  // The registration origin (s = 0, i.e. the base point) is placed ON an
  // EXTREMITY of the polyline's projection onto that axis (the two small
  // vertices seen at the ends of the grey trait in the elevation view):
  // the nearest one by default, the opposite one with `invert`. ---
  // Seed segment on the RAW vertices (seedSegmentIndex is a raw-chain index).
  const n = guideRaw.length;
  const segCount = isClosed ? n : n - 1;
  const i0 =
    Number.isInteger(seedSegmentIndex) &&
    seedSegmentIndex >= 0 &&
    seedSegmentIndex < segCount
      ? seedSegmentIndex
      : 0;
  const A = guideRaw[i0];
  const B = guideRaw[(i0 + 1) % n];
  const segLen = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  // right-of-tangent normal (same convention as getInlineExtrusionSetup)
  const nx = (B.y - A.y) / segLen;
  const ny = -(B.x - A.x) / segLen;
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };

  // Polyline projection extremities on the axis (abscissa relative to M).
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const p of guidePts) {
    const t = (p.x - M.x) * nx + (p.y - M.y) * ny;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }
  const nearT = Math.abs(tMin) <= Math.abs(tMax) ? tMin : tMax;
  const farT = nearT === tMin ? tMax : tMin;
  const tStar = invert ? farT : nearT;

  const newPoints = samples.map((smp) => ({
    id: nanoid(),
    x: (M.x + nx * (smp.s + tStar)) / imageSize.width,
    y: (M.y + ny * (smp.s + tStar)) / imageSize.height,
    projectId: ann.projectId,
    baseMapId: ann.baseMapId,
    listingId: ann.listingId,
  }));

  const newLine = {
    points: samples.map((smp, i) => ({
      pointId: newPoints[i].id,
      type: smp.type,
      height: smp.height,
    })),
    // Closed cross-section (circle…): the section renderer draws the closing
    // segment / arc back to the first vertex. Only when the whole loop survives
    // (no hidden slicing).
    ...(srcClosed && visiblePts === srcPts ? { closeLine: true } : {}),
    sourceAnnotationId,
    sourceInvert: Boolean(invert),
  };

  const prevLines = Array.isArray(ann.profileLines) ? ann.profileLines : [];
  const replaces =
    Number.isInteger(profileIndex) && prevLines[profileIndex] != null;
  const oldPointIds = replaces
    ? (prevLines[profileIndex].points ?? [])
        .map((r) => r?.pointId)
        .filter(Boolean)
    : [];
  const profileLines = replaces
    ? prevLines.map((l, i) => (i === profileIndex ? newLine : l))
    : [...prevLines, newLine];
  const writtenIndex = replaces ? profileIndex : prevLines.length;

  await db.transaction("rw", db.points, db.annotations, async () => {
    for (const id of oldPointIds) await db.points.delete(id);
    for (const np of newPoints) await db.points.add(np);
    await db.annotations.update(annotationId, { profileLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return writtenIndex;
}
