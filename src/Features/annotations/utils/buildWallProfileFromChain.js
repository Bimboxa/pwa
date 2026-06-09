// Computes the vertical wall band (per-point ground + wallTop, in meters) along
// a chain of contour points, for one of three profiles. Shared by:
//   - buildSlopeWallPolyline.js   (auto LEFT/RIGHT side of a sloped polygon)
//   - buildWallPolylineFromChain.js (a user-selected run of contour segments)
//
// Input `chain`: ordered [{ x, y, ground }] (pixels + meters). `ground` is the
// ramp ground height at that vertex (0 for a flat wall).
//
// Profiles:
//   - "STRAIGHT": a plain rectangular wall. Bottom flat at level 0, top flat at
//                 `height`. The slope ground is ignored.
//   - "CONSTANT": wallTop = min(ground + height, maxHeight). Keeps a constant
//                 height above the slope, then caps at the ceiling. When no
//                 maxHeight is given, the height is kept all along the slope
//                 (no cap): wallTop = ground + height.
//   - "MAX":      wallTop = maxHeight (flat ceiling). The wall height decreases
//                 up-slope and ends where the ground reaches maxHeight. When no
//                 maxHeight is given, the ceiling is the highest ground along
//                 the chain (so the wall tapers to zero at the top).
//
// Returns an ordered array [{ x, y, ground, wallTop }] (pixels + meters), or
// null when no wall can be built (bad heights, ceiling below the ground, ...).
// `extrudePolylineWall` hides the negative (ground > wallTop) spans, so a wall
// that crosses the ceiling tapers off cleanly.

const EPS = 1e-6;

// Inserts interpolated points wherever an edge crosses one of the ground
// `levels`, so the wall top profile has a clean vertex at each transition.
function insertGroundCrossings(chain, levels) {
  const out = [chain[0]];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const dg = b.ground - a.ground;
    const inserts = [];
    if (Math.abs(dg) > EPS) {
      for (const lvl of levels) {
        const t = (lvl - a.ground) / dg;
        if (t > EPS && t < 1 - EPS) {
          inserts.push({
            t,
            x: a.x + t * (b.x - a.x),
            y: a.y + t * (b.y - a.y),
            ground: lvl,
          });
        }
      }
      inserts.sort((p, q) => p.t - q.t);
    }
    for (const ins of inserts) {
      out.push({ x: ins.x, y: ins.y, ground: ins.ground });
    }
    out.push(b);
  }
  return out;
}

export default function buildWallProfileFromChain(
  chain,
  { profileType, height, maxHeight }
) {
  if (!Array.isArray(chain) || chain.length < 2) return null;

  // STRAIGHT: plain rectangle, flat bottom (0) and flat top (height).
  if (profileType === "STRAIGHT") {
    if (!Number.isFinite(height) || height <= 0) return null;
    const out = chain.map((p) => ({
      x: p.x,
      y: p.y,
      ground: 0,
      wallTop: height,
    }));
    return out.length >= 2 ? out : null;
  }

  const hasMax = Number.isFinite(maxHeight) && maxHeight > 0;

  if (profileType === "CONSTANT") {
    const H = height;
    if (!Number.isFinite(H) || H <= 0) return null;

    // Ground levels where the wall top profile changes / ends. With no ceiling
    // the wall keeps a constant height H all along the slope (no break point).
    const levels = [];
    if (hasMax) {
      const gBreak = maxHeight - H;
      if (gBreak > EPS) levels.push(gBreak);
      levels.push(maxHeight); // ceiling
    }

    const dense = insertGroundCrossings(chain, levels);

    let anyPositive = false;
    const out = dense.map((p) => {
      const g = p.ground;
      const wallTop = hasMax ? Math.min(g + H, maxHeight) : g + H;
      if (wallTop - g > EPS) anyPositive = true;
      return { x: p.x, y: p.y, ground: g, wallTop };
    });
    if (!anyPositive || out.length < 2) return null;
    return out;
  }

  // MAX: flat ceiling. When no maxHeight is given, use the highest ground along
  // the (selected) slope chain so the wall tapers to zero at the top.
  const ceiling = hasMax
    ? maxHeight
    : chain.reduce((m, p) => Math.max(m, p.ground ?? 0), -Infinity);
  if (!Number.isFinite(ceiling) || ceiling <= 0) return null;

  const dense = insertGroundCrossings(chain, [ceiling]);

  // Compute wallTop per point (the flat ceiling). Beyond-ceiling points keep
  // their place in the polyline; extrudePolylineWall hides the negative
  // (ground > wallTop) spans, so the visible wall tapers off at the ceiling.
  let anyPositive = false;
  const out = dense.map((p) => {
    const g = p.ground;
    if (ceiling - g > EPS) anyPositive = true;
    return { x: p.x, y: p.y, ground: g, wallTop: ceiling };
  });

  if (!anyPositive || out.length < 2) return null;
  return out;
}
