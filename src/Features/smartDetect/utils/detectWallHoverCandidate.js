import getAnnotationStrokeWidthPx from "../../geometry/utils/getAnnotationStrokeWidthPx.js";

// Reference-guided local wall detection. All internal coordinates are bitmap
// pixels; only published geometry is converted back to reference coordinates.
const modelCache = new WeakMap();
const PROFILE_BINS = 17;
const MATERIAL_CORE_RATIO = 0.6;
const AXIAL_SAMPLES = 31;
const GRADIENT_OFFSETS = [
  [2, 0],
  [0, 2],
  [2, 2],
  [2, -2],
];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const median = (values) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

function readGray(image, x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
  const i = (y * image.width + x) * 4;
  const r = image.data[i],
    g = image.data[i + 1],
    b = image.data[i + 2];
  // Ignore colored dimensions instead of interpreting blue/red ink as a wall.
  if (Math.max(r, g, b) - Math.min(r, g, b) > 50) return NaN;
  const alpha = image.data[i + 3] / 255;
  return ((r * 0.299 + g * 0.587 + b * 0.114) / 255) * alpha + 1 - alpha;
}

function getWallGeometry(item, toImage, meterByPx, scale) {
  const points = item.basePoints?.map(toImage);
  if (
    !points?.length ||
    !points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  )
    return null;
  if (item.basePoints.some((p) => p.type === "circle")) return null;
  const ann = item.annotation;
  const type = ann.type;
  let a = points[0],
    b = points[1],
    width;
  if (
    (type === "POLYLINE" || type === "STRIP") &&
    points.length === 2 &&
    !ann.closeLine
  ) {
    width = Math.abs(getAnnotationStrokeWidthPx(ann, meterByPx)) / scale;
  } else if (
    type === "POLYGON" &&
    points.length === 4 &&
    !item.baseCuts?.length
  ) {
    const edges = points.map((p, i) => ({
      x: points[(i + 1) % 4].x - p.x,
      y: points[(i + 1) % 4].y - p.y,
    }));
    const lengths = edges.map((e) => Math.hypot(e.x, e.y));
    if (lengths.some((l) => l < 1)) return null;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      if (
        Math.abs(edges[i].x * edges[j].x + edges[i].y * edges[j].y) /
          (lengths[i] * lengths[j]) >
          0.03 ||
        Math.abs(lengths[i] - lengths[(i + 2) % 4]) > 1
      )
        return null;
    }
    const i = lengths.indexOf(Math.max(...lengths));
    width = lengths[(i + 1) % 4];
    a = {
      x: (points[i].x + points[(i + 3) % 4].x) / 2,
      y: (points[i].y + points[(i + 3) % 4].y) / 2,
    };
    b = {
      x: (points[(i + 1) % 4].x + points[(i + 2) % 4].x) / 2,
      y: (points[(i + 1) % 4].y + points[(i + 2) % 4].y) / 2,
    };
  } else return null;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  // Two explicit points already define the direction, even on a short sample.
  // Only rectangles need an aspect-ratio guard to identify a wall-like axis.
  if (
    !Number.isFinite(width) ||
    width < 5 ||
    length < 3 ||
    (type === "POLYGON" && length < 3 * width)
  )
    return null;
  const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const n = { x: -u.y, y: u.x };
  const shift =
    type === "STRIP"
      ? ((item.stripOrientation ?? ann.stripOrientation ?? 1) * width) / 2
      : 0;
  return {
    type,
    width,
    length,
    u,
    n,
    center: {
      x: (a.x + b.x) / 2 + shift * n.x,
      y: (a.y + b.y) / 2 + shift * n.y,
    },
  };
}

