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
  hiddenSegmentsIdx = [],
  extrusionOrientation = 1,
  closeLine = false,
  onResolved
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
      extrusionOrientation,
      closeLine,
    });
    if (swept) placeholder.add(swept);
    // Notify the caller that the swept meshes now exist (built asynchronously),
    // so post-creation passes can reach them (e.g. clipping planes are applied
    // to all annotation meshes only when an annotation is reported ready).
    onResolved?.();
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

export function sweepProfileAlongGuide({
  guidePointsLocal,
  hiddenSegmentsIdx,
  profiles,
  anchorPx,
  verticalLift,
  material,
  extrusionOrientation = 1,
  closeLine = false,
}) {
  const hidden = new Set(hiddenSegmentsIdx ?? []);
  // Flip the profile to the other side of the guide (180° about the guide
  // tangent) by mirroring its position along the segment normal.
  const orient = extrusionOrientation < 0 ? -1 : 1;
  const group = new Group();

  // Per-vertex mitered frames so adjacent segments share rings — produces a
  // continuous surface across the guide vertices. At interior vertices the
  // normal is the bisector of the two adjacent segment normals, scaled so
  // every profile point stays at its correct perpendicular distance from
  // each adjacent segment (standard miter: M = (N_in + N_out) / (1 + N_in · N_out)).
  // At end vertices and at edges of hidden gaps, we fall back to the single
  // adjacent segment's plain right-normal (clean termination).
  const vertexFrames = computeVertexFrames(guidePointsLocal, hidden, closeLine);

  for (const profile of profiles) {
    const mbp = profile.baseMap?.meterByPx;
    if (!mbp || profile.pointsPx.length < 2) continue;

    // Profile points in profile-local meters: X-right, Y-up (pixel Y is down,
    // so flip the sign).
    const profileLocal = profile.pointsPx.map((p) => ({
      x: (p.x - anchorPx.x) * mbp * orient,
      y: -(p.y - anchorPx.y) * mbp,
    }));

    const subGeom = buildSweepGeometryForProfile(
      guidePointsLocal,
      vertexFrames,
      hidden,
      profileLocal,
      verticalLift,
      closeLine
    );
    if (!subGeom) continue;

    const surfMat = material.clone();
    surfMat.side = DoubleSide;
    group.add(new Mesh(subGeom, surfMat));
    group.add(new LineSegments(new EdgesGeometry(subGeom), EDGE_MATERIAL));
  }

  return group.children.length > 0 ? group : null;
}

// For each guide vertex, compute the in/out segment normals (right-hand rule
// with up = +Z) and combine them into:
//   - "in"  : entering normal/tangent only (boundary of an upstream gap)
//   - "out" : leaving normal/tangent only  (boundary of a downstream gap)
//   - "bis" : mitered bisector at an interior vertex with both segments
//             visible. Two ring entries are emitted: one anchored on the
//             outgoing segment (for the segment leaving this vertex) and one
//             on the incoming segment (for the arriving segment); both reuse
//             the same mitered normal so the rings coincide → continuous
//             surface across the vertex.
//
// Rather than tracking which "side" each ring entry covers, we collapse to a
// single ring per vertex and let `buildSweepGeometryForProfile` use it for
// both adjacent segments — that's the whole point of mitering.
function computeVertexFrames(points, hidden, closeLine = false) {
  const n = points.length;
  const frames = new Array(n).fill(null);

  // Per-segment plain normals (cached). When the guide is closed there is one
  // extra segment connecting the last point back to the first (index n-1).
  const segCount = closeLine ? n : n - 1;
  const segN = new Array(segCount).fill(null);
  for (let i = 0; i < segCount; i++) {
    if (hidden.has(i)) continue;
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) continue;
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (T × Z_up): (ty, -tx, 0)
    segN[i] = { nx: ty, ny: -tx };
  }

  for (let v = 0; v < n; v++) {
    // Closed: every vertex has both an incoming and an outgoing segment
    // (wrap-around). Open: the endpoints fall back to their single segment.
    const inN = closeLine ? segN[(v - 1 + n) % n] : v > 0 ? segN[v - 1] : null;
    const outN = closeLine ? segN[v] : v < n - 1 ? segN[v] : null;

    if (inN && outN) {
      // Mitered: M = (Ni + No) / (1 + Ni · No). Falls back to plain "out"
      // normal when the two segments fold back on themselves (denom ~ 0).
      const dot = inN.nx * outN.nx + inN.ny * outN.ny;
      const denom = 1 + dot;
      if (denom > 1e-6) {
        frames[v] = {
          nx: (inN.nx + outN.nx) / denom,
          ny: (inN.ny + outN.ny) / denom,
        };
      } else {
        frames[v] = { nx: outN.nx, ny: outN.ny };
      }
    } else if (inN) {
      frames[v] = { nx: inN.nx, ny: inN.ny };
    } else if (outN) {
      frames[v] = { nx: outN.nx, ny: outN.ny };
    }
    // else: vertex unreachable (both adjacent segments hidden / degenerate).
  }
  return frames;
}

