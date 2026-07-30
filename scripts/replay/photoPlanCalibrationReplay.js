// Node replay of the photoPlan calibration math (pure utils, no DOM/db).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/photoPlanCalibrationReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/photoPlanReplay.mjs && node /tmp/photoPlanReplay.mjs
//
// Scenarios: exact VERTICAL / HORIZONTAL / fronto-parallel recoveries against
// a synthetic pinhole camera, noise robustness, principal-point offset error
// magnitude, and every degenerate error code. Exits 1 on any failure.

import computePhotoPlanCalibration from "Features/photoPlans/utils/computePhotoPlanCalibration";
import applyPhotoPlanHomography from "Features/photoPlans/utils/applyPhotoPlanHomography";
import photoPlanPointToWorld from "Features/photoPlans/utils/photoPlanPointToWorld";
import mapPhotoPointsToPlane from "Features/photoPlans/utils/mapPhotoPointsToPlane";
import getPhotoPlanAttachment from "Features/photoPlans/utils/getPhotoPlanAttachment";

// --- tiny synthetic pinhole camera ------------------------------------------
// World: y up. Camera: position + lookAt; projects to PIXEL coords (y down)
// like the app's photo space. Principal point at (W/2 + ppdx, H/2 + ppdy).

function makeCamera({
  position,
  lookAt,
  up = { x: 0, y: 1, z: 0 },
  focalPx,
  W,
  H,
  ppdx = 0,
  ppdy = 0,
}) {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const norm = (a) => {
    const n = Math.hypot(a.x, a.y, a.z);
    return { x: a.x / n, y: a.y / n, z: a.z / n };
  };
  // Proper right-handed camera basis: right x camUp = fwd (a mirrored basis
  // would produce physically impossible photos and break chirality checks).
  const fwd = norm(sub(lookAt, position)); // camera +z (view direction)
  const right = norm(cross(up, fwd)); // camera +x (image x, right)
  const camUp = cross(fwd, right); // camera y-up (image y-up)

  return {
    W,
    H,
    focalPx,
    project(world) {
      const d = sub(world, position);
      const xc = d.x * right.x + d.y * right.y + d.z * right.z;
      const yc = d.x * camUp.x + d.y * camUp.y + d.z * camUp.z;
      const zc = d.x * fwd.x + d.y * fwd.y + d.z * fwd.z;
      if (zc <= 0) throw new Error("point behind camera");
      // pixel coords, y DOWN
      const px = W / 2 + ppdx + (focalPx * xc) / zc;
      const py = H / 2 + ppdy - (focalPx * yc) / zc;
      return { x: px, y: py };
    },
    // normalized [0..1]
    projectN(world) {
      const p = this.project(world);
      return { x: p.x / W, y: p.y / H };
    },
  };
}

// mulberry32 — deterministic PRNG (Date.now/Math.random are banned here).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- assertion harness -------------------------------------------------------

