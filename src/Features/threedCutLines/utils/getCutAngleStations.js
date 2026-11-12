import { add, cross, dot, length, normalize, scale, sub } from "./vec3.js";

const RAD = Math.PI / 180;

// Radial part of `point` around the rotation axis through `origin`: the
// vector from the axis to the point, perpendicular to the axis.
export function getCutAngleRadial({ origin, axis, point }) {
  if (!origin || !axis || !point) return null;
  const v = sub(point, origin);
  return sub(v, scale(axis, dot(v, axis)));
}

// Signed angle (degrees, in ]-180, 180]) from the reference point to the
// cursor around the rotation axis — counter-clockwise positive seen from the
// tip of the axis. Null when either point sits on the axis.
export function computeCutAngleDeg({ origin, axis, refPoint, cursor }) {
  const r = normalize(getCutAngleRadial({ origin, axis, point: refPoint }));
  const c = normalize(getCutAngleRadial({ origin, axis, point: cursor }));
  if (!r || !c) return null;
  return Math.atan2(dot(axis, cross(r, c)), dot(r, c)) / RAD;
}

// Angle actually used: the cursor's one, or — with a typed angle — that
// value turned to the cursor's side (the mouse only picks the sense).
export function resolveCutAngleDeg({
  origin,
  axis,
  refPoint,
  cursor,
  typedDeg = null,
}) {
  const measured = computeCutAngleDeg({ origin, axis, refPoint, cursor });
  if (!(typedDeg > 0)) return measured;
  return measured !== null && measured < 0 ? -typedDeg : typedDeg;
}

// Direction of the reference turned by `angleDeg` around the axis.
export function rotateCutAngleDir({ axis, refDir, angleDeg }) {
  const a = angleDeg * RAD;
  return normalize(
    add(scale(refDir, Math.cos(a)), scale(cross(axis, refDir), Math.sin(a)))
  );
}

// Half-planes of the « Coupe par angle » command: every one starts on the
// rotation axis (through `origin`, unit direction `axis`) and leaves it
// along the reference direction (origin → refPoint, made perpendicular to
// the axis) turned by a multiple of the angle. The reference itself (0°)
// is never a station.
//   REPEAT (default): half-plane i at i × angle, i = 1..count.
//   DIVIDE:           half-plane i at (i / count) × angle — the last one at
//                     the angle itself.
//
// Returns [{ point, dir, normal, angleDeg, radius }] — `point` = origin,
// `dir` = unit direction of the half-plane away from the axis, `normal` =
// its plane's normal, `radius` = distance of the reference point to the
// axis. Empty when the reference sits on the axis or the angle is null.
export default function getCutAngleStations({
  origin,
  axis,
  refPoint,
  angleDeg,
  count = 1,
  mode = "REPEAT",
}) {
  const unitAxis = normalize(axis);
  if (!origin || !unitAxis || !Number.isFinite(angleDeg) || angleDeg === 0) {
    return [];
  }
  const radial = getCutAngleRadial({ origin, axis: unitAxis, point: refPoint });
  const refDir = normalize(radial);
  if (!refDir) return [];
  const radius = length(radial);
  const n = Math.max(1, Math.floor(count) || 1);
  const stations = [];
  for (let i = 1; i <= n; i++) {
    const stationAngle = mode === "DIVIDE" ? (angleDeg * i) / n : angleDeg * i;
    const dir = rotateCutAngleDir({
      axis: unitAxis,
      refDir,
      angleDeg: stationAngle,
    });
    stations.push({
      point: origin,
      dir,
      normal: normalize(cross(unitAxis, dir)),
      angleDeg: stationAngle,
      radius,
    });
  }
  return stations;
}
