import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";

import { expandArcsInPathWithHiddenMap } from "Features/geometry/utils/arcSampling";
import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";

import pixelToWorld from "./pixelToWorld";

const GUIDE_ARC_SAMPLES = 6;

// Close a profile cross-section into a ring (drop a trailing duplicate, then we
// treat edges with wrap-around). Returns Vector2-like {x,y} in profile-local
// meters.
function buildProfileRing(profile, anchorPx, orient) {
  const mbp = profile.baseMap?.meterByPx;
  if (!mbp || !profile.pointsPx || profile.pointsPx.length < 2) return null;
  const pts = profile.pointsPx.map((p) => ({
    x: (p.x - anchorPx.x) * mbp * orient,
    y: -(p.y - anchorPx.y) * mbp,
  }));
  // Drop an explicit closing duplicate if present; lateral loop wraps anyway.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (
    pts.length > 2 &&
    Math.abs(first.x - last.x) < 1e-9 &&
    Math.abs(first.y - last.y) < 1e-9
  ) {
    pts.pop();
  }
  return pts.length >= 2 ? pts : null;
}

// One watertight prism per guide segment: two capped profile rings placed at
// the segment endpoints using the segment's right-of-tangent normal. Adjacent
// prisms overlap slightly at joints — harmless for a boolean SUBTRACTION.
function buildSegmentPrism(a, b, ring, verticalLift) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  const tx = dx / len;
  const ty = dy / len;
  // Right-of-tangent normal (T × Z_up): (ty, -tx)
  const nx = ty;
  const ny = -tx;

  const n = ring.length;
  const positions = [];
  const indices = [];

  // ringA = vertices at A, ringB = vertices at B
  const place = (base, p) => {
    positions.push(base.x + p.x * nx, base.y + p.x * ny, p.y + verticalLift);
  };
  for (let j = 0; j < n; j++) place(a, ring[j]); // 0..n-1   ringA
  for (let j = 0; j < n; j++) place(b, ring[j]); // n..2n-1  ringB

  // Lateral quads (wrap around the closed ring)
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    const a0 = j;
    const a1 = j1;
    const b0 = n + j;
    const b1 = n + j1;
    indices.push(a0, b0, b1, a0, b1, a1);
  }

  // End caps: triangulate the 2D ring and emit it at each end (reverse winding
  // on one side so both caps face outward — winding need only be consistent
  // enough for the boolean; normals are recomputed afterwards).
  const contour = ring.map((p) => new Vector2(p.x, p.y));
  let faces = [];
  try {
    faces = ShapeUtils.triangulateShape(contour, []) || [];
  } catch {
    faces = [];
  }
  for (const f of faces) {
    // start cap (ringA indices) — reversed
    indices.push(f[0], f[2], f[1]);
    // end cap (ringB indices)
    indices.push(n + f[0], n + f[1], n + f[2]);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Build watertight prism geometries for an EXTRUSION_PROFILE annotation, in the
 * basemap-local meter frame (z = basemap normal). Async because the profile
 * cross-section is resolved from Dexie.
 *
 * @param {Object} annotation  pixel-resolved guide annotation (POLYLINE/STRIP)
 * @param {{imageWidth,imageHeight,meterByPx}} baseMapForRender
 * @returns {Promise<Array<import("three").BufferGeometry>>}
 */
export default async function buildExtrudedProfileSolidGeometries(
  annotation,
  baseMapForRender
) {
  const profileTemplateId = annotation?.shape3D?.profileTemplateId;
  if (!profileTemplateId) return [];

  const res = await resolveProfileFromDb(profileTemplateId);
  if (!res || !res.anchorPx || res.profiles.length === 0) return [];

  const orient = (annotation.extrusionOrientation ?? 1) < 0 ? -1 : 1;
  const verticalLift = Number(annotation.offsetZ) || 0;

  // Guide points in basemap-local meters (arcs expanded like the surface mesh).
  const { points: expandedPts, hiddenSegmentsIdx } =
    expandArcsInPathWithHiddenMap(
      annotation.points || [],
      GUIDE_ARC_SAMPLES,
      annotation.hiddenSegmentsIdx || [],
      !!annotation.closeLine
    );
  const guide = expandedPts.map((p) => pixelToWorld(p, baseMapForRender));
  if (guide.length < 2) return [];

  const hidden = new Set(hiddenSegmentsIdx || []);
  const n = guide.length;
  const segCount = annotation.closeLine ? n : n - 1;

  const geometries = [];
  for (const profile of res.profiles) {
    const ring = buildProfileRing(profile, res.anchorPx, orient);
    if (!ring) continue;
    for (let i = 0; i < segCount; i++) {
      if (hidden.has(i)) continue;
      const a = guide[i];
      const b = guide[(i + 1) % n];
      const prism = buildSegmentPrism(a, b, ring, verticalLift);
      if (prism) geometries.push(prism);
    }
  }
  return geometries;
}
