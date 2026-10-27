import { mat3SmallestEigenvector } from "../../photoPlans/utils/mat3.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((v, i) => v - b[i]);

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
  // Fixed physical search volume: one metre per edge, centred on the hit.
  // Placement is a uniform scale and an axis permutation, so a source-space
  // cube maps to the same scene-space cube after applying the import scale.
  const radius = 0.5 / scale;
  const tolerance = 0.025 / scale;
  const neighbours = [];
  let seen = 0;
  let seed = 1234567;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < positions.length; i += 3) {
    const dx = positions[i] - point[0],
      dy = positions[i + 1] - point[1],
      dz = positions[i + 2] - point[2];
    if (Math.abs(dx) > radius || Math.abs(dy) > radius || Math.abs(dz) > radius)
      continue;
    seen++;
    const slot =
      neighbours.length < 4096
        ? neighbours.length
        : Math.floor(random() * seen);
    if (slot < 4096)
      neighbours[slot] = [positions[i], positions[i + 1], positions[i + 2]];
  }
  const fallback = {
    point,
    normal: null,
    radius,
    support: 0,
    neighbourCount: seen,
    sampleCount: neighbours.length,
  };
  const minimumSupport = Math.max(12, Math.ceil(neighbours.length * 0.15));
  if (neighbours.length < minimumSupport) return fallback;

  // Keep several distinct hypotheses. A wall can be less dense than the
  // neighbouring floor/furniture, so a majority requirement is inappropriate.
  // Distances within the noise tolerance tie; then prefer the larger support.
  const rank = (a, b) =>
    Math.floor(a.distance / tolerance) - Math.floor(b.distance / tolerance) ||
    b.count - a.count;
  const candidates = [];
  for (let trial = 0; trial < 640; trial++) {
    const a = neighbours[Math.floor(random() * neighbours.length)];
    const u = sub(neighbours[Math.floor(random() * neighbours.length)], a);
    const v = sub(neighbours[Math.floor(random() * neighbours.length)], a);
    let normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const length = Math.hypot(...normal);
    if (length < radius * radius * 0.002) continue;
    normal = normal.map((value) => value / length);
    const offset = dot(normal, a);
    const distance = Math.abs(dot(normal, point) - offset);
    if (distance > radius) continue;
    let count = 0;
    for (const p of neighbours)
      if (Math.abs(dot(normal, p) - offset) <= tolerance) count++;
    if (count < minimumSupport) continue;
    const candidate = { normal, offset, distance, count };
    const duplicate = candidates.findIndex((other) => {
      const alignment = dot(other.normal, normal);
      return (
        Math.abs(alignment) > 0.995 &&
        Math.abs(other.offset * Math.sign(alignment) - offset) < tolerance
      );
    });
    if (duplicate >= 0) {
      if (rank(candidate, candidates[duplicate]) >= 0) continue;
      candidates.splice(duplicate, 1);
    }
    candidates.push(candidate);
    candidates.sort(rank);
    if (candidates.length > 24) candidates.pop();
  }

  let chosen = null;
  for (const candidate of candidates) {
    let normal = candidate.normal;
    let offset = candidate.offset;
    let center;
    let values;
    // Refit, reclassify, then refit once more to reduce random-triplet bias.
    for (let pass = 0; pass < 2; pass++) {
      const inliers = neighbours.filter(
        (p) => Math.abs(dot(normal, p) - offset) <= tolerance
      );
      if (inliers.length < minimumSupport) {
        center = null;
        break;
      }
      center = [0, 0, 0];
      for (const p of inliers)
        for (let j = 0; j < 3; j++) center[j] += p[j] / inliers.length;
      const covariance = Array(9).fill(0);
      for (const p of inliers) {
        const d = sub(p, center);
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 3; c++)
            covariance[3 * r + c] += (d[r] * d[c]) / inliers.length;
      }
      const eigen = mat3SmallestEigenvector(covariance);
      normal = eigen.vector;
      values = eigen.values;
      offset = dot(normal, center);
    }
    if (!center) continue;
    // Require a two-dimensional patch, not a line or a thick volume.
    if (values[1] < (0.05 / scale) ** 2 || values[0] > values[1] * 0.12)
      continue;
    const count = neighbours.filter(
      (p) => Math.abs(dot(normal, p) - offset) <= tolerance
    ).length;
    if (count < minimumSupport) continue;
    const distance = Math.abs(dot(normal, point) - offset);
    if (distance > radius) continue;
    const refined = { normal, offset, distance, count };
    if (!chosen || rank(refined, chosen) < 0) chosen = refined;
  }
  if (!chosen) return fallback;
  const { normal, offset } = chosen;
  const denominator = dot(normal, direction);
  const t =
    Math.abs(denominator) > 0.02
      ? (offset - dot(normal, origin)) / denominator
      : -1;
  const intersection = origin.map((value, i) => value + t * direction[i]);
  const insideCube =
    t > 0 &&
    intersection.every((value, i) => Math.abs(value - point[i]) <= radius);
  // A grazing ray must not suppress an otherwise good plane or send the
  // result far away. Fall back to the nearest orthogonal point on the plane.
  const signedDistance = dot(normal, point) - offset;
  const projected = point.map((value, i) => value - signedDistance * normal[i]);
  if (denominator > 0) for (let i = 0; i < 3; i++) normal[i] *= -1;
  return {
    ...fallback,
    point: insideCube ? intersection : projected,
    normal,
    support: chosen.count / neighbours.length,
  };
}
