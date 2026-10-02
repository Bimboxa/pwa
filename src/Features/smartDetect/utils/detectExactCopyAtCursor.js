import { getReferenceModel } from "./detectWallHoverCandidate.js";
import {
  buildOrientedGrid,
  columnStats,
  createProbe,
  createRangeStats,
  createTolerances,
  measureBandFaces,
  poolStats,
  profileDistance,
} from "./segmentBandFaces.js";
import { buildSegmentMatch } from "./detectCopiedSegmentAtCursor.js";

// Space on a copied two-point segment with « Copie exacte »: the copy keeps
// its length and is placed where the pixels look like the ones under the
// original, within the search radius around the cursor.
//
// The signature of the copy is two profiles read under it, in the corridor
// between its two faces. What borders a wall is left out: it changes from one
// wall to the next (paper, a colored surface, earth).
//  - across: one column per transverse offset (faces and interior), averaged
//    over the copied length;
//  - along: one column per axial position (the band, then what lies beyond
//    its two ends), averaged over the corridor width and pooled over about a
//    hatch pitch.
// Both average along one axis, which removes the hatch phase. Every placement
// in the radius is scored by the distance of both profiles to those of the
// copy; the nearest of the best ones wins, then the axis is centered on the
// faces found under it.

// Real-world lengths in meters (see SIZE in detectCopiedSegmentAtCursor).
const SIZE = {
  nominalBand: 0.2,
  // Face-to-face spacing accepted around the copied width (or 20 % of it).
  widthTolerance: 0.03,
  // What lies beyond the two ends of the band, read in its own corridor.
  beyondEnds: 0.1,
  // Axial pooling of the along profile, about a hatch pitch.
  pooling: 0.12,
  // Largest correction of the axis on the faces under the placed copy.
  recenter: 0.03,
};
const MIN_WIDTH_PX = 2;
// Largest mean difference of a profile still read as the same drawing.
const SIGNATURE_MAX = 0.15;
// Column differences below this are hatch phase left by a finite length.
const PHASE_NOISE = 0.05;
// The along profile of a long copy is compared on this many positions.
const AXIAL_SAMPLES = 160;
// Between equally good placements the nearest to the cursor wins.
const DISTANCE_WEIGHT = 0.06;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pixelCenter = (p) => ({
  x: Math.floor(p.x) + 0.5,
  y: Math.floor(p.y) + 0.5,
});

/**
 * Returns { match } with the same match shape as detectCopiedSegmentAtCursor,
 * or { match: null, reason } where reason is UNSUPPORTED_REFERENCE or
 * NO_SIGNATURE. `debug: true` adds a `trace`.
 */
