import getAnnotationStrokeWidthPx from "Features/geometry/utils/getAnnotationStrokeWidthPx";

// Snapshot one annotation's geometry (pixel-image space) into a paste-clipboard
// item. Pure — used by the Ctrl+C handler for both single and multi selection.
export function buildClipboardItem(ann, meterByPx) {
  const type = ann?.type;
  const item = { annotation: ann };
  if (
    type === "POLYGON" ||
    type === "POLYLINE" ||
    type === "STRIP" ||
    type === "RULER"
  ) {
    item.basePoints = (ann.points || []).map((p) => ({
      x: p.x,
      y: p.y,
      ...(p.type ? { type: p.type } : {}),
    }));
    if (type === "POLYGON") {
      item.baseCuts = (ann.cuts || []).map((cut) => ({
        id: cut.id,
        points: (cut.points || []).map((p) => ({
          x: p.x,
          y: p.y,
          ...(p.type ? { type: p.type } : {}),
        })),
      }));
    }
    if (type === "STRIP") {
      item.stripWidthPx = Math.abs(getAnnotationStrokeWidthPx(ann, meterByPx));
      item.stripOrientation = ann.stripOrientation ?? 1;
    }
    // Guide lines (slope/stairs ramp axes): snapshot resolved pixel geometry
    // + meta (slopePct, isStairs, ...) so paste can rebuild them with fresh
    // db.points. Without this the pasted annotation would keep refs to the
    // SOURCE's points and its guide line would stay at the original location.
    if (Array.isArray(ann.guideLines) && ann.guideLines.length) {
      item.baseGuideLines = ann.guideLines
        .map((gl) => {
          const { points, ...meta } = gl || {};
          return {
            ...meta,
            points: (points || [])
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({
                x: p.x,
                y: p.y,
                ...(p.type ? { type: p.type } : {}),
              })),
          };
        })
        .filter((gl) => gl.points.length >= 2);
    }
    // Iso height lines (constant-height contour lines): same snapshot logic as
    // guide lines — resolved pixel geometry + meta (height) so paste rebuilds
    // them with fresh db.points.
    if (Array.isArray(ann.isoHeightLines) && ann.isoHeightLines.length) {
      item.baseIsoHeightLines = ann.isoHeightLines
        .map((l) => {
          const { points, ...meta } = l || {};
          return {
            ...meta,
            points: (points || [])
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({
                x: p.x,
                y: p.y,
                ...(p.type ? { type: p.type } : {}),
              })),
          };
        })
        .filter((l) => l.points.length >= 2);
    }
    // Profile lines (shell cross-sections): same snapshot logic, but each
    // resolved vertex also carries an inline `height` (meters) to re-attach
    // on paste.
    if (Array.isArray(ann.profileLines) && ann.profileLines.length) {
      item.baseProfileLines = ann.profileLines
        .map((l) => {
          const { points, ...meta } = l || {};
          return {
            ...meta,
            points: (points || [])
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({
                x: p.x,
                y: p.y,
                ...(p.type ? { type: p.type } : {}),
                ...(typeof p.height === "number" ? { height: p.height } : {}),
              })),
          };
        })
        .filter((l) => l.points.length >= 2);
    }
    // Layout lines (lignes de calepinage): same snapshot logic, meta
    // (density / alignment / label / renderMode) carried as-is.
    if (Array.isArray(ann.layoutLines) && ann.layoutLines.length) {
      item.baseLayoutLines = ann.layoutLines
        .map((l) => {
          const { points, ...meta } = l || {};
          return {
            ...meta,
            points: (points || [])
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({ x: p.x, y: p.y })),
          };
        })
        .filter((l) => l.points.length >= 2);
    }
    // Height cuts (traces) and the seeds of their faces: same snapshot
    // logic, meta (delta / side / closeLine) carried as-is.
    for (const [field, baseField] of [
      ["heightCuts", "baseHeightCuts"],
      ["heightCutFaces", "baseHeightCutFaces"],
    ]) {
      if (!Array.isArray(ann[field]) || !ann[field].length) continue;
      item[baseField] = ann[field]
        .map((l) => {
          // `rawIndex` / `seed` are resolve-time only
          const { points, rawIndex: _rawIndex, seed: _seed, ...meta } = l || {};
          return {
            ...meta,
            points: (points || [])
              .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
              .map((p) => ({
                x: p.x,
                y: p.y,
                ...(p.type ? { type: p.type } : {}),
              })),
          };
        })
        .filter((l) => l.points.length >= 1);
    }
  } else if (type === "POINT" || type === "MARKER" || type === "DETAIL") {
    const p = ann.point || ann.targetPoint;
    if (!p) return null;
    item.basePoint = { x: p.x, y: p.y };
  } else {
    return null;
  }
  return item;
}

// Paste clipboard of a set of RESOLVED annotations (pixel-image space):
//   { sourceCenter, items, sourceMeterByPx }
// - items: one geometry snapshot per supported annotation (buildClipboardItem);
// - sourceCenter: center of the union bbox of every item's points. A single
//   shared center is what lets the whole group translate by one
//   (targetCenter − sourceCenter) and rotate / flip rigidly on paste;
// - sourceMeterByPx: scale of the map the copy was taken on — lets a paste on
//   a map with a different meterByPx preserve real-world dimensions.
// Returns null when no annotation produced an item.
// Consumed by pasteAnnotationService (Ctrl+C / Ctrl+V of the 2D editor, and
// the « Lier à un bloc » move of Features/blocks).
export default function buildPasteClipboard(annotations, meterByPx) {
  const items = (annotations ?? [])
    .map((ann) => buildClipboardItem(ann, meterByPx))
    .filter(Boolean);
  if (!items.length) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const acc = (p) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const it of items) {
    if (it.basePoints) it.basePoints.forEach(acc);
    if (it.baseCuts) it.baseCuts.forEach((c) => c.points.forEach(acc));
    if (it.baseGuideLines)
      it.baseGuideLines.forEach((g) => g.points.forEach(acc));
    if (it.baseIsoHeightLines)
      it.baseIsoHeightLines.forEach((l) => l.points.forEach(acc));
    if (it.baseProfileLines)
      it.baseProfileLines.forEach((l) => l.points.forEach(acc));
    if (it.baseLayoutLines)
      it.baseLayoutLines.forEach((l) => l.points.forEach(acc));
    if (it.basePoint) acc(it.basePoint);
  }
  const sourceCenter = Number.isFinite(minX)
    ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    : { x: 0, y: 0 };

  return { sourceCenter, items, sourceMeterByPx: meterByPx || null };
}
