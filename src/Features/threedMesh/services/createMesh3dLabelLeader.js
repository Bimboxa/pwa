import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
} from "three";

import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

/**
 * Leader line from the maille's label anchor to a label card the user has
 * dragged away, so a moved card still reads as belonging to its maille.
 * Built by ThreedMeshes on rebuild and by useMesh3dLabelDragHandlers while
 * the card is being dragged (`setMesh3dLabelLeaderEnds` updates it live).
 */
export default function createMesh3dLabelLeader({
  from,
  to,
  color = DEFAULT_MESH3D_COLOR,
  dimmed = false,
}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([from.x, from.y, from.z, to.x, to.y, to.z], 3)
  );
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity: dimmed ? 0.2 : 0.7,
    depthTest: false,
    depthWrite: false,
  });
  const line = new Line(geometry, material);
  line.renderOrder = 1002;
  line.userData = { isMesh3dLabelLeader: true };
  return line;
}

export function setMesh3dLabelLeaderEnds(line, from, to) {
  const attr = line?.geometry?.getAttribute("position");
  if (!attr) return;
  attr.setXYZ(0, from.x, from.y, from.z);
  attr.setXYZ(1, to.x, to.y, to.z);
  attr.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}
