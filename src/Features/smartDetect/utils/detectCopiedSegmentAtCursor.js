import {
  MATERIAL_MIN_WIDTH,
  createSampler,
  createSectionClassifier,
  getReferenceModel,
  measureAppearance,
  scanAxis,
  similarity,
} from "./detectWallHoverCandidate.js";
import {
  bandFacesPresent,
  buildOrientedGrid,
  columnStats,
  createFaceSectionClassifier,
  createProbe,
  createTolerances,
  profileDistance,
  findBands,
  findFaces,
  findOneFaceBands,
  measureBandFaces,
} from "./segmentBandFaces.js";
import extendSegmentFromCursor, {
  confirmSpan,
} from "./extendSegmentFromCursor.js";

// Space on a copied two-point segment: find the band of the copied width and
// orientation nearest to the cursor, center it, then extend it both ways.
//
// Acquisition runs three independent passes over the same neighborhood:
//  1. reference: the learned material with both boundaries (strict);
//  2. contour: two parallel faces at the copied spacing, whatever the
//     exterior is (paper, colored fill, darker surface) — "hollow" when the
//     faces are bare lines without a distinct interior;
//  3. oneFace: one readable face plus the learned material, when the other
//     side is hidden by an existing annotation.
// Geometry decides; the material only ranks candidates. Ranking penalties are
// lateral distances expressed in band widths.
const PENALTY = { reference: 0, contour: 0.25, oneFace: 0.4, hollow: 0.75 };
const INNER_LINE_PENALTY = 0.5;
// Sizes are real-world lengths in meters, converted with the plan scale, so
// a coarse plan and a fine one behave alike. Pixel counts only bound them
// from below, where the raster cannot resolve or average less.
const SIZE = {
  // Thickness assumed for the copied band on an uncalibrated plan.
  nominalBand: 0.2,
  // Face-to-face spacing accepted around the copied width (or 20 % of it).
  widthTolerance: 0.03,
  // Axial window in which faces are read: twice the width, within bounds.
  window: [0.36, 0.72],
  // Shorter window for stubs: the width, never below this.
  shortWindow: 0.12,
  // Window used to locate where the faces of a band end (a hatch period).
  faceWindow: 0.12,
  // Blank run that splits a band (an opening).
  opening: 0.04,
  // Darker transverse line stepped over: 0.3 width, within bounds.
  ink: [0.03, 0.18],
  // Foreign color or one-sided junction stepped over: two widths, within.
  occlusion: [0.09, 1.9],
  // Shortest segment worth creating, whatever the copied length.
  minLength: 0.045,
  // Largest correction of the axis measured over the whole span.
  recenter: 0.03,
};
// Thinnest band the raster can still show as two faces.
const MIN_WIDTH_PX = 2;
// Largest mean difference between the transverse profile of a band and the
// one it was acquired with, over which it is still the same band.
const CONTINUITY_MAX = 0.15;
const GEOMETRY_PRIORITY = { contour: 0, hollow: 0, oneFace: 1, reference: 2 };
const MAX_TRIALS = 6;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Returns { match } with the same match shape as detectWallHoverCandidate, or
 * { match: null, reason } where reason is UNSUPPORTED_REFERENCE, NO_BAND,
 * TOO_SHORT or NOT_PLAUSIBLE. `debug: true` adds a `trace` of the hypotheses.
 */