export default function detectExactCopyAtCursor({
  clipboard,
  imageData,
  cursorImgPx,
  exclusionMask,
  imageScale = 1,
  imageOffset = { x: 0, y: 0 },
  meterByPx = 0,
  pasteTransform,
  baseMapId,
  searchRadiusImgPx,
  debug = false,
}) {
  const model =
    cursorImgPx &&
    getReferenceModel({
      clipboard,
      imageData,
      imageScale,
      imageOffset,
      meterByPx,
      pasteTransform,
      baseMapId,
      minWidth: MIN_WIDTH_PX,
    });
  if (!model || model.type === "POLYGON")
    return { match: null, reason: "UNSUPPORTED_REFERENCE" };
  const { width, length } = model;
  const tol = createTolerances(
    meterByPx > 0 ? meterByPx * imageScale : SIZE.nominalBand / width,
    width
  );
  const { px } = tol;
  const radius = Math.min(
    searchRadiusImgPx > 0 ? searchRadiusImgPx : 2 * width,
    Math.hypot(imageData.width, imageData.height)
  );
  const reach = Math.ceil(radius);
  const halfLength = Math.round(length / 2);
  const beyond = Math.round(px(SIZE.beyondEnds, 3));
  const tolerance = Math.max(px(SIZE.widthTolerance, 1.5), width * 0.2);
  const margin = Math.ceil(tolerance + tol.exterior + tol.reach + 2);
  const flip = pasteTransform?.flipX ? -1 : 1;

  // --- Signature of the copy, read on the raw bitmap under it
  const sourceOrigin = pixelCenter(model.center);
  const sourceProbe = createProbe(imageData, null, model, {
    excludeSource: false,
  });
  const offset = {
    x: model.center.x - sourceOrigin.x,
    y: model.center.y - sourceOrigin.y,
  };
  // Band center relative to the pixel-centered origin, across and along.
  const lateral = offset.x * model.n.x + offset.y * model.n.y;
  const axial = offset.x * model.u.x + offset.y * model.u.y;
  const sourceRows = { aMin: -halfLength, aMax: halfLength };
  // The corridor runs from face to face: the faces of the copy when they
  // show, its nominal width otherwise.
  const sourceFaces = measureBandFaces(
    buildOrientedGrid(
      sourceProbe,
      sourceOrigin,
      model.u,
      model.n,
      {
        ...sourceRows,
        tMin: -Math.ceil(width / 2) - margin,
        tMax: Math.ceil(width / 2) + margin,
      },
      tol
    ),
    lateral,
    width,
    tolerance / 2 + tol.reach / 2
  );
  const faced =
    sourceFaces.left?.support >= 0.5 && sourceFaces.right?.support >= 0.5;
  let lo = Math.ceil(
    (faced ? sourceFaces.left.t : lateral - width / 2) - 0.5 + 1e-6
  );
  let hi = Math.floor(
    (faced ? sourceFaces.right.t : lateral + width / 2) + 0.5 - 1e-6
  );
  const across = columnStats(
    buildOrientedGrid(
      sourceProbe,
      sourceOrigin,
      model.u,
      model.n,
      { ...sourceRows, tMin: lo, tMax: hi },
      tol
    )
  );
  // Pooling twice (a triangular window) leaves far less of a periodic ripple
  // than one box of the same size; `pad` extra positions keep the pooling
  // window whole at both ends of the profile.
  const pooling = Math.round(px(SIZE.pooling, 6));
  const pad = 2 * Math.ceil(pooling / 2);
  const pooled = (stats) =>
    poolStats(poolStats(stats, pooling), pooling).slice(pad, -pad);
  // Same frame with the axes swapped: rows across the band, columns along it.
  const along = pooled(
    columnStats(
      buildOrientedGrid(
        sourceProbe,
        sourceOrigin,
        model.n,
        model.u,
        {
          aMin: lo,
          aMax: hi,
          tMin: -halfLength - beyond - pad,
          tMax: halfLength + beyond + pad,
        },
        tol
      )
    )
  );
  // A mirrored copy reads its transverse profile the other way round.
  if (flip < 0) {
    across.reverse();
    [lo, hi] = [-hi, -lo];
  }

  // --- Every placement of that signature within the radius
  const baseAngle =
    Math.atan2(model.u.y, model.u.x * flip) +
    ((pasteTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const u = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  const n = { x: -u.y, y: u.x };
  const origin = pixelCenter(cursorImgPx);
  const probe = createProbe(imageData, exclusionMask, model);
  const acrossAt = createRangeStats(
    buildOrientedGrid(
      probe,
      origin,
      u,
      n,
      {
        aMin: -reach - halfLength,
        aMax: reach + halfLength,
        tMin: -reach + lo,
        tMax: reach + hi,
      },
      tol
    )
  );
  const alongAt = createRangeStats(
    buildOrientedGrid(
      probe,
      origin,
      n,
      u,
      {
        aMin: -reach + lo,
        aMax: reach + hi,
        tMin: -reach - halfLength - beyond - pad,
        tMax: reach + halfLength + beyond + pad,
      },
      tol
    )
  );
  // Profiles of the target for each shift: `across` over the copied length
  // shifted by da, `along` over the corridor shifted by dt.
  const acrossByShift = [],
    alongByShift = [];
  for (let shift = -reach; shift <= reach; shift++) {
    acrossByShift.push(acrossAt(shift + reach, shift + reach + 2 * halfLength));
    alongByShift.push(pooled(alongAt(shift + reach, shift + reach + hi - lo)));
  }
  const stride = Math.max(1, Math.ceil(along.length / AXIAL_SAMPLES));
  // The two ends weigh the same whatever the copied length: over the whole
  // profile, a long copy would dilute a misplaced end to nothing.
  const endZone = Math.min(along.length, 2 * (beyond + pad));
  const head = along.slice(0, endZone),
    tail = along.slice(-endZone);
  let best = null;
  for (let da = -reach; da <= reach; da++)
    for (let dt = -reach; dt <= reach; dt++) {
      const distance = Math.hypot(da, dt);
      if (distance > radius) continue;
      const acrossDistance = profileDistance(
        across,
        acrossByShift[da + reach],
        dt + reach,
        1,
        PHASE_NOISE
      );
      if (acrossDistance === null || acrossDistance >= SIGNATURE_MAX) continue;
      const target = alongByShift[dt + reach];
      const alongDistance = profileDistance(along, target, da + reach, stride);
      if (alongDistance === null || alongDistance >= SIGNATURE_MAX) continue;
      const headDistance = profileDistance(head, target, da + reach);
      const tailDistance = profileDistance(
        tail,
        target,
        da + reach + along.length - endZone
      );
      if (headDistance === null || tailDistance === null) continue;
      const endsDistance = (headDistance + tailDistance) / 2;
      const score =
        acrossDistance +
        endsDistance +
        (DISTANCE_WEIGHT * distance) / Math.max(1, radius);
      if (!best || score < best.score)
        best = { da, dt, score, acrossDistance, alongDistance, endsDistance };
    }
  if (!best)
    return {
      match: null,
      reason: "NO_SIGNATURE",
      ...(debug && { trace: [] }),
    };

  // --- Placement: same position relative to the pixels as the copy, then
  // centered on the faces found under it.
  const gridOrigin = {
    x: origin.x + best.dt * n.x,
    y: origin.y + best.dt * n.y,
  };
  const half = Math.ceil(width / 2) + margin;
  const faces = measureBandFaces(
    buildOrientedGrid(
      probe,
      gridOrigin,
      u,
      n,
      {
        aMin: best.da - halfLength,
        aMax: best.da + halfLength,
        aStep: Math.max(1, Math.floor(length / 240)),
        tMin: -half,
        tMax: half,
      },
      tol
    ),
    flip * lateral,
    width,
    tolerance / 2 + tol.reach / 2
  );
  const recenter = px(SIZE.recenter);
  const shift = flip * lateral + clamp(faces.shift, -recenter, recenter);
  return {
    match: buildSegmentMatch({
      center: {
        x: gridOrigin.x + shift * n.x,
        y: gridOrigin.y + shift * n.y,
      },
      u,
      n,
      span: {
        lo: best.da + axial - length / 2,
        hi: best.da + axial + length / 2,
      },
      width,
      model,
      item: clipboard.items[0],
      imageScale,
      imageOffset,
      score: 1 - best.score,
    }),
    ...(debug && {
      trace: [
        { kind: "exact", ...best, recenter: faces.shift, outcome: "accepted" },
      ],
    }),
  };
}
