import { mat3SmallestEigenvector } from "./mat3";

// Estimate the vanishing point of ONE family of parallel-in-the-world line
// segments, in CENTERED photo coords (pixel-isotropic, y-up, origin at the
// image center — see computePhotoPlanCalibration).
//
// Least squares: each segment gives a homogeneous image line l = a x b,
// normalized so (l . p) is the point-line distance, weighted by the segment
// length; the VP is the smallest eigenvector of A = sum(w * l * lT).
// Exact for the 2-segment minimum.
//
// Returns null when fewer than 2 usable segments remain or the family is
// collinear (all segments on the same line — VP undetermined), else:
//   {
//     vp: [x, y, w],       // unit homogeneous (w ~ 0 => VP at infinity)
//     residualDeg,         // RMS angle segment vs (midpoint -> VP) direction
//     spreadDeg,           // max pairwise angle between segment directions
//     segmentCount,        // usable segments
//   }

const MIN_SEGMENT_LENGTH = 1e-3; // centered units (~ 0.1% of the image size)

export default function estimateVanishingPoint(segments) {
  const usable = (segments ?? []).filter(
    (s) =>
      s?.p1 &&
      s?.p2 &&
      Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y) >= MIN_SEGMENT_LENGTH
  );
  if (usable.length < 2) return null;

  // Accumulate A = sum(w * l * lT), l unit-normalized on (l1, l2).
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const lines = [];
  for (const s of usable) {
    const w = Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y);
    // l = p1 x p2 with homogeneous (x, y, 1) points.
    let l = [
      s.p1.y - s.p2.y,
      s.p2.x - s.p1.x,
      s.p1.x * s.p2.y - s.p1.y * s.p2.x,
    ];
    const n = Math.hypot(l[0], l[1]);
    if (n < 1e-12) continue;
    l = l.map((v) => v / n);
    lines.push(l);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        A[3 * r + c] += w * l[r] * l[c];
      }
    }
  }
  if (lines.length < 2) return null;

  const { vector, values } = mat3SmallestEigenvector(A);
  // Collinear family: two ~zero eigenvalues -> VP direction undetermined.
  if (values[1] < 1e-9 * Math.max(values[2], 1e-30)) return null;

  const norm = Math.hypot(vector[0], vector[1], vector[2]);
  const vp = vector.map((v) => v / norm);

  // Diagnostics.
  const isInfinite = Math.abs(vp[2]) < 1e-6;
  let sumSq = 0;
  const dirs = [];
  for (const s of usable) {
    const dx = s.p2.x - s.p1.x;
    const dy = s.p2.y - s.p1.y;
    const len = Math.hypot(dx, dy);
    const dir = { x: dx / len, y: dy / len };
    dirs.push(dir);
    const mid = { x: (s.p1.x + s.p2.x) / 2, y: (s.p1.y + s.p2.y) / 2 };
    let vDir;
    if (isInfinite) {
      vDir = { x: vp[0], y: vp[1] };
    } else {
      vDir = { x: vp[0] / vp[2] - mid.x, y: vp[1] / vp[2] - mid.y };
    }
    const vn = Math.hypot(vDir.x, vDir.y);
    if (vn < 1e-12) continue;
    const cos = Math.min(1, Math.abs(dir.x * vDir.x + dir.y * vDir.y) / vn);
    const angle = Math.acos(cos);
    sumSq += angle * angle;
  }
  const residualDeg = (Math.sqrt(sumSq / usable.length) * 180) / Math.PI;

  let spreadDeg = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const cos = Math.min(
        1,
        Math.abs(dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y)
      );
      spreadDeg = Math.max(spreadDeg, (Math.acos(cos) * 180) / Math.PI);
    }
  }

  return { vp, residualDeg, spreadDeg, segmentCount: usable.length };
}