function measureAppearance(sample, center, u, width, length) {
  const n = { x: -u.y, y: u.x };
  let sum = 0,
    squares = 0,
    count = 0;
  const gradients = [0, 0, 0, 0],
    pairs = [0, 0, 0, 0];
  // Describe the material inside the wall separately from its outlines.
  // The inset avoids learning a black edge or neighboring whitespace when
  // the source annotation is a couple of pixels off. Axial statistics remove
  // hatch phase; transverse bins retain evidence of different interior layers.
  const coreWidth = width * MATERIAL_CORE_RATIO;
  const profile = Array.from({ length: PROFILE_BINS }, () => ({
    sum: 0,
    squares: 0,
    count: 0,
  }));
  for (let a = 0; a < AXIAL_SAMPLES; a++) {
    for (let c = 0; c < PROFILE_BINS; c++) {
      const along = ((a + 0.5) / AXIAL_SAMPLES - 0.5) * length;
      const across = ((c + 0.5) / PROFILE_BINS - 0.5) * coreWidth;
      const x = center.x + along * u.x + across * n.x;
      const y = center.y + along * u.y + across * n.y;
      const value = sample(x, y);
      if (!Number.isFinite(value)) continue;
      sum += value;
      squares += value * value;
      count++;
      profile[c].sum += value;
      profile[c].squares += value * value;
      profile[c].count++;
      for (let i = 0; i < GRADIENT_OFFSETS.length; i++) {
        const [dx, dy] = GRADIENT_OFFSETS[i];
        // Keep both pixels of a texture measurement inside the material core.
        if (Math.abs(across + dx * n.x + dy * n.y) > coreWidth / 2) continue;
        const next = sample(x + dx, y + dy);
        if (Number.isFinite(next)) {
          gradients[i] += Math.abs(next - value);
          pairs[i]++;
        }
      }
    }
  }
  const mean = count ? sum / count : 1;
  return {
    mean,
    deviation: Math.sqrt(
      Math.max(0, squares / Math.max(1, count) - mean * mean)
    ),
    gradients: gradients.map((g, i) => g / Math.max(1, pairs[i])),
    profile: profile.map((bin) => {
      const mean = bin.count ? bin.sum / bin.count : 1;
      return {
        mean,
        deviation: Math.sqrt(
          Math.max(0, bin.squares / Math.max(1, bin.count) - mean * mean)
        ),
        coverage: bin.count / AXIAL_SAMPLES,
      };
    }),
    coverage: count / (AXIAL_SAMPLES * PROFILE_BINS),
  };
}

function learnModel(image, clipboard, scale, offset, meterByPx) {
  const wall = getWallGeometry(
    clipboard.items[0],
    (p) => ({ x: (p.x - offset.x) / scale, y: (p.y - offset.y) / scale }),
    meterByPx,
    scale
  );
  if (!wall) return null;
  const sampleLength = Math.min(wall.length / 3, Math.max(24, wall.width * 2));
  const patches = [-0.28, 0, 0.28]
    .map((t) =>
      measureAppearance(
        (x, y) => readGray(image, x, y),
        {
          x: wall.center.x + t * wall.length * wall.u.x,
          y: wall.center.y + t * wall.length * wall.u.y,
        },
        wall.u,
        wall.width,
        sampleLength
      )
    )
    .filter((p) => p.coverage >= 0.8);
  if (patches.length < 2) return { ...wall, appearance: null };
  const appearance = {
    mean: median(patches.map((p) => p.mean)),
    deviation: median(patches.map((p) => p.deviation)),
    gradients: GRADIENT_OFFSETS.map((_, i) =>
      median(patches.map((p) => p.gradients[i]))
    ),
    profile: Array.from({ length: PROFILE_BINS }, (_, i) => ({
      mean: median(patches.map((p) => p.profile[i].mean)),
      deviation: median(patches.map((p) => p.profile[i].deviation)),
    })),
  };
  // A recognized wall with insufficient reference pixels must not fall back
  // to generic dark-pixel adjustment and manufacture an unrelated candidate.
  if (appearance.mean > 0.96) return { ...wall, appearance: null };
  return { ...wall, appearance, sampleLength };
}

