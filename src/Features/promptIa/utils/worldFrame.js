// World frame of a base map created by the Prompt IA from a CAD / BIM source
// (DXF render, IFC top view). The model gives the source coordinates of
// three corners of the page; the scale, the orientation and the conversion
// source coordinates → image are derived here, never taken from the model.
//
// Frames: the source is right-handed, y up (CAD convention); the image has
// its origin at the top-left corner, x right, y down. A valid frame is a
// rectangle (no shear) that is not mirrored.

const UNIT_METERS = { m: 1, dm: 0.1, cm: 0.01, mm: 0.001 };

// cos of the angle between the two edges: 0.01 ≈ 0.6°
const MAX_SHEAR = 0.01;
// width / height of the frame vs the picture: beyond, the page is stretched
export const MAX_WORLD_ASPECT_GAP = 0.01;

const isPoint = (p) =>
  Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;

/**
 * @param {Object} raw - `{ unit, altitude, corners: { topLeft, topRight,
 *   bottomLeft } }`, corners in source coordinates
 * @returns {{ok: true, frame: Object} | {ok: false, error: string}}
 *   `frame` = { unit, unitMeters, altitude (metres), corners, widthMeters,
 *   heightMeters, angleDeg } — `angleDeg` = direction of the image x axis in
 *   the source frame, counter-clockwise (0 = source x axis to the right).
 */
export function parseWorldFrame(raw) {
  if (!raw || typeof raw !== "object")
    return { ok: false, error: "`world` manquant." };
  const unit = raw.unit ?? "m";
  const unitMeters = UNIT_METERS[unit];
  if (!unitMeters)
    return {
      ok: false,
      error: `world.unit inconnu : ${unit} (attendu ${Object.keys(UNIT_METERS).join(", ")}).`,
    };
  const { topLeft, topRight, bottomLeft } = raw.corners ?? {};
  if (![topLeft, topRight, bottomLeft].every(isPoint))
    return {
      ok: false,
      error:
        "world.corners doit donner topLeft, topRight et bottomLeft ({x, y} finis).",
    };

  const ex = sub(topRight, topLeft);
  const ey = sub(bottomLeft, topLeft);
  const width = Math.hypot(ex.x, ex.y);
  const height = Math.hypot(ey.x, ey.y);
  if (!(width > 0) || !(height > 0))
    return { ok: false, error: "world.corners : cadre de taille nulle." };
  if (Math.abs(dot(ex, ey)) / (width * height) > MAX_SHEAR)
    return {
      ok: false,
      error: "world.corners : les trois coins ne forment pas un rectangle.",
    };
  // image y points down while the source y points up: a faithful render has
  // its bottom-left corner clockwise from the top edge
  if (cross(ex, ey) > 0)
    return {
      ok: false,
      error:
        "world.corners : cadre en miroir (topLeft / topRight / bottomLeft dans le mauvais sens).",
    };

  const altitude = Number.isFinite(raw.altitude) ? raw.altitude : 0;
  return {
    ok: true,
    frame: {
      unit,
      unitMeters,
      altitude: altitude * unitMeters,
      corners: {
        topLeft: { x: topLeft.x, y: topLeft.y },
        topRight: { x: topRight.x, y: topRight.y },
        bottomLeft: { x: bottomLeft.x, y: bottomLeft.y },
      },
      widthMeters: width * unitMeters,
      heightMeters: height * unitMeters,
      angleDeg: (Math.atan2(ex.y, ex.x) * 180) / Math.PI,
    },
  };
}

// Source point → normalized image point ([0..1], top-left origin, y down).
export function worldToImage(frame, point) {
  const { topLeft, topRight, bottomLeft } = frame.corners;
  const ex = sub(topRight, topLeft);
  const ey = sub(bottomLeft, topLeft);
  const d = sub(point, topLeft);
  return { x: dot(d, ex) / dot(ex, ex), y: dot(d, ey) / dot(ey, ey) };
}

// Normalized image point → source point.
export function imageToWorld(frame, point) {
  const { topLeft, topRight, bottomLeft } = frame.corners;
  const ex = sub(topRight, topLeft);
  const ey = sub(bottomLeft, topLeft);
  return {
    x: topLeft.x + point.x * ex.x + point.y * ey.x,
    y: topLeft.y + point.x * ex.y + point.y * ey.y,
  };
}

// |frame aspect / picture aspect − 1|: 0 when the picture has the
// proportions of the frame.
export function getWorldAspectGap(frame, size) {
  if (!size?.width || !size?.height) return Infinity;
  return Math.abs(
    frame.widthMeters / frame.heightMeters / (size.width / size.height) - 1
  );
}

// Scale of the picture, from the frame only.
export function getWorldMeterByPx(frame, size) {
  return frame.widthMeters / size.width;
}

/**
 * Matching points (pixels) between a base map and a reference one, both
 * carrying a world frame: the input of
 * computeBaseMapPlacementFromPointPairs, to pose the first against the
 * second in the 3D scene.
 *
 * @returns {Array<{plan: {x, y}, reference: {x, y}}>}
 */
export function getWorldPlacementPairs({
  frame,
  size,
  referenceFrame,
  referenceSize,
}) {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ].map((corner) => {
    const world = imageToWorld(frame, corner);
    // both frames must share the unit of their source coordinates
    const scale = frame.unitMeters / referenceFrame.unitMeters;
    const ref = worldToImage(referenceFrame, {
      x: world.x * scale,
      y: world.y * scale,
    });
    return {
      plan: { x: corner.x * size.width, y: corner.y * size.height },
      reference: {
        x: ref.x * referenceSize.width,
        y: ref.y * referenceSize.height,
      },
    };
  });
}
