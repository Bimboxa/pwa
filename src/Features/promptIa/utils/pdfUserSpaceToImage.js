// Port of the relay's shared/pdfFrame.ts (reperage-mcp). Coordinate frames:
//
//   R0 `pdf_user_space` — raw PDF user space of the page: content-stream
//      coordinates, points, y up. Independent of /Rotate and of the CropBox.
//   R1 unrotated view — pdf.js `getViewport({ scale: 1, rotation: 0 })`:
//      origin at the top-left corner of `view` (CropBox ∩ MediaBox), y down.
//   R2 rotated view — `getViewport({ rotation })` with the ABSOLUTE rotation
//      chosen by the user (`createdFrom.rotation`, which replaces the page's
//      intrinsic /Rotate). Positive angles rotate clockwise, as pdf.js does.
//   R3 image — the crop `bboxInRatio` taken on R2, normalized to [0..1].
//
// `page` = { view: [x0, y0, x1, y1] } (readPdfPageFrame), `frame` =
// { rotation, bboxInRatio } (describeAiTaskSource).

export function userToView0(pt, page) {
  const [vx0, , , vy1] = page.view;
  return { x: pt.x - vx0, y: vy1 - pt.y };
}

export function viewSize(page) {
  const [vx0, vy0, vx1, vy1] = page.view;
  return { width: vx1 - vx0, height: vy1 - vy0 };
}

// R1 → R2 (top-left origins, clockwise rotation).
export function rotateView(pt, rotation, size) {
  const { width: W, height: H } = size;
  switch (rotation) {
    case 90:
      return { point: { x: H - pt.y, y: pt.x }, width: H, height: W };
    case 180:
      return { point: { x: W - pt.x, y: H - pt.y }, width: W, height: H };
    case 270:
      return { point: { x: pt.y, y: W - pt.x }, width: H, height: W };
    default:
      return { point: { x: pt.x, y: pt.y }, width: W, height: H };
  }
}

// R0 → R3. Values outside [0..1] mean "outside the crop".
export function userToImage(pt, frame, page) {
  const view0 = userToView0(pt, page);
  const rotated = rotateView(view0, frame.rotation, viewSize(page));
  const nx = rotated.point.x / rotated.width;
  const ny = rotated.point.y / rotated.height;
  const b = frame.bboxInRatio ?? { x1: 0, y1: 0, x2: 1, y2: 1 };
  return {
    x: (nx - b.x1) / (b.x2 - b.x1),
    y: (ny - b.y1) / (b.y2 - b.y1),
  };
}

// Points this far outside the crop are snapped back onto its edge; beyond,
// the whole annotation is dropped (the PWA has no geometric clipping).
export const FRAME_TOLERANCE = 0.002;

function clampNormalized(v) {
  if (v < 0 && v >= -FRAME_TOLERANCE) return 0;
  if (v > 1 && v <= 1 + FRAME_TOLERANCE) return 1;
  return v;
}

function inFrame(p) {
  return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

/**
 * Brings the geometry of an inline payload into the image frame with
 * `project` (author point → normalized image point). Converts `points`,
 * `cuts`, `openings`, `guideLines`, `labelPoint`, `targetPoint` and the
 * single `point` of a DETAIL; drops the annotations that end up outside the
 * image.
 *
 * @param {Object} payload
 * @param {(p: {x:number, y:number}) => {x:number, y:number}} project
 * @returns {{data: Object, dropped: string[]}}
 */
export function mapPayloadPoints(payload, project) {
  const toImage = (p) => {
    const q = project(p);
    return { ...p, x: clampNormalized(q.x), y: clampNormalized(q.y) };
  };
  const dropped = [];
  const annotations = [];
  for (const a of payload.annotations ?? []) {
    const next = { ...a };
    const all = [];
    const mapPoints = (points) => {
      const out = points.map(toImage);
      all.push(...out);
      return out;
    };
    if (Array.isArray(a.points)) next.points = mapPoints(a.points);
    if (Array.isArray(a.cuts))
      next.cuts = a.cuts.map((c) => ({
        ...c,
        points: mapPoints(c.points ?? []),
      }));
    if (Array.isArray(a.openings))
      next.openings = a.openings.map((o) => ({
        ...o,
        points: mapPoints(o.points ?? []),
      }));
    if (Array.isArray(a.guideLines))
      next.guideLines = a.guideLines.map((g) => ({
        ...g,
        points: mapPoints(g.points ?? []),
      }));
    if (a.labelPoint) {
      next.labelPoint = toImage(a.labelPoint);
      all.push(next.labelPoint);
    }
    if (a.targetPoint) {
      next.targetPoint = toImage(a.targetPoint);
      all.push(next.targetPoint);
    }
    if (a.point) {
      next.point = toImage(a.point);
      all.push(next.point);
    }
    if (all.every(inFrame)) annotations.push(next);
    else dropped.push(a.id);
  }
  return { data: { ...payload, annotations }, dropped };
}

/**
 * Brings an inline payload authored in `pdf_user_space` into the image frame
 * (see mapPayloadPoints). `baseMaps[].source.bboxInRatio` is never converted:
 * it is a fraction of the attached PDF page, not of this plan.
 *
 * @returns {{data: Object, dropped: string[]}}
 */
export function convertPayloadToImageSpace(payload, frame, page) {
  return mapPayloadPoints(payload, (p) => userToImage(p, frame, page));
}