function similarity(observed, expected) {
  if (
    observed.coverage < 0.8 ||
    observed.profile.some((bin) => bin.coverage < 0.65)
  )
    return 0;
  const profileError =
    observed.profile.reduce(
      (sum, bin, i) =>
        sum +
        Math.abs(bin.mean - expected.profile[i].mean) +
        0.5 * Math.abs(bin.deviation - expected.profile[i].deviation),
      0
    ) / PROFILE_BINS;
  if (profileError > 0.16) return 0;
  const meanError = Math.abs(observed.mean - expected.mean);
  const deviationError = Math.abs(observed.deviation - expected.deviation);
  const gradientError =
    observed.gradients.reduce(
      (sum, g, i) => sum + Math.abs(g - expected.gradients[i]),
      0
    ) / 4;
  if (meanError > 0.22 || deviationError > 0.2 || gradientError > 0.2) return 0;
  return Math.max(
    0,
    1 - meanError - deviationError - gradientError - profileError
  );
}

function boundaryScore(sample, center, u, width, length, mean) {
  const n = { x: -u.y, y: u.x };
  const scores = [];
  for (const sign of [-1, 1]) {
    let outside = 0,
      edge = 0,
      count = 0,
      supported = 0;
    for (let k = 0; k < 23; k++) {
      const a = ((k + 0.5) / 23 - 0.5) * length;
      const at = (c) =>
        sample(
          center.x + a * u.x + sign * c * n.x,
          center.y + a * u.y + sign * c * n.y
        );
      const out = at(width / 2 + Math.max(1.5, width * 0.06));
      const e1 = at(width / 2 - 0.5),
        e2 = at(width / 2 - 1.5);
      if (![out, e1, e2].every(Number.isFinite)) continue;
      outside += out;
      edge += Math.min(e1, e2);
      if (out - Math.min(e1, e2) > 0.12) supported++;
      count++;
    }
    if (count < 16 || supported / count < 0.65) return 0;
    // Solid fills need an exterior contrast; gray and hatched fills may
    // additionally have a darker outline. Both sides must support the band.
    scores.push(
      Math.max(outside / count - mean, outside / count - edge / count)
    );
  }
  return Math.min(...scores);
}

function scanAxis(sample, cursor, angle, model, radius, preferClosest = false) {
  const u = { x: Math.cos(angle), y: Math.sin(angle) },
    n = { x: -u.y, y: u.x };
  let best = null;
  const choices = [];
  const selectBest = () => {
    const closest =
      preferClosest &&
      choices.reduce(
        (nearest, candidate) =>
          !nearest || Math.abs(candidate.t) < Math.abs(nearest.t)
            ? candidate
            : nearest,
        null
      );
    best = choices.reduce((winner, candidate) => {
      // Choose the nearest band, then its best-centered axis. Choosing the
      // nearest passing pixel would bias every draft toward the near edge.
      if (closest && Math.abs(candidate.t - closest.t) > model.width / 2)
        return winner;
      return !winner || candidate.score > winner.score ? candidate : winner;
    }, null);
  };
  const scoreAt = (t) => {
    if (Math.abs(t) > radius) return;
    const center = { x: cursor.x + t * n.x, y: cursor.y + t * n.y };
    // Most probes are blank; reject unsupported boundaries before sampling
    // the more expensive material descriptor in the Space search circle.
    if (
      boundaryScore(
        sample,
        center,
        u,
        model.width,
        model.sampleLength,
        model.appearance.mean
      ) < 0.12
    )
      return;
    const appearance = measureAppearance(
      sample,
      center,
      u,
      model.width,
      model.sampleLength
    );
    const match = similarity(appearance, model.appearance);
    if (match < 0.68) return;
    const boundary = boundaryScore(
      sample,
      center,
      u,
      model.width,
      model.sampleLength,
      appearance.mean
    );
    if (boundary < 0.12) return;
    const score =
      match + boundary * 0.45 - (Math.abs(t) / Math.max(1, radius)) * 0.12;
    choices.push({ center, u, n, t, angle, score, match });
  };
  // Thin outlines can occupy one pixel: a coarse step can skip the only
  // aligned profile entirely when both boundaries are required.
  const step = 1;
  scoreAt(0);
  for (let t = -radius; t <= radius; t += step) scoreAt(t);
  selectBest();
  if (!best) return null;
  const coarse = best.t;
  for (let t = coarse - step; t <= coarse + step; t += 0.5) scoreAt(t);
  selectBest();
  return best;
}

