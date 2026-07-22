// Camera pose along the flight between two POVs (pure math, no three.js).
//
// A straight lerp of the world position dives through the geometry between
// two orbit views. Instead the orbit target is lerped linearly and the
// `position - target` offset is interpolated in spherical coords: azimuth on
// the shortest arc, polar linearly, radius geometrically (log-lerp) so a
// close-up -> wide flight keeps a constant perceived zoom speed.

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function toSpherical(v) {
  const r = Math.hypot(v.x, v.y, v.z);
  if (!(r > 0)) return { r: 0, theta: 0, phi: 0 };
  return {
    r,
    theta: Math.atan2(v.x, v.z), // azimuth around the vertical (Y) axis
    phi: Math.acos(Math.min(1, Math.max(-1, v.y / r))), // polar from +Y
  };
}

function fromSpherical({ r, theta, phi }) {
  const sinPhi = Math.sin(phi);
  return {
    x: r * sinPhi * Math.sin(theta),
    y: r * Math.cos(phi),
    z: r * sinPhi * Math.cos(theta),
  };
}

// Shortest signed angular delta from a to b, in ]-PI, PI].
function shortestAngleDelta(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * @param {{position:{x,y,z}, target:{x,y,z}, fovDeg:number}} poseA
 * @param {{position:{x,y,z}, target:{x,y,z}, fovDeg:number}} poseB
 * @param {number} t progress in [0,1] (raw — the easing is applied here)
 * @param {boolean} [ease=true]
 */
export default function getPovFlightPose(poseA, poseB, t, ease = true) {
  const raw = Math.min(1, Math.max(0, t));
  const s = ease ? easeInOutCubic(raw) : raw;

  const target = {
    x: lerp(poseA.target.x, poseB.target.x, s),
    y: lerp(poseA.target.y, poseB.target.y, s),
    z: lerp(poseA.target.z, poseB.target.z, s),
  };

  const offA = {
    x: poseA.position.x - poseA.target.x,
    y: poseA.position.y - poseA.target.y,
    z: poseA.position.z - poseA.target.z,
  };
  const offB = {
    x: poseB.position.x - poseB.target.x,
    y: poseB.position.y - poseB.target.y,
    z: poseB.position.z - poseB.target.z,
  };

  const sphA = toSpherical(offA);
  const sphB = toSpherical(offB);

  let offset;
  if (!(sphA.r > 0) || !(sphB.r > 0)) {
    // Degenerate offset (camera on its own target): plain lerp.
    offset = {
      x: lerp(offA.x, offB.x, s),
      y: lerp(offA.y, offB.y, s),
      z: lerp(offA.z, offB.z, s),
    };
  } else {
    offset = fromSpherical({
      r: Math.exp(lerp(Math.log(sphA.r), Math.log(sphB.r), s)),
      theta: sphA.theta + shortestAngleDelta(sphA.theta, sphB.theta) * s,
      phi: lerp(sphA.phi, sphB.phi, s),
    });
  }

  return {
    position: {
      x: target.x + offset.x,
      y: target.y + offset.y,
      z: target.z + offset.z,
    },
    target,
    fovDeg: lerp(poseA.fovDeg, poseB.fovDeg, s),
  };
}
