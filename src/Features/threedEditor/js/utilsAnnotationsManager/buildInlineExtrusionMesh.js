import {
  Group,
  Mesh,
  DoubleSide,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
} from "three";

import {
  computeVertexFrames,
  buildSweepGeometryForProfile,
} from "./sweepGeometry";

const EDGE_MATERIAL = new LineBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.5,
});

// "Extrusion" (inline profile) — the simple default sweep for a POLYLINE
// carrying `profileLines`: the cross-section drawn ON the annotation (plan
// position → transverse offset, inline height → z) is swept along the whole
// guide chain with mitered joints. Registration comes from
// getInlineExtrusionSetup: u offsets are measured from the crossed guide
// segment's extremity (snap a profile vertex on it in the Élévation panel to
// ride the guide exactly); heights are absolute (z = offsetZ + h), so the
// section seen in the elevation editor is exactly what gets built.
//
// Synchronous (the profile lives on the annotation itself — no cross-basemap
// liveQuery needed, the parent 3D rebuild path already reacts to annotation
// edits).
//
// Inputs:
//   - guidePointsLocal: chain in basemap-local units (pointsToLocal)
//   - crossSection: [{ u, h }] from getInlineExtrusionSetup (local units /
//     meters), vertical arcs already expanded
//   - material, verticalLift (= annotation.offsetZ), hiddenSegmentsIdx,
//     closeLine
export default function buildInlineExtrusionMesh({
  guidePointsLocal,
  crossSection,
  material,
  verticalLift = 0,
  hiddenSegmentsIdx = [],
  closeLine = false,
}) {
  if (!guidePointsLocal || guidePointsLocal.length < 2) return null;
  const section = (crossSection || []).filter(
    (c) => Number.isFinite(c?.u) && Number.isFinite(c?.h)
  );
  if (section.length < 2) return null;

  const hidden = new Set(hiddenSegmentsIdx ?? []);
  const vertexFrames = computeVertexFrames(guidePointsLocal, hidden, closeLine);

  // buildSweepGeometryForProfile consumes profile-local {x: transverse,
  // y: z} points.
  const profileLocal = section.map((c) => ({ x: c.u, y: c.h }));

  const geom = buildSweepGeometryForProfile(
    guidePointsLocal,
    vertexFrames,
    hidden,
    profileLocal,
    verticalLift,
    closeLine
  );
  if (!geom) return null;

  const group = new Group();
  const surfMat = material.clone();
  surfMat.side = DoubleSide;
  const mesh = new Mesh(geom, surfMat);
  mesh.userData = { ...(mesh.userData ?? {}), role: "SOLID" };
  group.add(mesh);
  group.add(new LineSegments(new EdgesGeometry(geom), EDGE_MATERIAL));
  return group;
}
