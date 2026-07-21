import {
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
} from "three";
import { liveQuery } from "dexie";

import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";
import {
  computeVertexFrames,
  buildSweepGeometryForProfile,
} from "./sweepGeometry";

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


