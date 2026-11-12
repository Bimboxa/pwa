import { Group, Vector3 } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import theme from "Styles/theme";

import { CUT_LINE_WIDTH_PX } from "../constants/cutLineStyle";
import { getCutLineEntry } from "../services/cutLineObjectsStore";

const GHOST_OPACITY = 0.6;

// « Copie multiple » ghost of a cut line (the 3D « Déplacer » / « Tourner »
// tools, moveCopyGhostsThreed): the visible run of the rendered line as one
// translucent fat line, in the LOCAL frame of its base map group
// (`parentGroup`) — a rigid stand-in: the copy's own extension is only
// computed at the drop. Owns its geometry and material. Returns a Group
// (at identity), or null when the line is not rendered.
export default function buildCutLineGhostObject({
  annotationId,
  parentGroup,
  resolution,
  color,
}) {
  const worldPolyline = getCutLineEntry(annotationId)?.worldPolyline;
  if (!parentGroup || !worldPolyline || worldPolyline.length < 2) return null;

  parentGroup.updateWorldMatrix(true, false);
  const tmp = new Vector3();
  const positions = [];
  for (const p of worldPolyline) {
    parentGroup.worldToLocal(tmp.set(p.x, p.y, p.z));
    positions.push(tmp.x, tmp.y, tmp.z);
  }

  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: color || theme.palette.secondary.fluo || "#ff4d00",
    linewidth: CUT_LINE_WIDTH_PX,
    resolution,
    worldUnits: false,
    transparent: true,
    opacity: GHOST_OPACITY,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const line = new Line2(geometry, material);
  line.renderOrder = 1002;

  const ghost = new Group();
  ghost.add(line);
  return ghost;
}
