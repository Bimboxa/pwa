import {
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
} from "three";
import { liveQuery } from "dexie";

import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";

// Extrudes a 2D profile (one or more polyline annotations sharing an
// `isProfile=true` annotationTemplate) along a guide polyline. Hidden guide
// segments produce gaps in the swept surface. The profile lives in a plane
// orthogonal to both the basemap plane and the guide tangent; specifically:
//   - profile X (drawing horizontal) → right-of-tangent normal in the
//     basemap XY plane (right-hand rule with basemap-local Z).
//   - profile Y (drawing vertical, after pixel-Y flip) → basemap-local Z.
//
// Caller passes `guidePointsLocal` already converted to basemap-local meters
// (z=0 in the basemap plane). `verticalLift` is added along Z. Returns a
// placeholder Group synchronously and subscribes to the profile's Dexie data
// via `liveQuery` so the swept mesh rebuilds whenever the profile annotations
// change (added / soft-deleted / repositioned). The unsubscribe hook is
// stored in `userData.dispose` for the AnnotationsManager to call on cleanup.

const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

export default function buildExtrudedProfileMesh(
  guidePointsLocal,
  profileTemplateId,
  material,
  verticalLift = 0,
  hiddenSegmentsIdx = []
) {
  if (!guidePointsLocal || guidePointsLocal.length < 2) return null;
  if (!profileTemplateId) return null;

  const placeholder = new Group();

  function clearChildren() {
    while (placeholder.children.length > 0) {
      const child = placeholder.children[0];
      placeholder.remove(child);
      child.traverse?.((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
  }

  function applyResolution(res) {
    clearChildren();
    if (!res || !res.anchorPx || res.profiles.length === 0) return;
    const swept = sweepProfileAlongGuide({
      guidePointsLocal,
      hiddenSegmentsIdx,
      profiles: res.profiles,
      anchorPx: res.anchorPx,
      verticalLift,
      material,
    });
    if (swept) placeholder.add(swept);
  }

  // Use Dexie's liveQuery so the mesh re-resolves whenever profile annotations
  // change — including when the user soft-deletes one and draws a new one,
  // even though those edits live on a different basemap from the guide and
  // therefore do NOT trigger the parent 3D-scene rebuild path
  // (`useAutoLoadAnnotationsInThreedEditor` filters by main basemap).
  const subscription = liveQuery(() =>
    resolveProfileFromDb(profileTemplateId)
  ).subscribe({
    next: (res) => applyResolution(res),
    error: (err) => {
      console.error("[EXTRUSION_PROFILE] live profile resolution failed", err);
    },
  });

  // AnnotationsManager.deleteAllAnnotationsObjects reads this hook to clean
  // up the subscription when the placeholder is removed from the scene.
  placeholder.userData = {
    ...(placeholder.userData ?? {}),
    dispose: () => subscription.unsubscribe(),
  };

  return placeholder;
}

function sweepProfileAlongGuide({
  guidePointsLocal,
  hiddenSegmentsIdx,
  profiles,
  anchorPx,
  verticalLift,
  material,
}) {
  const hidden = new Set(hiddenSegmentsIdx ?? []);
  const group = new Group();

  // Pre-compute per-segment frames (tangent + right-normal in the basemap XY
  // plane). One frame per guide segment. v1: no corner mitering — the swept
  // surface reorients abruptly at each guide vertex.
  const frames = [];
  for (let i = 0; i < guidePointsLocal.length - 1; i++) {
    const a = guidePointsLocal[i];
    const b = guidePointsLocal[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) {
      frames.push(null);
      continue;
    }
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (right-hand rule with up = (0,0,1)):
    //   T × Z_up = (ty, -tx, 0)
    frames.push({ a, b, tx, ty, nx: ty, ny: -tx });
  }

  for (const profile of profiles) {
    const mbp = profile.baseMap?.meterByPx;
    if (!mbp || profile.pointsPx.length < 2) continue;

    // Profile points in profile-local meters: X-right, Y-up (pixel Y is down,
    // so flip the sign).
    const profileLocal = profile.pointsPx.map((p) => ({
      x: (p.x - anchorPx.x) * mbp,
      y: -(p.y - anchorPx.y) * mbp,
    }));

    const subGeom = buildSweepGeometryForProfile(
      frames,
      hidden,
      profileLocal,
      verticalLift
    );
    if (!subGeom) continue;

    const surfMat = material.clone();
    surfMat.side = DoubleSide;
    group.add(new Mesh(subGeom, surfMat));
    group.add(new LineSegments(new EdgesGeometry(subGeom), EDGE_MATERIAL));
  }

  return group.children.length > 0 ? group : null;
}

// Build a quad strip mesh: at each guide endpoint of a visible segment, place
// the profile in the local (N, Z, T) frame; connect the rings with quads.
function buildSweepGeometryForProfile(
  frames,
  hidden,
  profileLocal,
  verticalLift
) {
  const positions = [];
  const indices = [];
  let v = 0;

  for (let i = 0; i < frames.length; i++) {
    if (hidden.has(i)) continue;
    const f = frames[i];
    if (!f) continue;

    // Two rings: at frame.a (start) and at frame.b (end). Each ring places
    // every profile point at: P + xLocal * N + (yLocal + verticalLift) * Z_up
    const ringA = profileLocal.map((p) => ({
      x: f.a.x + p.x * f.nx,
      y: f.a.y + p.x * f.ny,
      z: p.y + verticalLift,
    }));
    const ringB = profileLocal.map((p) => ({
      x: f.b.x + p.x * f.nx,
      y: f.b.y + p.x * f.ny,
      z: p.y + verticalLift,
    }));

    const baseIdx = v;
    for (let j = 0; j < profileLocal.length; j++) {
      positions.push(ringA[j].x, ringA[j].y, ringA[j].z);
      positions.push(ringB[j].x, ringB[j].y, ringB[j].z);
    }
    v += profileLocal.length * 2;

    // Two triangles per quad between profile vertices j and j+1.
    for (let j = 0; j < profileLocal.length - 1; j++) {
      const a0 = baseIdx + j * 2;
      const b0 = a0 + 1;
      const a1 = baseIdx + (j + 1) * 2;
      const b1 = a1 + 1;
      indices.push(a0, b0, b1, a0, b1, a1);
    }
  }

  if (positions.length === 0) return null;

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
