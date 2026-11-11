// 3D sibling of getPolylinePointsFromCircleCenterRadius (Features/geometry):
// the 4 control points of a circle drawn from its centre and a rim point, in
// the plane of normal `normal` through the centre — square, circle, square,
// circle, a quarter turn apart (two S-C-S arcs once the path is closed).
//
// The first point is the rim point itself (projected on the plane), so the
// clicked / snapped point is a real vertex of the circle.
//
// Pure ({x, y, z} in, {x, y, z, type} out). Null when the radius is under
// 1 mm or the normal is degenerate.

const MIN_RADIUS_M = 1e-3;

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export default function getCirclePointsFromCenterRadius3d(center, rim, normal) {
  if (!center || !rim || !normal) return null;
  const normalLength = Math.sqrt(dot(normal, normal));
  if (!(normalLength > 1e-9)) return null;
  const n = {
    x: normal.x / normalLength,
    y: normal.y / normalLength,
    z: normal.z / normalLength,
  };

  // Centre → rim, projected on the plane.
  const v = { x: rim.x - center.x, y: rim.y - center.y, z: rim.z - center.z };
  const off = dot(v, n);
  const inPlane = {
    x: v.x - n.x * off,
    y: v.y - n.y * off,
    z: v.z - n.z * off,
  };
  const radius = Math.sqrt(dot(inPlane, inPlane));
  if (!(radius > MIN_RADIUS_M)) return null;

  const u = {
    x: inPlane.x / radius,
    y: inPlane.y / radius,
    z: inPlane.z / radius,
  };
  const w = cross(n, u);

  const at = (axis, sign, type) => ({
    x: center.x + sign * radius * axis.x,
    y: center.y + sign * radius * axis.y,
    z: center.z + sign * radius * axis.z,
    type,
  });

  return [
    at(u, 1, "square"),
    at(w, 1, "circle"),
    at(u, -1, "square"),
    at(w, -1, "circle"),
  ];
}