function extendCandidate(sample, candidate, model, image) {
  const { width, appearance } = model;
  const sectionMatches = (a) => {
    let sum = 0,
      squares = 0,
      count = 0,
      unavailable = 0;
    const samples = Math.max(7, Math.min(40, Math.ceil(width)));
    for (let i = 0; i < samples; i++) {
      const c = ((i + 0.5) / samples - 0.5) * width * MATERIAL_CORE_RATIO;
      const value = sample(
        candidate.center.x + a * candidate.u.x + c * candidate.n.x,
        candidate.center.y + a * candidate.u.y + c * candidate.n.y
      );
      if (value === null) unavailable++;
      if (!Number.isFinite(value)) continue;
      sum += value;
      squares += value * value;
      count++;
    }
    if (unavailable > samples * 0.3) return null;
    if (count < samples * 0.7) return "occluded";
    const mean = sum / count;
    const deviation = Math.sqrt(Math.max(0, squares / count - mean * mean));
    // Pale hatching can average almost white. Require some of the learned
    // ink/contrast so an empty opening cannot count as matching material.
    if (
      mean > 1 - (1 - appearance.mean) * 0.3 &&
      deviation < appearance.deviation * 0.35 + 0.01
    )
      return false;
    // Dense hatch scanlines vary more than a flat fill or pale hatching.
    const meanTolerance = clamp(appearance.deviation * 0.75, 0.15, 0.25);
    if (
      Math.abs(mean - appearance.mean) < meanTolerance &&
      Math.abs(deviation - appearance.deviation) < 0.25
    )
      return true;
    // Thin black drafting lines can temporarily replace the fill. Blank
    // scanlines remain gaps, so this allowance cannot bridge a white opening.
    if (mean < appearance.mean - 0.12) return "ink";
    return false;
  };
  let seed = null;
  for (let d = 0; d <= Math.min(width / 2, 8); d++) {
    if (sectionMatches(d) === true) {
      seed = d;
      break;
    }
    if (d && sectionMatches(-d) === true) {
      seed = -d;
      break;
    }
  }
  if (seed === null) return null;
  const walk = (sign) => {
    let last = seed,
      gap = 0,
      occlusion = 0,
      ink = 0;
    const max = Math.ceil(Math.hypot(image.width, image.height));
    for (let i = 1; i <= max; i++) {
      const a = seed + i * sign;
      const valid = sectionMatches(a);
      // A mask/image boundary is a hard stop; two missing scanlines may be
      // antialiasing or hatch whitespace, but an opening must split the wall.
      if (valid === null) break;
      if (valid === "occluded") {
        if (++occlusion > Math.max(6, Math.min(128, width * 2))) break;
      } else if (valid === "ink") {
        if (++ink > Math.max(2, Math.min(12, width * 0.3))) break;
      } else if (valid) {
        last = a;
        gap = 0;
        occlusion = 0;
        ink = 0;
      } else if (++gap > 2) break;
    }
    return last + sign * 0.5;
  };
  const lo = walk(-1),
    hi = walk(1);
  if (hi - lo < Math.max(12, width * 2.5)) return null;
  // Check the recovered span again: a locally plausible axis may drift out
  // of an oblique wall, or follow an unrelated surface beyond a junction.
  const center = {
    x: candidate.center.x + ((lo + hi) / 2) * candidate.u.x,
    y: candidate.center.y + ((lo + hi) / 2) * candidate.u.y,
  };
  const boundary = boundaryScore(
    sample,
    center,
    candidate.u,
    width,
    (hi - lo) * 0.9,
    appearance.mean
  );
  if (boundary < 0.12) return null;
  // The full candidate must retain the learned cross-wall structure. Checking
  // several windows prevents extension through a different fill with the same
  // overall gray level and contrast.
  const checkLength = Math.min(model.sampleLength, (hi - lo) / 3);
  for (const fraction of [0.2, 0.5, 0.8]) {
    const along = lo + fraction * (hi - lo);
    let confirmed = false;
    // A dimension label must not veto the complete wall a second time during
    // validation. Seek a clean nearby window, still inside the recovered span.
    for (const shift of [0, -checkLength, checkLength]) {
      const a = clamp(
        along + shift,
        lo + checkLength / 2,
        hi - checkLength / 2
      );
      const observed = measureAppearance(
        sample,
        {
          x: candidate.center.x + a * candidate.u.x,
          y: candidate.center.y + a * candidate.u.y,
        },
        candidate.u,
        width,
        checkLength
      );
      if (similarity(observed, appearance) >= 0.65) {
        confirmed = true;
        break;
      }
    }
    if (!confirmed) return null;
  }
  return {
    ...candidate,
    lo,
    hi,
    score: candidate.score + Math.min(0.15, ((hi - lo) / width) * 0.005),
  };
}

