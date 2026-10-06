import { Vector3 } from "three";

import { mesh3dLocalToWorld } from "Features/annotationMesh3d/services/getEditableMesh3d";
import getDisplayedMesh3d from "Features/annotationMesh3d/services/getDisplayedMesh3d";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";

// A face vertex belongs to a point when it sits ON it in plan: a PX wall quad
// and a POLYGON prism are never shrunk, so only float32 noise separates them.
const XY_TOLERANCE_M = 0.002;

// Handles of the vertex offset mode: the vertices of ONE face of a regular
// annotation (its displayed conversion, getDisplayedMesh3d), each mapped to
// the annotation point it stands on and to the per-point offset it moves:
//
//   [{ pointId, field: "offsetTop" | "offsetBottom", baseOffset, world }]
//
// The field is the nearer of the point's top (lift + height + offsetTop, plus
// offsetBottom for a POLYGON — triangulateAnnotationGeometry's convention)
// and bottom (lift + offsetBottom): the converted mesh sits 1 mm under those
// formulas (the conversion strips the z-fight lift a PX wall never had), so
// nearest wins rather than a fixed tolerance. Vertices standing on no point
// (arc samples) get no handle; sliding refs are not points of the mesh.
// Returns [] when the face cannot be resolved.
export default function getFaceVertexHandles({
  editor,
  annotationId,
  faceIndex,
}) {
  const sceneManager = editor?.sceneManager;
  const annotationsManager = sceneManager?.annotationsManager;
  const displayed = getDisplayedMesh3d(editor, annotationId, {
    allowSingleFace: true,
  });
  const face = displayed?.mesh?.faces?.[faceIndex];
  const source = annotationsManager?.getAnnotationSource?.(annotationId);
  const baseMap = sceneManager?.imagesManager?.baseMapsMap?.[source?.baseMapId];
  const metrics = getBaseMapForRender(baseMap);
  if (!face || !source || !metrics) return [];

  const lift = Number(source.offsetZ) || 0;
  const height = Number(source.height) || 0;
  const isPolygon = source.type === "POLYGON";
  const points = (source.points || [])
    .filter((p) => p?.id && !p.isSliding)
    .map((p) => {
      const local = pixelToWorld(p, metrics);
      const offsetTop = Number(p.offsetTop) || 0;
      const offsetBottom = Number(p.offsetBottom) || 0;
      return {
        id: p.id,
        x: local.x,
        y: local.y,
        offsetTop,
        offsetBottom,
        topZ: lift + height + offsetTop + (isPolygon ? offsetBottom : 0),
        bottomZ: lift + offsetBottom,
      };
    });
  if (!points.length) return [];

  const handles = [];
  const seen = new Set();
  const loops = [face.loop, ...(face.holes || [])];
  for (const loop of loops) {
    for (const vi of loop) {
      const v = displayed.mesh.vertices[vi];
      if (!v) continue;
      let best = null;
      let bestD2 = XY_TOLERANCE_M * XY_TOLERANCE_M;
      for (const p of points) {
        const dx = p.x - v.x;
        const dy = p.y - v.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = p;
        }
      }
      if (!best) continue;
      const isTop = Math.abs(v.z - best.topZ) <= Math.abs(v.z - best.bottomZ);
      const field = isTop ? "offsetTop" : "offsetBottom";
      const key = `${best.id}|${field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const world = mesh3dLocalToWorld(v, displayed);
      handles.push({
        pointId: best.id,
        field,
        baseOffset: isTop ? best.offsetTop : best.offsetBottom,
        world: new Vector3(world.x, world.y, world.z),
      });
    }
  }
  return handles;
}
