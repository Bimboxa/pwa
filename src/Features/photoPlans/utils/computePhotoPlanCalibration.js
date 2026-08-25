import {
  mat3Multiply,
  mat3Invert,
  mat3ApplyToPoint,
  mat3NormalizeScale,
  v3Dot,
  v3Cross,
  v3Normalize,
  v3Scale,
  v3Sub,
} from "./mat3";
import estimateVanishingPoint from "./estimateVanishingPoint";
import estimateFocalFromVanishingPoints from "./estimateFocalFromVanishingPoints";

// Calibrate a photoPlan: build the homography H mapping NORMALIZED photo
// coords ([0..1] vs the photo's reference imageSize) to the plane's METRIC
// local frame (u, v) in meters, plus the plane's world pose.
//
// Inputs (all photo coords normalized 0..1, same space as db.points):
//   - uSegments / vSegments: >= 2 segments per family, drawn along the
//     plane's two orthogonal-in-the-world directions (U = first in-plane
//     axis, V = second; for a facade U = horizontal edges, V = verticals),
//   - photoTargets: the red/green pastilles on the photo,
//   - worldTargets: the SAME pastilles resolved in world XZ from the plan
//     view (caller: baseMapNormalizedToWorld), {red: {x, z}, green: {x, z}},
//   - refColor + refHeight: the reference pastille and its world height
//     (required for VERTICAL planes; plane altitude, default 0, for
//     HORIZONTAL ones),
//   - focalPxOverride: optional focal length in pixels (EXIF f35 * W / 36),
//     required only when one vanishing point is at infinity (NEEDS_FOCAL),
//   - knownCote: optional { p1, p2, lengthM } — a segment of KNOWN real
//     length drawn on the photo (normalized coords). When present it drives
//     the metric scale INSTEAD of the plan-side pastille distance (usually
//     far more accurate: a door / storey height is known to the cm); the
//     pastilles then only anchor + orient the plane, and the recomputed
//     pastille spacing becomes a coherence diagnostic.
//
// Math (single-view metric: square pixels, principal point at image center):
// centered coords xc = (px - W/2)/s, yc = -(py - H/2)/s with s = max(W, H);
// f from VP orthogonality; rays r = normalize((x/f, y/f, w)); plane frame
// e_u = r_u, e_v = Gram-Schmidt(r_v), M = [e_u | e_v | r0]; raw plane coords
// = dehomog(M^-1 . ray) (ref pastille at (0,0), global depth scale absorbed
// by the pastille-pair similarity). Closed-form — no DLT.
//
// Frames: (u, v) is y-UP in-plane; world = origin + u*uDir + v*vDir.
//
// Returns null on malformed args, else always an object:
//   { ok, errorCode?, H?, Hinv?, pose?, imageSize, planeType, horizonLine?,
//     diagnostics }
// so the UI can surface the failure reason (deliberate deviation from the
// bare-null convention of computeVerticalBaseMapPlacement).

const EPS = 1e-9;
const VPS_MIN_ANGLE_RAD = (5 * Math.PI) / 180;
const VPS_WARN_ANGLE_RAD = (15 * Math.PI) / 180;