export default function detectCopiedSegmentAtCursor({
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
  const trace = debug ? [] : null;
  const fail = (reason) => ({ match: null, reason, ...(trace && { trace }) });
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
  if (!model || model.type === "POLYGON") return fail("UNSUPPORTED_REFERENCE");
  const item = clipboard.items[0];
  const width = model.width;
  const diagonal = Math.hypot(imageData.width, imageData.height);
  const radius = Math.min(
    searchRadiusImgPx > 0 ? searchRadiusImgPx : 2 * width,
    diagonal
  );
  const tol = createTolerances(
    meterByPx > 0 ? meterByPx * imageScale : SIZE.nominalBand / width,
    width
  );
  const { px } = tol;
  // An outline is never drawn thinner than a pixel: on a coarse plan it
  // widens the band by that much.
  const tolerance = Math.max(px(SIZE.widthTolerance, 1.5), width * 0.2);
  // Orientation is a constraint supplied by the copied geometry and R/I.
  const baseAngle =
    Math.atan2(model.u.y, model.u.x * (pasteTransform?.flipX ? -1 : 1)) +
    ((pasteTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const u = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  const n = { x: -u.y, y: u.x };
  const sample = createSampler(imageData, exclusionMask, model);
  const probe = createProbe(imageData, exclusionMask, model);
  // Pixel-centered frame: on axis-aligned walls a column is a pixel column.
  const origin = {
    x: Math.floor(cursorImgPx.x) + 0.5,
    y: Math.floor(cursorImgPx.y) + 0.5,
  };
  const pointAt = (a, t) => ({
    x: origin.x + a * u.x + t * n.x,
    y: origin.y + a * u.y + t * n.y,
  });
  // The cursor may be on a label or beyond an end: also look at windows
  // shifted along the axis, up to the search radius.
  const axialShifts = (step) => {
    const shifts = [0];
    for (let shift = step; shift < radius; shift += step)
      shifts.push(-shift, shift);
    shifts.push(-radius, radius);
    return shifts;
  };

  // --- Phase 1: acquisition
  const hypotheses = [];
  if (model.appearance)
    for (const shift of axialShifts(model.sampleLength * 0.75)) {
      const seed = scanAxis(
        sample,
        {
          x: cursorImgPx.x + shift * u.x,
          y: cursorImgPx.y + shift * u.y,
        },
        baseAngle,
        model,
        Math.sqrt(Math.max(0, radius * radius - shift * shift)) + width / 2,
        true
      );
      if (seed)
        hypotheses.push({
          kind: "reference",
          t:
            (seed.center.x - origin.x) * n.x + (seed.center.y - origin.y) * n.y,
          span: width,
          shift,
          strength: seed.match,
        });
    }
  // Twelve rows are the least that averages a hatch and still splits into
  // chunks; six for the short window.
  const windowLength = Math.round(
    clamp(width * 2, px(SIZE.window[0], 12), px(SIZE.window[1], 24))
  );
  const reach = Math.ceil(radius + windowLength);
  const margin = Math.ceil(tolerance + tol.exterior + tol.reach + 2);
  const lateral = Math.ceil(radius + width) + margin;
  const grid = buildOrientedGrid(
    probe,
    origin,
    u,
    n,
    { aMin: -reach, aMax: reach, tMin: -lateral, tMax: lateral },
    tol
  );
  const observe = (hyp, length) =>
    measureAppearance(sample, pointAt(hyp.shift, hyp.t), u, width, length);
  // A short window lets a stub between two openings show its faces.
  for (const length of new Set([
    windowLength,
    Math.round(clamp(width, px(SIZE.shortWindow, 6), windowLength)),
  ]))
    for (const shift of axialShifts(length * 0.75)) {
      const r0 = Math.round(shift - length / 2) + reach,
        r1 = r0 + length - 1;
      const stats = columnStats(grid, r0, r1);
      const faces = findFaces(stats, grid.tMin, tol);
      for (const band of findBands(
        grid,
        stats,
        faces,
        r0,
        r1,
        width,
        tolerance
      ))
        hypotheses.push({
          ...band,
          kind: band.body ? "contour" : "hollow",
          shift,
          length,
        });
      if (!model.appearance) continue;
      for (const band of findOneFaceBands(grid, stats, faces, r0, r1, width)) {
        const hyp = { ...band, kind: "oneFace", shift, length };
        const seen = observe(hyp, length);
        if (
          seen.coverage >= 0.6 &&
          Math.abs(seen.mean - model.appearance.mean) < 0.12 &&
          Math.abs(seen.deviation - model.appearance.deviation) < 0.12
        )
          hypotheses.push(hyp);
      }
    }

  // One entry per physical band and reading of it: faces give the geometry
  // when available, the reference pass vouches for the material. A filled and
  // a hollow reading of the same band are both kept, the extension decides.
  const bands = [];
  hypotheses
    .filter((hyp) => Math.abs(hyp.t) - width / 2 <= radius)
    .sort(
      (a, b) =>
        GEOMETRY_PRIORITY[a.kind] - GEOMETRY_PRIORITY[b.kind] ||
        Math.abs(a.shift) - Math.abs(b.shift) ||
        (b.length ?? 0) - (a.length ?? 0)
    )
    .forEach((hyp) => {
      const same = bands.filter(
        (other) => Math.abs(other.t - hyp.t) < width / 2
      );
      if (hyp.kind === "reference" && same.length)
        same.forEach((band) => (band.similar = true));
      else if (!same.some((band) => band.kind === hyp.kind))
        bands.push({ ...hyp, similar: hyp.kind === "reference" });
    });
  for (const band of bands) {
    // A dimension across the acquisition window must not hide the material:
    // also compare the neighboring windows.
    if (!band.similar && model.appearance && band.kind === "contour") {
      const length = Math.min(band.length, model.sampleLength);
      band.similar = [0, -length, length].some(
        (offset) =>
          similarity(
            observe({ ...band, shift: band.shift + offset }, length),
            model.appearance
          ) >= 0.6
      );
    }
    const penalty = band.similar
      ? 0
      : band.kind === "hollow" && !model.appearance
        ? 0
        : PENALTY[band.kind];
    band.rank =
      Math.max(0, Math.abs(band.t) - width / 2) +
      (penalty + (band.inner ? INNER_LINE_PENALTY : 0)) * width;
  }
  // At equal rank the filled reading of a band is tried before the hollow one.
  bands.sort(
    (a, b) =>
      a.rank - b.rank ||
      PENALTY[a.kind] - PENALTY[b.kind] ||
      Math.abs(a.shift) - Math.abs(b.shift)
  );
  if (!bands.length) return fail("NO_BAND");

  // --- Phases 2 and 3: centering and extension, nearest band first
  const minLength = Math.max(
    px(SIZE.minLength, 2),
    Math.min(width, model.length * 0.6)
  );
  const limits = {
    gap: Math.floor(px(SIZE.opening, 2)),
    ink: clamp(width * 0.3, px(SIZE.ink[0], 2), px(SIZE.ink[1], 2)),
    occlusion: clamp(
      width * 2,
      px(SIZE.occlusion[0], 3),
      px(SIZE.occlusion[1], 3)
    ),
  };
  const faceRows = Math.round(px(SIZE.faceWindow, 6));
  let reason = "NO_BAND";
  for (const band of bands.slice(0, MAX_TRIALS)) {
    const report = (outcome, extra) =>
      trace?.push({
        kind: band.kind,
        similar: band.similar,
        t: band.t,
        span: band.span,
        shift: band.shift,
        length: band.length,
        rank: band.rank,
        outcome,
        ...extra,
      });
    const candidate = { center: pointAt(0, band.t), u, n };
    // Continuity is judged against the copied material when it matches, else
    // against the band itself at the acquisition window.
    const checkLength = band.similar
      ? model.sampleLength
      : (band.length ?? windowLength);
    // A band of a few pixels has no interior to speak of: its faces are the
    // only evidence, whatever gray lies between them.
    let appearance = band.similar ? model.appearance : null;
    if (!appearance && band.kind !== "hollow" && width >= MATERIAL_MIN_WIDTH) {
      const local = observe(band, checkLength);
      if (
        local.coverage >= 0.8 &&
        !(local.mean > 0.96 && local.deviation < 0.03)
      )
        appearance = local;
    }
    const classify = appearance
      ? createSectionClassifier(sample, candidate, width, appearance)
      : createFaceSectionClassifier(
          probe,
          candidate,
          band.span,
          band.interior ?? { kind: 1, mean: 1 },
          tol
        );
    const cursorAlong =
      (cursorImgPx.x - candidate.center.x) * u.x +
      (cursorImgPx.y - candidate.center.y) * u.y;
    const column = Math.round(band.t);
    const profileLength = band.length ?? windowLength;
    const profileAt = (along, length = profileLength) =>
      columnStats(
        buildOrientedGrid(
          probe,
          pointAt(0, column),
          u,
          n,
          {
            aMin: Math.round(along - length / 2),
            aMax: Math.round(along + length / 2) - 1,
            // Faces and interior only: what lies outside a wall changes
            // along it (a basin, then earth, then a crossing wall).
            tMin: Math.round(band.t - column - band.span / 2),
            tMax: Math.round(band.t - column + band.span / 2),
          },
          tol
        )
      );
    const extend = (seedAt, seedReach) => {
      let span = extendSegmentFromCursor({
        classify,
        limits,
        cursorAlong: seedAt,
        seedReach,
        maxLength: Math.ceil(diagonal),
      });
      if (!span) return null;
      // The scanline walk follows any surface of similar gray level: keep
      // the part whose transverse profile (faces and interior) is still the
      // one seen where the band was acquired. The acquisition window may
      // overlap an opening or an end: the reference is read inside the span.
      const inside = Math.min(profileLength, span.hi - span.lo);
      const reference = profileAt(
        clamp(band.shift, span.lo + inside / 2, span.hi - inside / 2),
        inside
      );
      span = confirmSpan({
        span,
        length: profileLength,
        classify,
        matches: (along) => {
          const distance = profileDistance(reference, profileAt(along));
          // One missing face (a junction) must pass even on a band of a
          // few columns, where it weighs much more.
          return distance === null
            ? null
            : distance < Math.max(CONTINUITY_MAX, 1.1 / reference.length);
        },
      });
      // The material may run on into a crossing band or past a bend: pull
      // each end back to where a face of this band is still visible. The
      // window covers a hatch period; a partly covered window shows a
      // proportionally weaker face, which locates the first covered row.
      if (
        band.kind !== "reference" &&
        band.kind !== "oneFace" &&
        band.strength >= 0.4
      )
        for (const [key, sign] of [
          ["lo", -1],
          ["hi", 1],
        ])
          for (
            let moved = 0;
            moved <= Math.max(width * 1.5, profileLength + width);
            moved++
          ) {
            const end = span[key] - sign * (moved + 0.5);
            const present = bandFacesPresent(
              probe,
              pointAt(0, column),
              u,
              n,
              {
                aMin: Math.round(Math.min(end, end - sign * (faceRows - 1))),
                aMax: Math.round(Math.max(end, end - sign * (faceRows - 1))),
                center: band.t - column,
                span: band.span,
                minStrength: band.strength * 0.75,
              },
              tol
            );
            if (present.left === false && present.right === false) continue;
            const strength = Math.max(present.left || 0, present.right || 0);
            const missing = moved
              ? Math.round(
                  faceRows * (1 - Math.min(1, strength / band.strength))
                )
              : 0;
            span[key] -= sign * (moved + missing);
            break;
          }
      return span;
    };
    let span = null;
    // Start from the click. If that lands on an isolated fragment, fall back
    // to the window where the band was acquired.
    for (const [seedAt, seedReach] of [
      [cursorAlong, Math.ceil(radius + tol.reach)],
      [band.shift, Math.ceil((band.length ?? windowLength) / 2)],
    ]) {
      const extended = extend(seedAt, seedReach);
      if (extended && extended.hi - extended.lo >= minLength) {
        span = extended;
        break;
      }
      if (extended) reason = "TOO_SHORT";
    }
    if (!span) {
      report("no span");
      continue;
    }
    // Faces measured over the whole span: plausibility and final centering.
    const half = Math.ceil(band.span / 2) + margin;
    const faces = measureBandFaces(
      buildOrientedGrid(
        probe,
        pointAt(0, column),
        u,
        n,
        {
          aMin: Math.ceil(span.lo),
          aMax: Math.floor(span.hi),
          aStep: Math.max(1, Math.floor((span.hi - span.lo) / 240)),
          tMin: -half,
          tMax: half,
        },
        tol
      ),
      band.t - column,
      band.span,
      tolerance / 2 + tol.reach / 2
    );
    const left = faces.left?.support >= 0.5,
      right = faces.right?.support >= 0.5;
    const plausible =
      band.kind === "hollow"
        ? left && right
        : band.kind === "oneFace"
          ? left || right
          : left || right || band.kind === "reference";
    if (!plausible) {
      if (reason === "NO_BAND") reason = "NOT_PLAUSIBLE";
      report("faces not supported", { extent: span });
      continue;
    }
    const recenter = px(SIZE.recenter);
    const shift = clamp(faces.shift, -recenter, recenter);
    const center = {
      x: candidate.center.x + shift * n.x,
      y: candidate.center.y + shift * n.y,
    };
    const across = Math.abs(
      (cursorImgPx.x - center.x) * n.x + (cursorImgPx.y - center.y) * n.y
    );
    const distance = Math.hypot(
      cursorAlong - clamp(cursorAlong, span.lo, span.hi),
      Math.max(0, across - width / 2)
    );
    if (distance > radius) {
      report("out of radius", { extent: span, distance });
      continue;
    }
    report("accepted", { extent: span, distance, recenter: shift });
    return {
      match: buildSegmentMatch({
        center,
        u,
        n,
        span,
        width,
        model,
        item,
        imageScale,
        imageOffset,
        score: band.strength,
      }),
      ...(trace && { trace }),
    };
  }
  return fail(reason);
}

// Published geometry of a detected segment, in reference pixel coordinates:
// `span` runs from lo to hi along `u` from `center` (bitmap pixels).
export function buildSegmentMatch({
  center,
  u,
  n,
  span,
  width,
  model,
  item,
  imageScale,
  imageOffset,
  score,
}) {
  const point = (along, offset) => ({
    x: (center.x + along * u.x + offset * n.x) * imageScale + imageOffset.x,
    y: (center.y + along * u.y + offset * n.y) * imageScale + imageOffset.y,
  });
  const halfWidth = width / 2;
  const polygon = [
    point(span.lo, -halfWidth),
    point(span.hi, -halfWidth),
    point(span.hi, halfWidth),
    point(span.lo, halfWidth),
  ];
  // STRIP control points stay on the copied edge of the band.
  const edge =
    model.type === "STRIP"
      ? -(item.stripOrientation ?? item.annotation.stripOrientation ?? 1) *
        halfWidth
      : 0;
  return {
    targetCenter: point((span.lo + span.hi) / 2, 0),
    placedPoints: [point(span.lo, edge), point(span.hi, edge)],
    placedCuts: [],
    polylines: [{ points: polygon, closed: true }],
    point: null,
    score,
  };
}