/** null means unsupported reference; {matches: []} means no similar wall. */
export default function detectWallHoverCandidate({
  clipboard,
  imageData,
  cursorImgPx,
  exclusionMask,
  imageScale = 1,
  imageOffset = { x: 0, y: 0 },
  meterByPx = 0,
  smartZoom = 1,
  pasteTransform,
  baseMapId,
  searchRadiusImgPx,
}) {
  if (
    clipboard?.items?.length !== 1 ||
    !imageData ||
    !cursorImgPx ||
    imageScale <= 0
  )
    return null;
  const item = clipboard.items[0];
  if (
    baseMapId &&
    item.annotation.baseMapId &&
    item.annotation.baseMapId !== baseMapId
  )
    return null;
  if (pasteTransform?.scale && pasteTransform.scale !== 1) return null;
  let cache = modelCache.get(imageData);
  if (!cache) {
    cache = new WeakMap();
    modelCache.set(imageData, cache);
  }
  const key = [imageScale, imageOffset.x, imageOffset.y, meterByPx].join(",");
  let entry = cache.get(clipboard);
  if (entry?.key !== key) {
    entry = {
      key,
      model: learnModel(
        imageData,
        clipboard,
        imageScale,
        imageOffset,
        meterByPx
      ),
    };
    cache.set(clipboard, entry);
  }
  const learned = entry.model;
  if (!learned) return null;
  if (!learned.appearance) return { matches: [] };
  const model = pasteTransform?.flipX
    ? {
        ...learned,
        appearance: {
          ...learned.appearance,
          profile: [...learned.appearance.profile].reverse(),
        },
      }
    : learned;
  const sample = (x, y) => {
    const px = Math.floor(x),
      py = Math.floor(y);
    if (
      px < 0 ||
      py < 0 ||
      px >= imageData.width ||
      py >= imageData.height ||
      exclusionMask?.[py * imageData.width + px]
    )
      return null;
    const dx = x - model.center.x,
      dy = y - model.center.y;
    // Source exclusion uses the actual footprint, even without a visible mask.
    if (
      Math.abs(dx * model.u.x + dy * model.u.y) <= model.length / 2 &&
      Math.abs(dx * model.n.x + dy * model.n.y) <= model.width / 2
    )
      return null;
    return readGray(imageData, x, y);
  };
  const rotation = ((pasteTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const baseAngle =
    Math.atan2(model.u.y, model.u.x * (pasteTransform?.flipX ? -1 : 1)) +
    rotation;
  const explicitSearch =
    Number.isFinite(searchRadiusImgPx) && searchRadiusImgPx > 0;
  const radius = explicitSearch
    ? Math.min(searchRadiusImgPx, Math.hypot(imageData.width, imageData.height))
    : clamp(45 / Math.max(0.1, smartZoom), 6, Math.max(12, model.width * 2));
  // Orientation is a constraint supplied by the copied geometry and R/I.
  // Never rotate the candidate automatically to chase a nearby dark region.
  // Phase 1: acquire a clean seed near the cursor. The cursor can be on a
  // dimension, hatch whitespace or an endpoint rather than a scorable patch.
  // Phase 2: extend that seed independently in both directions. Return the
  // first complete candidate reaching the cursor, not just the local patch.
  let best = null;
  const u = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
  const seedStep = model.sampleLength * 0.75;
  const shifts = explicitSearch
    ? [0]
    : [0, -seedStep, seedStep, -2 * seedStep, 2 * seedStep];
  if (explicitSearch) {
    for (let shift = seedStep; shift < radius; shift += seedStep)
      shifts.push(-shift, shift);
    shifts.push(-radius, radius);
  }
  let bestDistance = Infinity;
  for (const shift of shifts) {
    const probe = {
      x: cursorImgPx.x + shift * u.x,
      y: cursorImgPx.y + shift * u.y,
    };
    const transverseRadius = explicitSearch
      ? Math.sqrt(Math.max(0, radius * radius - shift * shift)) +
        model.width / 2
      : radius;
    const seed = scanAxis(
      sample,
      probe,
      baseAngle,
      model,
      transverseRadius,
      explicitSearch
    );
    if (!seed) continue;
    const candidate = extendCandidate(sample, seed, model, imageData);
    if (!candidate) continue;
    const cursorAlong =
      (cursorImgPx.x - candidate.center.x) * u.x +
      (cursorImgPx.y - candidate.center.y) * u.y;
    // Do not jump across an opening to an unrelated seed farther along the
    // same axis. A small endpoint allowance supports hovering near a wall end.
    if (
      !explicitSearch &&
      (cursorAlong < candidate.lo - 2 || cursorAlong > candidate.hi + 2)
    )
      continue;
    const nearestAlong = clamp(cursorAlong, candidate.lo, candidate.hi);
    const across = Math.abs(
      (cursorImgPx.x - candidate.center.x) * candidate.n.x +
        (cursorImgPx.y - candidate.center.y) * candidate.n.y
    );
    const distance = Math.hypot(
      cursorAlong - nearestAlong,
      Math.max(0, across - model.width / 2)
    );
    if (explicitSearch && distance > radius) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
    if (!explicitSearch || bestDistance === 0) break;
  }
  if (!best) return { matches: [] };
  const point = (along, across) => ({
    x:
      (best.center.x + along * best.u.x + across * best.n.x) * imageScale +
      imageOffset.x,
    y:
      (best.center.y + along * best.u.y + across * best.n.y) * imageScale +
      imageOffset.y,
  });
  const half = model.width / 2;
  const polygon = [
    point(best.lo, -half),
    point(best.hi, -half),
    point(best.hi, half),
    point(best.lo, half),
  ];
  const shift =
    model.type === "STRIP"
      ? -(item.stripOrientation ?? item.annotation.stripOrientation ?? 1) * half
      : 0;
  const placedPoints =
    model.type === "POLYGON"
      ? polygon
      : [point(best.lo, shift), point(best.hi, shift)];
  return {
    matches: [
      {
        targetCenter: point((best.lo + best.hi) / 2, 0),
        placedPoints,
        placedCuts: [],
        polylines: [{ points: polygon, closed: true }],
        point: null,
        score: best.match,
      },
    ],
  };
}
