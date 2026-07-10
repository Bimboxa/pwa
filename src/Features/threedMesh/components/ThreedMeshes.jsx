import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import createMesh3dLabelSprite from "../services/createMesh3dLabelSprite";
import { setMesh3dObjects } from "../services/mesh3dObjectsStore";
import buildFaceGeometry from "../utils/buildFaceGeometry";
import computeFaceArea, { polygonCentroid2d } from "../utils/computeFaceArea";
import computePlaneBasis from "../utils/computePlaneBasis";
import { projectLoopTo2d, liftPointTo3d } from "../utils/planeProjection";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

// Lift of the label sprite off the face plane (meters).
const LABEL_LIFT_M = 0.05;

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.userData?.dispose?.();
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

// Anchor of the label sprite: centroid of the maille's largest face, lifted
// along that face's normal.
function getLabelPosition(mesh3d) {
  let best = null;
  let bestArea = -1;
  for (const face of mesh3d.faces || []) {
    const area = computeFaceArea(face);
    if (area > bestArea) {
      bestArea = area;
      best = face;
    }
  }
  if (!best) return null;
  const basis = computePlaneBasis(best.normal, best.contour[0]);
  const centroid2d = polygonCentroid2d(projectLoopTo2d(best.contour, basis));
  const p = liftPointTo3d(centroid2d, basis);
  return new Vector3(
    p.x + best.normal.x * LABEL_LIFT_M,
    p.y + best.normal.y * LABEL_LIFT_M,
    p.z + best.normal.z * LABEL_LIFT_M
  );
}

// Renders persistent 3D mesh cells ("mailles") read from db.meshes3d for the
// current project + scope: one 5 mm-extruded shell per face + a clickable
// label sprite (label, plus surface when selected). Face meshes and sprites
// are published to mesh3dObjectsStore for picking (selection click in
// MainThreedEditor, hover / cut targets in useMeshingPointerHandlers).
export default function ThreedMeshes() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix } = useMesh3dLabelPrefix();

  // Selected maille ids, serialized so the rebuild effect only re-runs when
  // the MESH3D selection actually changes.
  const selectedIdsKey = useSelector((s) => {
    const items = selectSelectedItems(s);
    return items
      .filter((it) => it?.type === "NODE" && it?.nodeType === "MESH3D")
      .map((it) => it.nodeId)
      .sort()
      .join(",");
  });
  const selectedIds = useMemo(
    () => new Set(selectedIdsKey ? selectedIdsKey.split(",") : []),
    [selectedIdsKey]
  );

  const rootRef = useRef(null);

  // mount / unmount root group
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const scene = editor?.sceneManager?.scene;
    if (!scene) return;

    const root = new Group();
    root.name = "ThreedMeshes";
    scene.add(root);
    rootRef.current = root;

    return () => {
      scene.remove(root);
      disposeObject(root);
      rootRef.current = null;
      setMesh3dObjects({});
      editor.sceneManager.renderScene?.();
    };
  }, []);

  // rebuild children on data / selection / prefix change
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const root = rootRef.current;
    if (!editor || !root) return;

    while (root.children.length) {
      const child = root.children[0];
      root.remove(child);
      disposeObject(child);
    }

    const sprites = [];
    const faceMeshes = [];

    (meshes3d || []).forEach((mesh3d) => {
      if (!mesh3d?.faces?.length) return;
      const selected = selectedIds.has(mesh3d.id);
      const color = mesh3d.color || DEFAULT_MESH3D_COLOR;

      const group = new Group();
      group.userData = { mesh3dId: mesh3d.id, isMesh3d: true };

      mesh3d.faces.forEach((face, faceIndex) => {
        const faceMesh = buildFaceGeometry(face, { color, selected });
        if (!faceMesh) return;
        faceMesh.userData = {
          mesh3dId: mesh3d.id,
          faceIndex,
          isMesh3d: true,
        };
        group.add(faceMesh);
        faceMeshes.push(faceMesh);
      });

      const labelPosition = getLabelPosition(mesh3d);
      if (labelPosition) {
        const sprite = createMesh3dLabelSprite({
          text: getMesh3dDisplayLabel(mesh3d, prefix),
          surfaceText: selected ? formatSurfaceM2(mesh3d.surface) : null,
          mesh3dId: mesh3d.id,
          color,
          selected,
        });
        sprite.position.copy(labelPosition);
        group.add(sprite);
        sprites.push(sprite);
      }

      root.add(group);
    });

    setMesh3dObjects({ sprites, faceMeshes });
    editor.sceneManager.renderScene?.();
  }, [meshes3d, selectedIds, prefix]);

  return null;
}
