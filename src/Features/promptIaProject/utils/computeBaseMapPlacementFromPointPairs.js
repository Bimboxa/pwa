// Pure solver: 3D placement of a HORIZONTAL base map from points matched with
// a reference base map lying at the origin of the scene (position 0,
// angleDeg 0).
//
// Frames (see threedEditor pixelToWorld + getBaseMapEuler): a pixel maps to
// metres centred on the image, image right → world +X, image down → world +Z.
// The placement is the rigid transform (rotation around the vertical axis +
// translation) that best brings the plan points onto the reference ones, in
// the least-squares sense. The scale is NOT fitted when the plan has its own
// `meterByPx`: the drawing scale wins over hand-picked points.

const EPS = 1e-9;

function normalizeAngleDeg(deg) {
  let a = ((deg + 180) % 360) - 180;
  if (a <= -180) a += 360;
  return a;
}

const centered = (p, size) => ({
  x: p.x - size.width / 2,
  z: p.y - size.height / 2,
});

const mean = (points) => ({
  x: points.reduce((n, p) => n + p.x, 0) / points.length,
  z: points.reduce((n, p) => n + p.z, 0) / points.length,
});

/**
 * @param {Object} params
 * @param {Array<{plan: {x, y}, reference: {x, y}}>} params.pairs - pixels,
 *   top-left origin, each in its own image
 * @param {{width, height}} params.planSize
 * @param {number|null} params.planMeterByPx - null = scale fitted on the pairs
 * @param {{width, height}} params.referenceSize
 * @param {number} params.referenceMeterByPx
 * @param {number} [params.altitude] - metres, becomes position.y
 * @returns {{position, angleDeg, meterByPx, scaleRatio, rmsMeters}|null}
 *   `scaleRatio` = scale fitted on the pairs / scale of the plan (1 = the
 *   points agree with the drawing scale). null when the pairs cannot define
 *   a placement.
 */
export default function computeBaseMapPlacementFromPointPairs({
  pairs,
  planSize,
  planMeterByPx = null,
  referenceSize,
  referenceMeterByPx,
  altitude = 0,
}) {
  if (!Array.isArray(pairs) || pairs.length < 2) return null;
  if (!planSize?.width || !planSize?.height) return null;
  if (!referenceSize?.width || !referenceSize?.height) return null;
  if (!(referenceMeterByPx > 0)) return null;

  // plan in centred pixels, reference in metres
  const P = pairs.map((pair) => centered(pair.plan, planSize));
  const S = pairs.map((pair) => {
    const c = centered(pair.reference, referenceSize);
    return { x: c.x * referenceMeterByPx, z: c.z * referenceMeterByPx };
  });
  const pMean = mean(P);
  const sMean = mean(S);

  let dot = 0;
  let cross = 0;
  let pNorm = 0;
  let sNorm = 0;
  for (let i = 0; i < P.length; i += 1) {
    const px = P[i].x - pMean.x;
    const pz = P[i].z - pMean.z;
    const sx = S[i].x - sMean.x;
    const sz = S[i].z - sMean.z;
    dot += px * sx + pz * sz;
    cross += px * sz - pz * sx;
    pNorm += px * px + pz * pz;
    sNorm += sx * sx + sz * sz;
  }
  if (pNorm < EPS || sNorm < EPS || Math.hypot(dot, cross) < EPS) return null;

  const fittedMeterByPx = Math.hypot(dot, cross) / pNorm;
  const meterByPx = planMeterByPx > 0 ? planMeterByPx : fittedMeterByPx;

  // s = R(theta) · (m · p) + t, theta counted from +X towards +Z
  const theta = Math.atan2(cross, dot);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotate = (p) => ({
    x: meterByPx * (p.x * cos - p.z * sin),
    z: meterByPx * (p.x * sin + p.z * cos),
  });
  const rotatedMean = rotate(pMean);
  const t = { x: sMean.x - rotatedMean.x, z: sMean.z - rotatedMean.z };

  let squares = 0;
  for (let i = 0; i < P.length; i += 1) {
    const q = rotate(P[i]);
    squares += (q.x + t.x - S[i].x) ** 2 + (q.z + t.z - S[i].z) ** 2;
  }

  return {
    // the image centre is the origin of the local frame: it lands on t
    position: { x: t.x, y: altitude, z: t.z },
    // a rotation of phi around world +Y decreases atan2(z, x) by phi
    angleDeg: normalizeAngleDeg((-theta * 180) / Math.PI),
    meterByPx,
    scaleRatio: fittedMeterByPx / meterByPx,
    rmsMeters: Math.sqrt(squares / P.length),
  };
}
