import baseMapLocalToWorld from "../../baseMaps/js/baseMapLocalToWorld.js";
import getBaseMapTransform from "../../baseMaps/js/getBaseMapTransform.js";
import {
  adaptiveArcSamples,
  typeOf,
} from "../../geometry/utils/arcSampling.js";
import getBaseMapForRender from "../../threedEditor/js/utilsAnnotationsManager/getBaseMapForRender.js";
import pixelToWorld from "../../threedEditor/js/utilsAnnotationsManager/pixelToWorld.js";

import expandArcsInPath3d from "./expandArcsInPath3d.js";

// Two resolved refs are the same vertex when they share the plan position
// (same db.points id, or the same pixel within half a pixel) AND the
// altitude. Same plan position at another altitude is a riser (a vertical
// segment drawn in 3D) and is kept — see dedupeAdjacentVertices.
const XY_EPS_PX = 0.5;
const Z_EPS_M = 5e-3;

// a, b: resolved refs (pixel x / y) with their altitude in `altitude`.
function isSameVertex(a, b) {
  const samePlan =
    (a.id && b.id && a.id === b.id) ||
    (Math.abs(a.x - b.x) < XY_EPS_PX && Math.abs(a.y - b.y) < XY_EPS_PX);
  return samePlan && Math.abs(a.altitude - b.altitude) < Z_EPS_M;
}

function dedupeRing(ring, closed) {
  const out = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (last && isSameVertex(last, p)) continue;
    out.push(p);
  }
  if (closed && out.length > 1 && isSameVertex(out[0], out[out.length - 1])) {
    out.pop();
  }
  return out;
}

// The rings of a RESOLVED annotation (pixel points carrying their
// offsetBottom / offsetTop, as useAnnotationsV2 delivers them) as ordered 3D
// WORLD vertices — the input of the 3D drawing commits (commitDrawnFace,
// commitDrawnPolyline, createFlatMesh3dAnnotationService):
//
//   [{ ring: [{x, y, z, baseMapId}], isHole }]
//
// Altitudes follow the 3D renderer: a POLYLINE vertex sits at
// offsetZ + offsetBottom (extrudePolylineWall), the top of a POLYGON at
// offsetZ + height + offsetBottom + offsetTop (extrudeClosedShape) — a flat
// polygon (height 0) is its own top. A POLYGON's cuts are its holes.
//
// Sliding refs (auto-generated decorations) are dropped, consecutive
// duplicates and the closing duplicate of a closed ring merged (risers kept),
// and arc points (`type: "circle"`) baked into straight segments in 3D
// (expandArcsInPath3d) — the commits re-create the arcs only when the shape
// stays parallel to its plan, which the clone does not assume.
//
// Returns null without a usable base map frame.
export default function getAnnotationRingsWorld(annotation, baseMap) {
  if (!annotation || !baseMap) return null;
  const metrics = getBaseMapForRender(baseMap);
  if (!metrics?.meterByPx) return null;
  const transform = getBaseMapTransform(baseMap);

  const offsetZ = Number(annotation.offsetZ) || 0;
  const isPolygon = annotation.type === "POLYGON";
  const closed = isPolygon || annotation.closeLine === true;
  const height = isPolygon ? Number(annotation.height) || 0 : 0;

  const altitudeOf = (p) =>
    offsetZ +
    height +
    (Number(p.offsetBottom) || 0) +
    (isPolygon ? Number(p.offsetTop) || 0 : 0);

  // Dedupe in the plan frame (pixels + altitude): in world space the
  // altitude lands on the base map normal, not necessarily on z.
  const toVertex = (p) => {
    const local = pixelToWorld(p, metrics);
    const world = baseMapLocalToWorld(
      { x: local.x, y: local.y, z: p.altitude },
      transform
    );
    return {
      x: world.x,
      y: world.y,
      z: world.z,
      baseMapId: baseMap.id,
      type: typeOf(p),
    };
  };

  const buildRing = (refs, ringClosed) => {
    const usable = (refs || [])
      .filter(
        (p) => p && !p.isSliding && Number.isFinite(p.x) && Number.isFinite(p.y)
      )
      .map((p) => ({ ...p, altitude: altitudeOf(p) }));
    let ring = dedupeRing(usable, ringClosed).map(toVertex);
    if (ring.some((v) => v.type === "circle")) {
      ring = expandArcsInPath3d(ring, adaptiveArcSamples, ringClosed);
    }
    return ring.map((v) => ({
      x: v.x,
      y: v.y,
      z: v.z,
      ...(v.baseMapId ? { baseMapId: v.baseMapId } : {}),
    }));
  };

  const rings = [{ ring: buildRing(annotation.points, closed), isHole: false }];
  if (isPolygon) {
    for (const cut of annotation.cuts || []) {
      const ring = buildRing(cut?.points, true);
      if (ring.length >= 3) rings.push({ ring, isHole: true });
    }
  }
  return rings;
}
