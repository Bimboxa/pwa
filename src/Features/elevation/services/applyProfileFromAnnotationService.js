import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

import getProfileSectionUp, {
  isUprightSectionUp,
  toSectionSample,
} from "../utils/getProfileSectionUp";
import getProfileSourceSignature from "../utils/getProfileSourceSignature";
import readProfileSourceDrawing from "../utils/readProfileSourceDrawing";

// Draws a profileLine on the target POLYLINE from a SOURCE annotation flagged
// `isProfile` (a COMPLETELY FREE polyline drawn on an elevation drawing — Z /
// U shapes welcome): the source X axis becomes the SIGNED section abscissa
// and the source Y axis the heights, both scaled to meters via the source
// baseMap's meterByPx.
//
// Orientation: by default the drawing is read RELATIVE to the target's base
// map (heights along its normal). A profile drawn on a VERTICAL base map and
// applied on a guide of a VERTICAL base map keeps its vertical instead — its
// Y axis follows the world vertical (the in-plane perpendicular of the guide)
// and its X axis the base map normal; the line then carries `sectionUp`
// (see getProfileSectionUp).
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
// The line also stores `seedSegmentIndex` and `sourceSignature` (the source
// drawing as read — getProfileSourceSignature) so useProfileLinesSourceSync
// can re-apply it automatically, at the same place, when the source changes.
//
// Replaces the profileLine at `profileIndex` when given (its old point rows
// are deleted), else appends a new line. Returns the written line's index, or
// null when the inputs are degenerate.
export default async function applyProfileFromAnnotationService({
  annotationId,
  sourceAnnotationId,
  profileIndex = null,
  // Guide segment the profile is laid on. Not an integer → the replaced
  // line's own segment (stored, else inferred from its plan chain), else 0.
  seedSegmentIndex = null,
  // Which extremity of the polyline projection the base point touches:
  // false = nearest one (default), true = the opposite one ("Inverser").
  invert = false,
  // Side of the guide the section extends on: the source X axis maps onto
  // the seed segment's right normal by default; `mirror` flips it (the
  // profile swaps sides, the base point stays on the guide — see
  // mirrorProfileLineService). Re-applied as stored on the line.
  mirror = false,
  // Automatic re-application (source sync): a real, audited edit of the
  // target that must not land on the undo stack (tx.skipUndo).
  skipUndo = false,
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
  const srcRows = await db.points.bulkGet(
    (src.points ?? []).map((p) => p?.id).filter(Boolean)
  );
  // Fingerprint of the source as read here (stored on the line for the sync).
  const sourceSignature = getProfileSourceSignature({
    src,
    srcRows,
    srcBaseMap,
  });
  // Vertices, registration origin and the longest visible run — shared with
  // the menu thumbnails (readProfileSourceDrawing).
  const drawing = readProfileSourceDrawing({ src, srcRows, srcBaseMap });
  if (!drawing) return null;
  const { visiblePts, xRef, yRef } = drawing;
  // Unscaled source drawings fall back to the target scale (1 px = 1 px).
  const srcMeterByPx = drawing.meterByPx || meterByPx;

  // --- plan placement: along the seed segment's normal through its midpoint.
  // The registration origin (s = 0, i.e. the base point) is placed ON an
  // EXTREMITY of the polyline's projection onto that axis (the two small
  // vertices seen at the ends of the grey trait in the elevation view):
  // the nearest one by default, the opposite one with `invert`. ---
  // Seed segment on the RAW vertices (seedSegmentIndex is a raw-chain index).
  const n = guideRaw.length;
  const segCount = isClosed ? n : n - 1;
  const prevLines = Array.isArray(ann.profileLines) ? ann.profileLines : [];
  const replaces =
    Number.isInteger(profileIndex) && prevLines[profileIndex] != null;
  const replacedLine = replaces ? prevLines[profileIndex] : null;
  let seed = seedSegmentIndex;
  if (!Number.isInteger(seed) && replacedLine) {
    seed = Number.isInteger(replacedLine.seedSegmentIndex)
      ? replacedLine.seedSegmentIndex
      : await inferSeedSegmentIndex(
          replacedLine,
          guideRaw,
          segCount,
          imageSize
        );
  }
  const i0 = Number.isInteger(seed) && seed >= 0 && seed < segCount ? seed : 0;
  const A = guideRaw[i0];
  const B = guideRaw[(i0 + 1) % n];
  const segLen = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  // right-of-tangent normal (same convention as getInlineExtrusionSetup)
  const nx = (B.y - A.y) / segLen;
  const ny = -(B.x - A.x) / segLen;
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };

  // Section samples (SIGNED abscissa — the shape is free, Z / U fold-backs
  // included), relative to the registration origin (the base point sits at
  // s = 0, height = 0): `a` along the drawing's X axis (the side, flipped by
  // `mirror`), `b` up its Y axis, in meters. `sectionUp` turns them into the
  // plan abscissa (along the seed normal) and the height (along the base map
  // normal) — a profile drawn on a VERTICAL base map keeps its vertical on a
  // VERTICAL target (getProfileSectionUp).
  const sideSign = mirror ? -1 : 1;
  const sectionUp = getProfileSectionUp({
    sourceBaseMap: srcBaseMap,
    targetBaseMap: baseMap,
    segA: A,
    segB: B,
  });
  const samples = visiblePts.map((p) => {
    const a = sideSign * (p.x - xRef) * srcMeterByPx;
    const b = (yRef - p.y) * srcMeterByPx;
    const { s, height } = toSectionSample(a, b, sectionUp);
    return {
      s: s / meterByPx, // target plan px
      height, // meters
      type: p.type,
    };
  });

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
    ...(drawing.closed ? { closeLine: true } : {}),
    sourceAnnotationId,
    sourceInvert: Boolean(invert),
    mirror: Boolean(mirror),
    seedSegmentIndex: i0,
    ...(sourceSignature ? { sourceSignature } : {}),
    // Kept only when the profile was laid upright: « Inverser » must then
    // flip the heights, not the plan chain (mirrorProfileLineService).
    ...(isUprightSectionUp(sectionUp) ? { sectionUp } : {}),
  };

  const oldPointIds = replaces
    ? (prevLines[profileIndex].points ?? [])
        .map((r) => r?.pointId)
        .filter(Boolean)
    : [];
  const profileLines = replaces
    ? prevLines.map((l, i) => (i === profileIndex ? newLine : l))
    : [...prevLines, newLine];
  const writtenIndex = replaces ? profileIndex : prevLines.length;

  await db.transaction("rw", db.points, db.annotations, async (tx) => {
    if (skipUndo) tx.skipUndo = true;
    for (const id of oldPointIds) await db.points.delete(id);
    for (const np of newPoints) await db.points.add(np);
    await db.annotations.update(annotationId, { profileLines });
  });

  if (dispatch) dispatch(triggerAnnotationsUpdate());
  return writtenIndex;
}

// Legacy lines (written before `seedSegmentIndex` was stored): the raw guide
// segment nearest to the line's plan chain — the chain is laid on the seed
// segment's normal through its midpoint, so that segment is the closest one.
async function inferSeedSegmentIndex(line, guideRaw, segCount, imageSize) {
  const ids = (line?.points ?? []).map((r) => r?.pointId).filter(Boolean);
  if (!ids.length || segCount < 1) return null;
  const rows = await db.points.bulkGet(ids);
  const pts = rows
    .filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .map((p) => ({ x: p.x * imageSize.width, y: p.y * imageSize.height }));
  if (!pts.length) return null;
  const n = guideRaw.length;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < segCount; i += 1) {
    const a = guideRaw[i];
    const b = guideRaw[(i + 1) % n];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let d = 0;
    for (const p of pts) {
      let t = len2 > 1e-18 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      d += Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
    }
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