let failures = 0;
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label} ${detail}`);
  }
}
function approx(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

// Segment between two world points, as normalized photo coords, with optional noise.
function segN(cam, w1, w2, rng = null, sigmaPx = 0) {
  const jitter = (p) => {
    if (!rng || !sigmaPx) return p;
    // Box-Muller-ish: two uniforms -> approx gaussian
    const g = () => (rng() + rng() + rng() + rng() - 2) * Math.SQRT2 * sigmaPx;
    return { x: p.x + g() / cam.W, y: p.y + g() / cam.H };
  };
  return { p1: jitter(cam.projectN(w1)), p2: jitter(cam.projectN(w2)) };
}

const polyArea = (pts) => {
  let s2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s2) / 2;
};

// =============================================================================
// Scenario 1 — VERTICAL exact: facade at 35deg azimuth, tilted camera.
// =============================================================================
console.log("\n[1] VERTICAL exact");
{
  const az = (35 * Math.PI) / 180;
  const uDir = { x: Math.cos(az), y: 0, z: Math.sin(az) };
  const origin = { x: 4, y: 0, z: 7 }; // facade anchor (ref pastille foot)
  const P = (u, v) => ({
    x: origin.x + u * uDir.x,
    y: v,
    z: origin.z + u * uDir.z,
  });
  // camera in front of the facade, OBLIQUE (fwd has a u-component, otherwise
  // the facade horizontals are image-parallel => VP_u at infinity) and tilted
  // up (otherwise the verticals are image-parallel => VP_v at infinity).
  const normal = { x: -uDir.z, y: 0, z: uDir.x };
  const cam = makeCamera({
    position: {
      x: origin.x - 2 * uDir.x - 9 * normal.x,
      y: 1.0,
      z: origin.z - 2 * uDir.z - 9 * normal.z,
    },
    lookAt: P(3, 2.8),
    focalPx: 1300,
    W: 1600,
    H: 1200,
  });

  // vanishing-line segments: 3 horizontal + 3 vertical facade edges
  const uSegments = [
    segN(cam, P(0.5, 0.4), P(5.5, 0.4)),
    segN(cam, P(0.2, 2.6), P(5.2, 2.6)),
    segN(cam, P(1.0, 4.8), P(6.0, 4.8)),
  ];
  const vSegments = [
    segN(cam, P(0.8, 0.2), P(0.8, 4.6)),
    segN(cam, P(3.1, 0.4), P(3.1, 5.0)),
    segN(cam, P(5.4, 0.1), P(5.4, 4.2)),
  ];

  // pastilles at DIFFERENT heights (only ref height is fed in)
  const refWorld = P(0.6, 1.1);
  const otherWorld = P(4.9, 2.3);
  const photoTargets = {
    green: cam.projectN(refWorld),
    red: cam.projectN(otherWorld),
  };
  const worldTargets = {
    green: { x: refWorld.x, z: refWorld.z },
    red: { x: otherWorld.x, z: otherWorld.z },
  };

  const calib = computePhotoPlanCalibration({
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "VERTICAL",
    uSegments,
    vSegments,
    photoTargets,
    worldTargets,
    refColor: "green",
    refHeight: refWorld.y,
  });

  check("ok", calib?.ok === true, JSON.stringify(calib?.errorCode));
  if (calib?.ok) {
    check(
      "focal recovered",
      approx(calib.diagnostics.focalPx, cam.focalPx, 1e-3 * cam.focalPx),
      `got ${calib.diagnostics.focalPx}`
    );
    check(
      "otherTargetV",
      approx(calib.diagnostics.otherTargetV, otherWorld.y, 1e-6),
      `got ${calib.diagnostics.otherTargetV}`
    );
    // known 6x3 m rectangle at (u in [0.5, 6.5], v in [0.9, 3.9])
    const corners = [P(0.5, 0.9), P(6.5, 0.9), P(6.5, 3.9), P(0.5, 3.9)];
    const uv = corners.map((c) =>
      applyPhotoPlanHomography(calib.H, cam.projectN(c))
    );
    check("corners mapped", uv.every(Boolean));
    const w = Math.hypot(uv[1].x - uv[0].x, uv[1].y - uv[0].y);
    const h = Math.hypot(uv[3].x - uv[0].x, uv[3].y - uv[0].y);
    check("side 6m", approx(w, 6, 1e-6), `got ${w}`);
    check("side 3m", approx(h, 3, 1e-6), `got ${h}`);
    check("area 18m2", approx(polyArea(uv), 18, 1e-5), `got ${polyArea(uv)}`);
    // world reconstruction
    const wr = corners.map((c) =>
      photoPlanPointToWorld(calib, cam.projectN(c))
    );
    const maxErr = Math.max(
      ...wr.map((p, i) =>
        Math.hypot(p.x - corners[i].x, p.y - corners[i].y, p.z - corners[i].z)
      )
    );
    check("world corners", maxErr < 1e-6, `maxErr ${maxErr}`);
    // pose axes
    check(
      "pose uDir",
      approx(calib.pose.uDir.x, uDir.x, 1e-9) &&
        approx(calib.pose.uDir.z, uDir.z, 1e-9)
    );
    check("pose vDir up", calib.pose.vDir.y === 1);
  }
}

// =============================================================================
// Scenario 2 — HORIZONTAL exact: terrace at y=0.3, L-shaped polygon
// (mirror/chirality tripwire), pastilles NOT aligned with U.
// =============================================================================
console.log("\n[2] HORIZONTAL exact");
{
  const h = 0.3;
  const az = (20 * Math.PI) / 180; // U family azimuth (unknown to the solver)
  const u = { x: Math.cos(az), y: 0, z: Math.sin(az) };
  const v = { x: -Math.sin(az), y: 0, z: Math.cos(az) };
  const G = (a, b) => ({
    x: 2 + a * u.x + b * v.x,
    y: h,
    z: 3 + a * u.z + b * v.z,
  });
  const cam = makeCamera({
    position: { x: -4, y: 6, z: -3 },
    lookAt: G(3, 3),
    focalPx: 1500,
    W: 2000,
    H: 1500,
  });

  const uSegments = [
    segN(cam, G(0, 0.5), G(6, 0.5)),
    segN(cam, G(0.3, 4.5), G(6.3, 4.5)),
  ];
  const vSegments = [
    segN(cam, G(0.7, 0), G(0.7, 5.5)),
    segN(cam, G(5.6, 0.2), G(5.6, 5.8)),
  ];

  const refWorld = G(0.9, 0.8);
  const otherWorld = G(4.7, 3.9); // diagonal — not along U
  const photoTargets = {
    green: cam.projectN(refWorld),
    red: cam.projectN(otherWorld),
  };
  const worldTargets = {
    green: { x: refWorld.x, z: refWorld.z },
    red: { x: otherWorld.x, z: otherWorld.z },
  };

  const calib = computePhotoPlanCalibration({
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "HORIZONTAL",
    uSegments,
    vSegments,
    photoTargets,
    worldTargets,
    refColor: "green",
    refHeight: h,
  });

  check("ok", calib?.ok === true, JSON.stringify(calib?.errorCode));
  if (calib?.ok) {
    check(
      "focal recovered",
      approx(calib.diagnostics.focalPx, cam.focalPx, 1e-3 * cam.focalPx),
      `got ${calib.diagnostics.focalPx}`
    );
    // asymmetric L-shape (world) — reconstruction must NOT be mirrored
    const L = [G(1, 1), G(4, 1), G(4, 2), G(2, 2), G(2, 4), G(1, 4)];
    const wr = L.map((c) => photoPlanPointToWorld(calib, cam.projectN(c)));
    const maxErr = Math.max(
      ...wr.map((p, i) => Math.hypot(p.x - L[i].x, p.y - L[i].y, p.z - L[i].z))
    );
    check("L-shape world", maxErr < 1e-6, `maxErr ${maxErr}`);
    const uv = L.map((c) => applyPhotoPlanHomography(calib.H, cam.projectN(c)));
    check("L area 5m2", approx(polyArea(uv), 5, 1e-5), `got ${polyArea(uv)}`);
    check("plane altitude", approx(calib.pose.origin.y, h, 1e-12));
  }
}

// =============================================================================
// Scenario 3 — fronto-parallel VERTICAL (camera axis ⟂ facade): both VPs at
// infinity, exact lengths, focalSource "frontoParallel".
// =============================================================================
console.log("\n[3] fronto-parallel");
{
  const P = (u, v) => ({ x: u, y: v, z: 0 }); // facade in the XY plane
  const cam = makeCamera({
    position: { x: 3, y: 2, z: -10 },
    lookAt: { x: 3, y: 2, z: 0 },
    focalPx: 1200,
    W: 1600,
    H: 1200,
  });

  const uSegments = [
    segN(cam, P(0, 0.5), P(6, 0.5)),
    segN(cam, P(0, 3.5), P(6, 3.5)),
  ];
  const vSegments = [segN(cam, P(1, 0), P(1, 4)), segN(cam, P(5, 0), P(5, 4))];
  const refWorld = P(1.2, 0.8);
  const otherWorld = P(4.8, 2.9);
  const calib = computePhotoPlanCalibration({
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "VERTICAL",
    uSegments,
    vSegments,
    photoTargets: {
      green: cam.projectN(refWorld),
      red: cam.projectN(otherWorld),
    },
    worldTargets: {
      green: { x: refWorld.x, z: refWorld.z },
      red: { x: otherWorld.x, z: otherWorld.z },
    },
    refColor: "green",
    refHeight: refWorld.y,
  });
  check("ok", calib?.ok === true, JSON.stringify(calib?.errorCode));
  if (calib?.ok) {
    check(
      "frontoParallel source",
      calib.diagnostics.focalSource === "frontoParallel",
      calib.diagnostics.focalSource
    );
    check("no horizon", calib.horizonLine === null);
    const A = photoPlanPointToWorld(calib, cam.projectN(P(0.5, 1)));
    const B = photoPlanPointToWorld(calib, cam.projectN(P(5.5, 1)));
    const len = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
    check("length 5m", approx(len, 5, 1e-6), `got ${len}`);
    check(
      "otherTargetV exact",
      approx(calib.diagnostics.otherTargetV, otherWorld.y, 1e-6),
      `got ${calib.diagnostics.otherTargetV}`
    );
  }
}

// =============================================================================
// Scenario 4 — noise sigma = 0.5 px on all endpoints: area <= 2%, f <= 5%.
// =============================================================================
console.log("\n[4] noise 0.5px");
{
  const rng = mulberry32(42);
  const az = (35 * Math.PI) / 180;
  const uDir = { x: Math.cos(az), y: 0, z: Math.sin(az) };
  const origin = { x: 4, y: 0, z: 7 };
  const normal = { x: -uDir.z, y: 0, z: uDir.x };
  const P = (u, v) => ({
    x: origin.x + u * uDir.x,
    y: v,
    z: origin.z + u * uDir.z,
  });
  const cam = makeCamera({
    position: {
      x: origin.x - 2 * uDir.x - 9 * normal.x,
      y: 1.0,
      z: origin.z - 2 * uDir.z - 9 * normal.z,
    },
    lookAt: P(3, 2.8),
    focalPx: 1300,
    W: 1600,
    H: 1200,
  });
  const uSegments = [
    segN(cam, P(0.5, 0.4), P(5.5, 0.4), rng, 0.5),
    segN(cam, P(0.2, 2.6), P(5.2, 2.6), rng, 0.5),
    segN(cam, P(1.0, 4.8), P(6.0, 4.8), rng, 0.5),
  ];
  const vSegments = [
    segN(cam, P(0.8, 0.2), P(0.8, 4.6), rng, 0.5),
    segN(cam, P(3.1, 0.4), P(3.1, 5.0), rng, 0.5),
    segN(cam, P(5.4, 0.1), P(5.4, 4.2), rng, 0.5),
  ];
  const refWorld = P(0.6, 1.1);
  const otherWorld = P(4.9, 2.3);
  const calib = computePhotoPlanCalibration({
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "VERTICAL",
    uSegments,
    vSegments,
    photoTargets: {
      green: cam.projectN(refWorld),
      red: cam.projectN(otherWorld),
    },
    worldTargets: {
      green: { x: refWorld.x, z: refWorld.z },
      red: { x: otherWorld.x, z: otherWorld.z },
    },
    refColor: "green",
    refHeight: refWorld.y,
  });
  check("ok", calib?.ok === true, JSON.stringify(calib?.errorCode));
  if (calib?.ok) {
    const fErr =
      Math.abs(calib.diagnostics.focalPx - cam.focalPx) / cam.focalPx;
    check("focal <= 5%", fErr <= 0.05, `err ${(fErr * 100).toFixed(2)}%`);
    const corners = [P(0.5, 0.9), P(6.5, 0.9), P(6.5, 3.9), P(0.5, 3.9)];
    const uv = corners.map((c) =>
      applyPhotoPlanHomography(calib.H, cam.projectN(c))
    );
    const aErr = Math.abs(polyArea(uv) - 18) / 18;
    check("area <= 2%", aErr <= 0.02, `err ${(aErr * 100).toFixed(2)}%`);
  }
}

// =============================================================================
// Scenario 5 — principal point offset 3% of W (algo assumes center): error
// curve vs facade obliquity; documents the assumption's magnitude.
// =============================================================================
console.log("\n[5] principal-point offset 3%W");
{
  for (const azDeg of [15, 25, 40]) {
    const az = (azDeg * Math.PI) / 180;
    const uDir = { x: Math.cos(az), y: 0, z: Math.sin(az) };
    const origin = { x: 4, y: 0, z: 7 };
    const normal = { x: -uDir.z, y: 0, z: uDir.x };
    const P = (u, v) => ({
      x: origin.x + u * uDir.x,
      y: v,
      z: origin.z + u * uDir.z,
    });
    const cam = makeCamera({
      position: {
        x: origin.x - 2 * uDir.x - 9 * normal.x,
        y: 1.0,
        z: origin.z - 2 * uDir.z - 9 * normal.z,
      },
      lookAt: P(3, 2.8),
      focalPx: 1300,
      W: 1600,
      H: 1200,
      ppdx: 0.03 * 1600,
    });
    const uSegments = [
      segN(cam, P(0.5, 0.4), P(5.5, 0.4)),
      segN(cam, P(1.0, 4.8), P(6.0, 4.8)),
    ];
    const vSegments = [
      segN(cam, P(0.8, 0.2), P(0.8, 4.6)),
      segN(cam, P(5.4, 0.1), P(5.4, 4.2)),
    ];
    const refWorld = P(0.6, 1.1);
    const otherWorld = P(4.9, 2.3);
    const calib = computePhotoPlanCalibration({
      photoImageSize: { width: cam.W, height: cam.H },
      planeType: "VERTICAL",
      uSegments,
      vSegments,
      photoTargets: {
        green: cam.projectN(refWorld),
        red: cam.projectN(otherWorld),
      },
      worldTargets: {
        green: { x: refWorld.x, z: refWorld.z },
        red: { x: otherWorld.x, z: otherWorld.z },
      },
      refColor: "green",
      refHeight: refWorld.y,
    });
    if (!calib?.ok) {
      check(`az ${azDeg} ok`, false, calib?.errorCode);
      continue;
    }
    const corners = [P(0.5, 0.9), P(6.5, 0.9), P(6.5, 3.9), P(0.5, 3.9)];
    const uv = corners.map((c) =>
      applyPhotoPlanHomography(calib.H, cam.projectN(c))
    );
    const aErr = Math.abs(polyArea(uv) - 18) / 18;
    console.log(
      `  info az=${azDeg}deg -> area error ${(aErr * 100).toFixed(2)}%`
    );
    check(
      `az ${azDeg} area <= ~6%`,
      aErr <= 0.06,
      `${(aErr * 100).toFixed(2)}%`
    );
  }
}

// =============================================================================
// Scenario 6 — degenerate inputs -> ok:false + exact errorCode.
// =============================================================================
console.log("\n[6] degenerates");
{
  const cam = makeCamera({
    position: { x: 3, y: 2, z: -10 },
    lookAt: { x: 3, y: 2, z: 0 },
    focalPx: 1200,
    W: 1600,
    H: 1200,
  });
  const P = (u, v) => ({ x: u, y: v, z: 0 });
  const base = {
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "VERTICAL",
    uSegments: [
      segN(cam, P(0, 0.5), P(6, 0.5)),
      segN(cam, P(0, 3.5), P(6, 3.5)),
    ],
    vSegments: [segN(cam, P(1, 0), P(1, 4)), segN(cam, P(5, 0), P(5, 4))],
    photoTargets: {
      green: cam.projectN(P(1.2, 0.8)),
      red: cam.projectN(P(4.8, 2.9)),
    },
    worldTargets: { green: { x: 1.2, z: 0 }, red: { x: 4.8, z: 0 } },
    refColor: "green",
    refHeight: 0.8,
  };
  const expectCode = (label, patch, code) => {
    const r = computePhotoPlanCalibration({ ...base, ...patch });
    check(
      label,
      r && r.ok === false && r.errorCode === code,
      `got ${r?.errorCode ?? r}`
    );
  };

  expectCode(
    "1 segment",
    { uSegments: [base.uSegments[0]] },
    "VP_U_DEGENERATE"
  );
  expectCode(
    "collinear family",
    {
      vSegments: [
        segN(cam, P(1, 0), P(1, 2)),
        segN(cam, P(1, 2), P(1, 4)), // same line
      ],
    },
    "VP_V_DEGENERATE"
  );
  expectCode("coincident VPs", { vSegments: base.uSegments }, "VPS_TOO_CLOSE");
  expectCode(
    "superimposed plan targets",
    { worldTargets: { green: { x: 2, z: 1 }, red: { x: 2, z: 1 } } },
    "TARGETS_SUPERIMPOSED"
  );
  expectCode(
    "vertically stacked pastilles",
    {
      photoTargets: {
        green: cam.projectN(P(2.5, 0.6)),
        red: cam.projectN(P(2.5, 3.2)), // same u
      },
    },
    "TARGETS_SAME_U"
  );
  expectCode("missing refHeight", { refHeight: null }, "REF_HEIGHT_REQUIRED");

  // NEEDS_FOCAL: verticals parallel (level camera), horizontals converging.
  {
    const az = (30 * Math.PI) / 180;
    const uDir = { x: Math.cos(az), y: 0, z: Math.sin(az) };
    const origin = { x: 0, y: 0, z: 6 };
    const normal = { x: -uDir.z, y: 0, z: uDir.x };
    const F = (u, v) => ({
      x: origin.x + u * uDir.x,
      y: v,
      z: origin.z + u * uDir.z,
    });
    // LEVEL camera (same height as lookAt) => vertical edges stay parallel;
    // OBLIQUE azimuth so the horizontals still converge (finite VP_u).
    const camL = makeCamera({
      position: {
        x: origin.x - 1 * uDir.x - 8 * normal.x,
        y: 2,
        z: origin.z - 1 * uDir.z - 8 * normal.z,
      },
      lookAt: F(2, 2),
      focalPx: 1400,
      W: 1600,
      H: 1200,
    });
    const inputs = {
      photoImageSize: { width: camL.W, height: camL.H },
      planeType: "VERTICAL",
      uSegments: [
        segN(camL, F(0, 0.5), F(5, 0.5)),
        segN(camL, F(0, 3.5), F(5, 3.5)),
      ],
      vSegments: [segN(camL, F(1, 0), F(1, 4)), segN(camL, F(4, 0), F(4, 4))],
      photoTargets: {
        green: camL.projectN(F(0.8, 1.0)),
        red: camL.projectN(F(4.2, 2.5)),
      },
      worldTargets: {
        green: { x: F(0.8, 0).x, z: F(0.8, 0).z },
        red: { x: F(4.2, 0).x, z: F(4.2, 0).z },
      },
      refColor: "green",
      refHeight: 1.0,
    };
    const r1 = computePhotoPlanCalibration(inputs);
    check(
      "NEEDS_FOCAL without override",
      r1 && r1.ok === false && r1.errorCode === "NEEDS_FOCAL",
      `got ${r1?.errorCode}`
    );
    const r2 = computePhotoPlanCalibration({
      ...inputs,
      focalPxOverride: 1400,
    });
    check("override unlocks", r2?.ok === true, JSON.stringify(r2?.errorCode));
    if (r2?.ok) {
      const A = photoPlanPointToWorld(r2, camL.projectN(F(0.5, 1)));
      const B = photoPlanPointToWorld(r2, camL.projectN(F(4.5, 1)));
      const len = Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
      check("override accurate 4m", approx(len, 4, 1e-6), `got ${len}`);
      check(
        "otherTargetV accurate",
        approx(r2.diagnostics.otherTargetV, 2.5, 1e-6),
        `got ${r2.diagnostics.otherTargetV}`
      );
    }
  }
}

// =============================================================================
// Scenario 7 — mapPhotoPointsToPlane: identity-ish H + arc expansion.
// =============================================================================
console.log("\n[7] mapPhotoPointsToPlane");
{
  // H = pure scaling: normalized -> "meters" (W=100, so 1 px = 0.01 m in x)
  const W = 100;
  const Hm = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // normalized in, normalized out
  const pts = [
    { x: 0, y: 0, id: "a" },
    { x: 50, y: 50, type: "circle" }, // genuine arc (non-collinear)
    { x: 100, y: 0, id: "b" },
  ];
  const mapped = mapPhotoPointsToPlane({
    H: Hm,
    points: pts,
    imageSize: { width: W, height: W },
  });
  check("arc expanded", mapped && mapped.length > 3, `len ${mapped?.length}`);
  check(
    "ids preserved on anchors",
    mapped?.[0]?.id === "a" && mapped?.[mapped.length - 1]?.id === "b"
  );
  // degenerate (collinear) arc falls back to straight — endpoints exact
  check(
    "endpoints",
    approx(mapped[0].x, 0, 1e-12) &&
      approx(mapped[mapped.length - 1].x, 1, 1e-12)
  );
}

// =============================================================================
// Scenario 8 — getPhotoPlanAttachment: inside / outside / hole / nested rings.
// =============================================================================
console.log("\n[8] getPhotoPlanAttachment");
{
  const square = (x0, y0, size) => [
    { x: x0, y: y0 },
    { x: x0 + size, y: y0 },
    { x: x0 + size, y: y0 + size },
    { x: x0, y: y0 + size },
  ];
  const candidates = [
    { plan: { id: "big" }, ringPx: square(0, 0, 100), holesPx: [] },
    { plan: { id: "small" }, ringPx: square(20, 20, 30), holesPx: [] },
    {
      plan: { id: "withHole" },
      ringPx: square(200, 0, 100),
      holesPx: [square(240, 40, 20)],
    },
  ];
  const at = (x, y) =>
    getPhotoPlanAttachment({ points: [{ x, y }], candidates })?.plan?.id ??
    null;

  check("nested -> smallest wins", at(30, 30) === "small", at(30, 30));
  check("big only", at(80, 80) === "big", at(80, 80));
  check("outside -> null", at(500, 500) === null, at(500, 500));
  check("in hole -> null", at(250, 50) === null, at(250, 50));
  check("in ring, out of hole", at(210, 10) === "withHole", at(210, 10));
}

// =============================================================================
// Scenario 9 — knownCote drives the scale: plan-target distance errors no
// longer affect the metric (the pastilles only anchor + orient).
// =============================================================================
console.log("\n[9] knownCote scale");
{
  // --- VERTICAL: other plan target pushed 20% too far ALONG the facade
  // direction (azimuth unchanged, distance d wrong by +20%).
  const az = (35 * Math.PI) / 180;
  const uDir = { x: Math.cos(az), y: 0, z: Math.sin(az) };
  const origin = { x: 4, y: 0, z: 7 };
  const normal = { x: -uDir.z, y: 0, z: uDir.x };
  const P = (u, v) => ({
    x: origin.x + u * uDir.x,
    y: v,
    z: origin.z + u * uDir.z,
  });
  const cam = makeCamera({
    position: {
      x: origin.x - 2 * uDir.x - 9 * normal.x,
      y: 1.0,
      z: origin.z - 2 * uDir.z - 9 * normal.z,
    },
    lookAt: P(3, 2.8),
    focalPx: 1300,
    W: 1600,
    H: 1200,
  });
  const uSegments = [
    segN(cam, P(0.5, 0.4), P(5.5, 0.4)),
    segN(cam, P(1.0, 4.8), P(6.0, 4.8)),
  ];
  const vSegments = [
    segN(cam, P(0.8, 0.2), P(0.8, 4.6)),
    segN(cam, P(5.4, 0.1), P(5.4, 4.2)),
  ];
  const refWorld = P(0.6, 1.1);
  const otherWorld = P(4.9, 2.3);
  const otherPerturbed = P(0.6 + (4.9 - 0.6) * 1.2, 0); // +20% along u
  const base = {
    photoImageSize: { width: cam.W, height: cam.H },
    planeType: "VERTICAL",
    uSegments,
    vSegments,
    photoTargets: {
      green: cam.projectN(refWorld),
      red: cam.projectN(otherWorld),
    },
    worldTargets: {
      green: { x: refWorld.x, z: refWorld.z },
      red: { x: otherPerturbed.x, z: otherPerturbed.z },
    },
    refColor: "green",
    refHeight: refWorld.y,
  };
  // a VERTICAL known dimension (storey-height style): 3 m
  const cote = {
    p1: cam.projectN(P(2, 0.5)),
    p2: cam.projectN(P(2, 3.5)),
    lengthM: 3,
  };

  const corners = [P(0.5, 0.9), P(6.5, 0.9), P(6.5, 3.9), P(0.5, 3.9)];

  const noCote = computePhotoPlanCalibration(base);
  check("V perturbed ok (no cote)", noCote?.ok === true, noCote?.errorCode);
  if (noCote?.ok) {
    const uv = corners.map((c) =>
      applyPhotoPlanHomography(noCote.H, cam.projectN(c))
    );
    const aErr = Math.abs(polyArea(uv) - 18) / 18;
    check(
      "no cote -> area off by ~44%",
      aErr > 0.3,
      `${(aErr * 100).toFixed(1)}%`
    );
  }

  const withCote = computePhotoPlanCalibration({ ...base, knownCote: cote });
  check("V with cote ok", withCote?.ok === true, withCote?.errorCode);
  if (withCote?.ok) {
    check(
      "scaleSource cote",
      withCote.diagnostics.scaleSource === "cote",
      withCote.diagnostics.scaleSource
    );
    const wr = corners.map((c) =>
      photoPlanPointToWorld(withCote, cam.projectN(c))
    );
    const maxErr = Math.max(
      ...wr.map((p, i) =>
        Math.hypot(p.x - corners[i].x, p.y - corners[i].y, p.z - corners[i].z)
      )
    );
    check("world corners exact", maxErr < 1e-6, `maxErr ${maxErr}`);
    check(
      "otherTargetV exact",
      approx(withCote.diagnostics.otherTargetV, otherWorld.y, 1e-6),
      `got ${withCote.diagnostics.otherTargetV}`
    );
    check(
      "SCALE_MISMATCH flagged (20% off)",
      withCote.diagnostics.warnings.includes("SCALE_MISMATCH")
    );
    check(
      "coherence numbers",
      approx(
        withCote.diagnostics.targetsSpacingM,
        4.3,
        1e-6 // true horizontal spacing |4.9 - 0.6|
      ) && approx(withCote.diagnostics.planTargetsDistanceM, 4.3 * 1.2, 1e-9),
      `spacing ${withCote.diagnostics.targetsSpacingM} vs plan ${withCote.diagnostics.planTargetsDistanceM}`
    );
  }

  // --- HORIZONTAL: other plan target pushed +15% radially (direction kept).
  {
    const h = 0.3;
    const azH = (20 * Math.PI) / 180;
    const u = { x: Math.cos(azH), y: 0, z: Math.sin(azH) };
    const v = { x: -Math.sin(azH), y: 0, z: Math.cos(azH) };
    const G = (a, b) => ({
      x: 2 + a * u.x + b * v.x,
      y: h,
      z: 3 + a * u.z + b * v.z,
    });
    const camH = makeCamera({
      position: { x: -4, y: 6, z: -3 },
      lookAt: G(3, 3),
      focalPx: 1500,
      W: 2000,
      H: 1500,
    });
    const refW = G(0.9, 0.8);
    const otherW = G(4.7, 3.9);
    const otherP = {
      x: refW.x + (otherW.x - refW.x) * 1.15,
      z: refW.z + (otherW.z - refW.z) * 1.15,
    };
    const calib = computePhotoPlanCalibration({
      photoImageSize: { width: camH.W, height: camH.H },
      planeType: "HORIZONTAL",
      uSegments: [
        segN(camH, G(0, 0.5), G(6, 0.5)),
        segN(camH, G(0.3, 4.5), G(6.3, 4.5)),
      ],
      vSegments: [
        segN(camH, G(0.7, 0), G(0.7, 5.5)),
        segN(camH, G(5.6, 0.2), G(5.6, 5.8)),
      ],
      photoTargets: {
        green: camH.projectN(refW),
        red: camH.projectN(otherW),
      },
      worldTargets: {
        green: { x: refW.x, z: refW.z },
        red: otherP,
      },
      refColor: "green",
      refHeight: h,
      knownCote: {
        p1: camH.projectN(G(0, 0.5)),
        p2: camH.projectN(G(6, 0.5)),
        lengthM: 6,
      },
    });
    check("H with cote ok", calib?.ok === true, calib?.errorCode);
    if (calib?.ok) {
      const L = [G(1, 1), G(4, 1), G(4, 2), G(2, 2), G(2, 4), G(1, 4)];
      const wr = L.map((c) => photoPlanPointToWorld(calib, camH.projectN(c)));
      const maxErr = Math.max(
        ...wr.map((p, i) =>
          Math.hypot(p.x - L[i].x, p.y - L[i].y, p.z - L[i].z)
        )
      );
      check("H L-shape exact", maxErr < 1e-6, `maxErr ${maxErr}`);
    }
  }

  // --- degenerates
  const same = cam.projectN(P(2, 2));
  const dCote = computePhotoPlanCalibration({
    ...base,
    knownCote: { p1: same, p2: same, lengthM: 3 },
  });
  check(
    "COTE_DEGENERATE",
    dCote?.ok === false && dCote?.errorCode === "COTE_DEGENERATE",
    dCote?.errorCode
  );
  const noLen = computePhotoPlanCalibration({
    ...base,
    knownCote: { p1: cote.p1, p2: cote.p2, lengthM: null },
  });
  check(
    "COTE_LENGTH_REQUIRED",
    noLen?.ok === false && noLen?.errorCode === "COTE_LENGTH_REQUIRED",
    noLen?.errorCode
  );
}

// -----------------------------------------------------------------------------
console.log(failures === 0 ? "\nALL OK" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