export default function computePhotoPlanCalibration({
  photoImageSize,
  planeType,
  uSegments,
  vSegments,
  photoTargets,
  worldTargets,
  refColor,
  refHeight,
  focalPxOverride,
  knownCote,
}) {
  // --- malformed args -> null (nothing to diagnose) ---
  const W = photoImageSize?.width;
  const H = photoImageSize?.height;
  if (!W || !H) return null;
  if (planeType !== "VERTICAL" && planeType !== "HORIZONTAL") return null;
  if (!Array.isArray(uSegments) || !Array.isArray(vSegments)) return null;
  if (!photoTargets?.red || !photoTargets?.green) return null;
  if (!worldTargets?.red || !worldTargets?.green) return null;
  if (refColor !== "red" && refColor !== "green") return null;

  const otherColor = refColor === "red" ? "green" : "red";
  const s = Math.max(W, H);

  const diagnostics = { warnings: [] };
  const fail = (errorCode) => ({
    ok: false,
    errorCode,
    imageSize: { width: W, height: H },
    planeType,
    diagnostics,
  });

  // --- normalized -> centered (pixel-isotropic, y-up, origin at center) ---

  const toCentered = (p) => ({
    x: (p.x * W - W / 2) / s,
    y: -(p.y * H - H / 2) / s,
  });
  const toNormalized = (c) => ({
    x: (c.x * s + W / 2) / W,
    y: (-c.y * s + H / 2) / H,
  });
  const toCenteredSegments = (segments) =>
    segments.map((seg) => ({ p1: toCentered(seg.p1), p2: toCentered(seg.p2) }));

  // --- vanishing points ---

  const vpUResult = estimateVanishingPoint(toCenteredSegments(uSegments));
  if (!vpUResult) return fail("VP_U_DEGENERATE");
  const vpVResult = estimateVanishingPoint(toCenteredSegments(vSegments));
  if (!vpVResult) return fail("VP_V_DEGENERATE");

  diagnostics.vpUResidualDeg = vpUResult.residualDeg;
  diagnostics.vpVResidualDeg = vpVResult.residualDeg;
  diagnostics.vpUSpreadDeg = vpUResult.spreadDeg;
  diagnostics.vpVSpreadDeg = vpVResult.spreadDeg;
  const vpToDiag = (vp) =>
    Math.abs(vp[2]) < 1e-6
      ? { atInfinity: true, dir: { x: vp[0], y: vp[1] } }
      : toNormalized({ x: vp[0] / vp[2], y: vp[1] / vp[2] });
  diagnostics.vpU = vpToDiag(vpUResult.vp);
  diagnostics.vpV = vpToDiag(vpVResult.vp);

  // --- focal ---

  const focalOverride =
    Number.isFinite(focalPxOverride) && focalPxOverride > 0
      ? focalPxOverride / s
      : null;
  const focal = estimateFocalFromVanishingPoints({
    vpU: vpUResult.vp,
    vpV: vpVResult.vp,
    focalOverride,
  });
  if (focal.error) return fail(focal.error);
  diagnostics.warnings.push(...(focal.warnings ?? []));
  const f = focal.f;
  diagnostics.focalSource = focal.source;
  diagnostics.focalPx = focal.source === "frontoParallel" ? null : f * s;
  diagnostics.focal35 =
    focal.source === "frontoParallel" ? null : ((f * s) / W) * 36;
  if (
    diagnostics.focal35 != null &&
    (diagnostics.focal35 < 12 || diagnostics.focal35 > 200)
  ) {
    diagnostics.warnings.push("FOCAL_IMPLAUSIBLE");
  }

  // --- rays (uniform finite / infinite VP handling) ---

  const rayOfH = ([x, y, w]) => v3Normalize({ x: x / f, y: y / f, z: w });
  const rayOfPoint = (c) => v3Normalize({ x: c.x / f, y: c.y / f, z: 1 });

  let eU = rayOfH(vpUResult.vp);
  const rV = rayOfH(vpVResult.vp);
  const cRef = toCentered(photoTargets[refColor]);
  const cOther = toCentered(photoTargets[otherColor]);
  const r0 = rayOfPoint(cRef);
  if (!eU || !rV || !r0) return fail("VPS_TOO_CLOSE");

  const n = v3Cross(eU, rV);
  const sinUV = Math.hypot(n.x, n.y, n.z);
  if (sinUV < Math.sin(VPS_MIN_ANGLE_RAD)) return fail("VPS_TOO_CLOSE");
  if (sinUV < Math.sin(VPS_WARN_ANGLE_RAD)) {
    diagnostics.warnings.push("VPS_CLOSE");
  }
  let eV = v3Normalize(v3Sub(rV, v3Scale(eU, v3Dot(rV, eU))));
  if (!eV) return fail("VPS_TOO_CLOSE");
  if (focal.source === "override" || focal.source === "frontoParallel") {
    // Only meaningful when f was NOT solved from orthogonality.
    diagnostics.vpOrthoAngleDeg =
      (Math.asin(Math.min(1, sinUV)) * 180) / Math.PI;
  }

  // --- world anchors ---

  const P = worldTargets[refColor];
  const Q = worldTargets[otherColor];
  const dX = Q.x - P.x;
  const dZ = Q.z - P.z;
  const d = Math.hypot(dX, dZ);
  if (d < EPS) return fail("TARGETS_SUPERIMPOSED");

  const refH = planeType === "VERTICAL" ? refHeight : (refHeight ?? 0);
  if (!Number.isFinite(refH)) return fail("REF_HEIGHT_REQUIRED");

  // --- sign fixes on the plane frame ---

  if (planeType === "VERTICAL") {
    // e_v must be image-UP at the ref pastille (world up).
    const t = {
      x: r0.x + 0.01 * eV.x,
      y: r0.y + 0.01 * eV.y,
      z: r0.z + 0.01 * eV.z,
    };
    if (Math.abs(t.z) > EPS && Math.abs(r0.z) > EPS) {
      if (t.y / t.z < r0.y / r0.z) eV = v3Scale(eV, -1);
    }
  } else {
    // Handedness: plane normal (e_u x e_v) toward the camera (n . r0 < 0),
    // i.e. the camera shoots the floor from above — keeps the photo frame's
    // chirality consistent with world XZ seen from +Y.
    const nP = v3Cross(eU, eV);
    if (v3Dot(nP, r0) > 0) eV = v3Scale(eV, -1);
  }

  // --- raw plane coords: q = M^-1 . ray, dehomogenized ---

  const buildMinv = () =>
    mat3Invert([eU.x, eV.x, r0.x, eU.y, eV.y, r0.y, eU.z, eV.z, r0.z]);

  let Minv = buildMinv();
  if (!Minv) return fail("TARGET_ON_HORIZON");

  const planeRaw = (c) => {
    const q = mat3ApplyToPoint(
      [
        Minv[0],
        Minv[1],
        Minv[2],
        Minv[3],
        Minv[4],
        Minv[5],
        Minv[6],
        Minv[7],
        Minv[8],
      ],
      { x: c.x / f, y: c.y / f }
    );
    // mat3ApplyToPoint assumes homogeneous w = 1 — exactly a finite point ray.
    if (Math.abs(q.w) < EPS * (Math.abs(q.x) + Math.abs(q.y) + 1)) return null;
    return { u: q.x / q.w, v: q.y / q.w };
  };

  let qOther = planeRaw(cOther);
  if (!qOther) return fail("TARGET_ON_HORIZON");

  // Optional known-dimension scale. Computed on the CURRENT frame: raw
  // distances are invariant under the later e_u sign flip (u -> -u for every
  // point), so the order does not matter.
  let coteScale = null;
  if (knownCote?.p1 && knownCote?.p2) {
    if (!(Number.isFinite(knownCote.lengthM) && knownCote.lengthM > 0)) {
      return fail("COTE_LENGTH_REQUIRED");
    }
    const qc1 = planeRaw(toCentered(knownCote.p1));
    const qc2 = planeRaw(toCentered(knownCote.p2));
    if (!qc1 || !qc2) return fail("COTE_ON_HORIZON");
    const rawLen = Math.hypot(qc2.u - qc1.u, qc2.v - qc1.v);
    if (rawLen < EPS) return fail("COTE_DEGENERATE");
    coteScale = knownCote.lengthM / rawLen;
  }
  diagnostics.scaleSource = coteScale != null ? "cote" : "targets";

  // --- similarity from the pastille pair (scale overridden by the cote) ---

  let sc;
  let tV = 0;
  let pose;

  if (planeType === "VERTICAL") {
    // +u must appear RIGHTWARD in the photo at the ref pastille (canonical
    // camera-side frame). The flattened views render u to the right, so any
    // other sign choice — e.g. deriving it from which side the second
    // pastille sits — would display the plane MIRRORED whenever the ref
    // pastille is photo-right of the other one. d(x_img)/du at the ref is
    // proportional to e_u.x * r0.z - r0.x * e_u.z (r0.z > 0).
    if (eU.x * r0.z - r0.x * eU.z < 0) {
      eU = v3Scale(eU, -1);
      Minv = buildMinv();
      if (!Minv) return fail("TARGET_ON_HORIZON");
      qOther = planeRaw(cOther);
      if (!qOther) return fail("TARGET_ON_HORIZON");
    }
    const r2 = Math.hypot(qOther.u, qOther.v);
    if (r2 < EPS) return fail("PHOTO_TARGETS_SUPERIMPOSED");
    // The pastilles' horizontal spacing still orients the facade in the
    // WORLD (uDir sign below) and, without a cote, sets the scale.
    if (Math.abs(qOther.u) < 1e-6 * r2) return fail("TARGETS_SAME_U");
    const uSign = qOther.u >= 0 ? 1 : -1;
    sc = coteScale ?? d / Math.abs(qOther.u);
    tV = refH;
    const uDir = { x: (uSign * dX) / d, y: 0, z: (uSign * dZ) / d };
    pose = {
      origin: { x: P.x, y: 0, z: P.z },
      uDir,
      vDir: { x: 0, y: 1, z: 0 },
      normal: { x: -uDir.z, y: 0, z: uDir.x },
    };
    diagnostics.otherTargetV = qOther.v * sc + refH;
    // Coherence cross-check when the cote drives the scale: the pastilles'
    // horizontal spacing recomputed from the photo vs measured on the plan.
    diagnostics.targetsSpacingM = Math.abs(qOther.u) * sc;
    diagnostics.planTargetsDistanceM = d;
  } else {
    const r2 = Math.hypot(qOther.u, qOther.v);
    if (r2 < EPS) return fail("PHOTO_TARGETS_SUPERIMPOSED");
    sc = coteScale ?? d / r2;
    const a = qOther.u * sc;
    const b = qOther.v * sc;
    // In-plane rotation photo-frame -> world, from the single pastille pair:
    //   dX = a cos + b sin ; dZ = a sin - b cos
    // Normalized by (|ab| * d) so (cos, sin) is exactly unit even when the
    // cote-driven scale makes |ab| differ from d (reduces to the exact
    // Cramer solve, det = d^2, when the scale comes from the targets).
    const rn = Math.hypot(a, b);
    const cosPhi = (a * dX - b * dZ) / (rn * d);
    const sinPhi = (a * dZ + b * dX) / (rn * d);
    pose = {
      origin: { x: P.x, y: refH, z: P.z },
      uDir: { x: cosPhi, y: 0, z: sinPhi },
      vDir: { x: sinPhi, y: 0, z: -cosPhi },
      normal: { x: 0, y: 1, z: 0 },
    };
    diagnostics.targetsSpacingM = rn;
    diagnostics.planTargetsDistanceM = d;
  }

  if (
    coteScale != null &&
    Math.abs(diagnostics.targetsSpacingM - d) / d > 0.15
  ) {
    diagnostics.warnings.push("SCALE_MISMATCH");
  }

  // --- assemble H = S_T . M^-1 . K^-1 . C (normalized photo -> meters) ---

  const C = [W / s, 0, -W / (2 * s), 0, -H / s, H / (2 * s), 0, 0, 1];
  const Kinv = [1 / f, 0, 0, 0, 1 / f, 0, 0, 0, 1];
  const ST = [sc, 0, 0, 0, sc, tV, 0, 0, 1];
  const Hraw = mat3Multiply(ST, mat3Multiply(Minv, mat3Multiply(Kinv, C)));
  const Hn = mat3NormalizeScale(Hraw, photoTargets[refColor]);
  const Hinv = mat3Invert(Hn);
  if (!Hinv) return fail("TARGET_ON_HORIZON");

  const horizonLine =
    Math.hypot(Hn[6], Hn[7]) < 1e-9 * Math.max(Math.abs(Hn[8]), EPS)
      ? null
      : [Hn[6], Hn[7], Hn[8]];

  return {
    ok: true,
    H: Hn,
    Hinv,
    pose,
    imageSize: { width: W, height: H },
    planeType,
    horizonLine,
    diagnostics,
  };
}
