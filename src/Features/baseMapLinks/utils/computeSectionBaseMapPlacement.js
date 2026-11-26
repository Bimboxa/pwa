// Pure geometry of the « + fond de plan » command of a section mark: where a
// VERTICAL page (a new blank page or an existing vertical base map) stands
// in 3D while the user slides it in the vertical plane of the mark, and the
// CLONE of the mark that encodes exactly that pose once validated.
//
// The page plane is fixed: vertical, through the plan mark A → B, facing the
// observer side of the mark. Two scalars place the page in that plane:
//   - alongM: shift of the page centre along A → B, from the mark's middle;
//   - upM:    vertical shift of the page centre, from the plan altitude.
// A third one, `normalM`, moves the PLANE itself: the mark A → B is shifted
// along the viewing direction d = (uz, 0, -ux) — the opposite of the front
// normal, i.e. away from the observer when positive. Everything else is
// computed from the shifted mark (returned as `anchors`): the caller moves
// the stored mark there on validation, so the clone still encodes the pose.
//
// Same frame as computeVerticalBaseMapPlacementFromLink (keepScale): local
// +X of the page follows A → B (u = (cos a, 0, -sin a)), local +Y is world
// +Y. The clone is the keep-scale encoding — its FIRST point is the anchor,
// seen on the left, landing on A; the second one is the derived far point
// (horizontal, |AB| at the page scale). Feeding that clone back to the
// solver returns this very pose: the preview and the stored result agree.
//
// Inputs: A, B in world metres ({x, y, z}, same altitude), `size` =
// { width, height } of the page reference frame in px, `meterByPx`.
// Returns { angleDeg, position, cloneNorm: { q1, q2 }, widthM, heightM,
// axisU: { x, z }, viewDir: { x, z }, anchors: { A, B } }, or null when the
// inputs are unusable.
const EPS = 1e-9;

export default function computeSectionBaseMapPlacement({
  A: markA,
  B: markB,
  size,
  meterByPx,
  alongM = 0,
  upM = 0,
  normalM = 0,
}) {
  if (!markA || !markB) return null;
  const markDx = markB.x - markA.x;
  const markDz = markB.z - markA.z;
  const markL = Math.hypot(markDx, markDz);
  if (markL < EPS) return null;
  const viewDir = { x: markDz / markL, z: -markDx / markL };
  const shift = Number.isFinite(normalM) ? normalM : 0;
  const A = {
    x: markA.x + shift * viewDir.x,
    y: markA.y,
    z: markA.z + shift * viewDir.z,
  };
  const B = {
    x: markB.x + shift * viewDir.x,
    y: markB.y,
    z: markB.z + shift * viewDir.z,
  };
  const W = size?.width;
  const H = size?.height;
  if (!(W > 0) || !(H > 0) || !(meterByPx > 0)) return null;

  const dx = B.x - A.x;
  const dz = B.z - A.z;
  const L = Math.hypot(dx, dz);
  if (L < EPS) return null;
  const ux = dx / L;
  const uz = dz / L;

  const position = {
    x: (A.x + B.x) / 2 + alongM * ux,
    y: A.y + upM,
    z: (A.z + B.z) / 2 + alongM * uz,
  };

  // A in the page local frame (metres from the centre), then in image px.
  const lx = -L / 2 - alongM;
  const ly = -upM;
  const q1x = W / 2 + lx / meterByPx;
  const q1y = H / 2 - ly / meterByPx;
  const q2x = q1x + L / meterByPx;

  return {
    angleDeg: (Math.atan2(-uz, ux) * 180) / Math.PI,
    position,
    cloneNorm: {
      q1: { x: q1x / W, y: q1y / H },
      q2: { x: q2x / W, y: q1y / H },
    },
    widthM: W * meterByPx,
    heightM: H * meterByPx,
    axisU: { x: ux, z: uz },
    viewDir,
    anchors: { A, B },
  };
}