// Build a quad strip mesh: each visible guide segment connects the rings
// computed at its two endpoint vertices. Adjacent visible segments share
// their mid-vertex ring → continuous surface.
function buildSweepGeometryForProfile(
  guidePoints,
  vertexFrames,
  hidden,
  profileLocal,
  verticalLift,
  closeLine = false
) {
  const positions = [];
  const indices = [];
  let v = 0;

  // Cache the start ring across iterations so adjacent visible segments
  // genuinely SHARE their mid-vertex ring (single set of vertices in the
  // buffer, not duplicated rings at the same coords).
  let prevSegmentEndIdx = -1;
  let prevEndVertexIndex = -1;

  // Closed guide: also sweep the closing segment (last → first), so the
  // surface wraps all the way around (e.g. a full dome) instead of leaving a
  // wedge-shaped gap.
  const n = guidePoints.length;
  const segCount = closeLine ? n : n - 1;

  for (let i = 0; i < segCount; i++) {
    if (hidden.has(i)) {
      prevSegmentEndIdx = -1;
      prevEndVertexIndex = -1;
      continue;
    }
    const endVertex = (i + 1) % n;
    const fA = vertexFrames[i];
    const fB = vertexFrames[endVertex];
    if (!fA || !fB) {
      prevSegmentEndIdx = -1;
      prevEndVertexIndex = -1;
      continue;
    }
    const a = guidePoints[i];
    const b = guidePoints[endVertex];

    // Reuse previous segment's end ring as this segment's start ring iff the
    // previous visible segment ended at this same vertex.
    let startBaseIdx;
    if (prevSegmentEndIdx >= 0 && prevEndVertexIndex === i) {
      startBaseIdx = prevSegmentEndIdx;
    } else {
      startBaseIdx = v;
      for (let j = 0; j < profileLocal.length; j++) {
        const p = profileLocal[j];
        positions.push(
          a.x + p.x * fA.nx,
          a.y + p.x * fA.ny,
          p.y + verticalLift
        );
      }
      v += profileLocal.length;
    }

    const endBaseIdx = v;
    for (let j = 0; j < profileLocal.length; j++) {
      const p = profileLocal[j];
      positions.push(
        b.x + p.x * fB.nx,
        b.y + p.x * fB.ny,
        p.y + verticalLift
      );
    }
    v += profileLocal.length;

    // Two triangles per quad between profile vertices j and j+1.
    for (let j = 0; j < profileLocal.length - 1; j++) {
      const a0 = startBaseIdx + j;
      const a1 = startBaseIdx + (j + 1);
      const b0 = endBaseIdx + j;
      const b1 = endBaseIdx + (j + 1);
      indices.push(a0, b0, b1, a0, b1, a1);
    }

    prevSegmentEndIdx = endBaseIdx;
    prevEndVertexIndex = endVertex;
  }

  if (positions.length === 0) return null;

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
