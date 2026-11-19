import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
} from "three";

/**
 * Leader line from the maille's label anchor to a label card the user has
 * dragged away, so a moved card still reads as belonging to its maille.
 * Built by ThreedMeshes on rebuild and by useMesh3dLabelDragHandlers while
 * the card is being dragged (`setMesh3dLabelLeaderEnds` updates it live).
 */
export default function createMesh3dLabelLeader({
  from,
  to,
  dimmed = false,
  // Annotation labels (threedAnnotationLabels) pass true so the leader is
  // truncated by 3D objects in front of it; maille leaders keep the
  // always-on-top behavior.
  depthTest = false,
  // Photo link lines pass their connector colour.
  color = "#000000",
  // Dashed photo connector (dash / gap in metres).
  dashed = false,
}) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([from.x, from.y, from.z, to.x, to.y, to.z], 3)
  );
  const materialOptions = {
    color,
    transparent: true,
    opacity: dimmed ? 0.2 : 0.7,
    depthTest,
    depthWrite: false,
  };
  const material = dashed
    ? new LineDashedMaterial({
        ...materialOptions,
        dashSize: 0.06,
        gapSize: 0.04,
      })
    : new LineBasicMaterial(materialOptions);
  const line = new Line(geometry, material);
  if (dashed) line.computeLineDistances();
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
  if (line.material?.isLineDashedMaterial) line.computeLineDistances();
}
