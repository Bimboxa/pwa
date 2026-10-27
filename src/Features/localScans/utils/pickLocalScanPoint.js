import { mat3SmallestEigenvector } from "../../photoPlans/utils/mat3.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const distance2 = (a, b) => dot(sub(a, b), sub(a, b));

// All calculations use source coordinates. Only a bounded neighbourhood is
// fitted; the full cloud stays in the worker and never blocks pointer events.
export default function pickLocalScanPoint(positions, query) {
  const { matrix: m, ndc, width, height, origin, direction, scale } = query;
  let best = -1;
  let nearest = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) continue;
    const clipZ = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    if (clipZ < -1 || clipZ > 1) continue;
    const dx =
      (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w - ndc[0]) * width) / 2;
    const dy =
      (((m[1] * x + m[5] * y + m[9] * z + m[13]) / w - ndc[1]) * height) / 2;
    if (dx * dx + dy * dy > 36) continue;
    const depth =
      (x - origin[0]) * direction[0] +
      (y - origin[1]) * direction[1] +
      (z - origin[2]) * direction[2];
    if (depth > 0 && depth < nearest) {
      nearest = depth;
      best = i;
    }
  }
  if (best < 0) return null;
  const point = Array.from(positions.subarray(best, best + 3));
  const radius = Math.max(
    0.04 / scale,
    Math.min(0.4 / scale, nearest * query.pixelAngle * 32)
  );
  const tolerance = radius * 0.045;
  const neighbours = [];
  let seen = 0;
  let seed = 1234567;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - point[0],
      dy = positions[i + 1] - point[1],
      dz = positions[i + 2] - point[2];
    if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
    seen++;
    const slot =
      neighbours.length < 1024
        ? neighbours.length
        : Math.floor(random() * seen);
    if (slot < 1024)
      neighbours[slot] = [positions[i], positions[i + 1], positions[i + 2]];
  }
  const fallback = { point, normal: null, radius, support: 0 };
  if (neighbours.length < 15) return fallback;
  let inliers = [];
  for (let trial = 0; trial < 80; trial++) {
    const a = neighbours[Math.floor(random() * neighbours.length)];
    const u = sub(neighbours[Math.floor(random() * neighbours.length)], a);
    const v = sub(neighbours[Math.floor(random() * neighbours.length)], a);
    let n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const length = Math.hypot(...n);
    if (length < radius * radius * 0.01) continue;
    n = n.map((value) => value / length);
    if (Math.abs(dot(n, sub(point, a))) > tolerance * 2) continue;
    const matches = neighbours.filter(
      (p) => Math.abs(dot(n, sub(p, a))) <= tolerance
    );
    if (matches.length > inliers.length) inliers = matches;
  }
  if (inliers.length < 15 || inliers.length < neighbours.length * 0.6)
    return fallback;
  const center = [0, 0, 0];
  for (const p of inliers)
    for (let j = 0; j < 3; j++) center[j] += p[j] / inliers.length;
  const covariance = Array(9).fill(0);
  for (const p of inliers) {
    const d = sub(p, center);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        covariance[3 * r + c] += (d[r] * d[c]) / inliers.length;
  }
  const { vector: normal, values } = mat3SmallestEigenvector(covariance);
  // Reject thin lines and volumetric blobs instead of inventing a surface.
  if (values[1] < radius * radius * 0.015 || values[0] > values[1] * 0.08)
    return fallback;
  const denominator = dot(normal, direction);
  if (Math.abs(denominator) < 0.15) return fallback;
  const t = dot(normal, sub(center, origin)) / denominator;
  const intersection = origin.map((value, i) => value + t * direction[i]);
  if (t <= 0 || distance2(intersection, point) > radius * radius * 0.25)
    return fallback;
  if (denominator > 0) for (let i = 0; i < 3; i++) normal[i] *= -1;
  return {
    point: intersection,
    normal,
    radius,
    support: inliers.length / neighbours.length,
  };
}
