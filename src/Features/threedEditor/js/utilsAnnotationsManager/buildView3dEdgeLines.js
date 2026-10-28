import { Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import attachFatLineRaycast from "./attachFatLineRaycast.js";

// "Affichage 3D" edge lines of an annotation linked to a SOLO business
// object (annotation._view3d, see businessObjects/utils/templateView3d):
// screen-space fat lines (Line2) drawn along the horizontal edges of a wall
// (top / bottom) or along the contour of a polygon (outline), in the
// annotation's 3D colour. Same technique as the flat-polyline fallback of
// extrudePolylineWall: custom raycast (hover / click), `exportLine` (OBJ /
// USDZ export + vertex snap).
//
// Tagged `isView3dEdge` so the CSG carve keeps them (they trace the stored
// edges, not the carved outline) and the Wireframe pass ignores them.

export const VIEW3D_EDGE_LINEWIDTH_PX = 3;

// positions: flat [x, y, z, …] in the object's local frame.
export function buildView3dEdgeLine(positions, { color, resolution } = {}) {
  if (!resolution || !positions || positions.length < 6) return null;
  const lineGeom = new LineGeometry();
  lineGeom.setPositions(positions);
  const fatMat = new LineMaterial({
    color,
    linewidth: VIEW3D_EDGE_LINEWIDTH_PX,
    resolution,
    worldUnits: false, // screen-space px thickness
    transparent: true,
    depthTest: true,
  });
  const line = new Line2(lineGeom, fatMat);
  line.computeLineDistances();
  const localPoints = [];
  for (let i = 0; i < positions.length; i += 3) {
    localPoints.push(
      new Vector3(positions[i], positions[i + 1], positions[i + 2])
    );
  }
  attachFatLineRaycast(line, localPoints);
  line.userData.isView3dEdge = true;
  line.userData.exportLine = { positions };
  line.userData.isSnapLine = true;
  return line;
}

// Lines of the requested edges along the given runs.
//   runs      — [{points: [{x, y, offsetBottom, offsetTop}], closed}]
//   levels    — ["top" | "bottom"] rendered levels
//   zOf       — {top: (p) => z, bottom: (p) => z} of each level (the caller
//               owns the z convention of its own surface builder)
// Returns Line2[] (empty without resolution).
export function buildView3dRunEdges(runs, { levels, zOf, color, resolution }) {
  const lines = [];
  if (!resolution || !levels?.length) return lines;
  runs.forEach((run) => {
    const points = run?.points;
    if (!points || points.length < 2) return;
    levels.forEach((level) => {
      const z = zOf[level];
      if (typeof z !== "function") return;
      const positions = [];
      points.forEach((p) => positions.push(p.x, p.y, z(p)));
      if (run.closed) positions.push(positions[0], positions[1], positions[2]);
      const line = buildView3dEdgeLine(positions, { color, resolution });
      if (line) lines.push(line);
    });
  });
  return lines;
}

// Wall levels (POLYLINE): top / bottom edges requested by the view.
export function getWallEdgeLevels(view3d) {
  const levels = [];
  if (view3d?.topEdge) levels.push("top");
  if (view3d?.bottomEdge) levels.push("bottom");
  return levels;
}
