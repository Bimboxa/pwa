import { useEffect, useMemo, useRef } from "react";

import { useSelector } from "react-redux";
import { Group } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useMeshes3d from "../hooks/useMeshes3d";
import useMesh3dLabelPrefix from "../hooks/useMesh3dLabelPrefix";
import createMesh3dLabelLeader from "../services/createMesh3dLabelLeader";
import createMesh3dLabelSprite from "../services/createMesh3dLabelSprite";
import createMesh3dLabelTargetHandle from "../services/createMesh3dLabelTargetHandle";
import { setMesh3dObjects } from "../services/mesh3dObjectsStore";
import buildFaceGeometry from "../utils/buildFaceGeometry";
import buildShellGeometry from "../utils/buildShellGeometry";
import formatSurfaceM2 from "../utils/formatSurfaceM2";
import getMesh3dDisplayLabel from "../utils/getMesh3dDisplayLabel";
import getMesh3dLabelAnchor, {
  getMesh3dPlanePoint,
  readMesh3dOffset,
} from "../utils/getMesh3dLabelAnchor";
import { DEFAULT_MESH3D_COLOR } from "../utils/mesh3dConstants";

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

// Renders persistent 3D mesh cells ("mailles") read from db.meshes3d for the
// current project + scope: one flat surface per face + a clickable
// label sprite (label, plus surface when selected). Face meshes and sprites
// are published to mesh3dObjectsStore for picking (selection click in
// MainThreedEditor, hover / cut targets in useMeshingPointerHandlers).
export default function ThreedMeshes() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });
  const { prefix } = useMesh3dLabelPrefix();
  // Mailles are confined to the MESHES viewer: never displayed (nor raycast
  // targetable) in the plain THREED viewer.
  const hideMeshes3d = useSelector(
    (s) => s.viewers.selectedViewerKey !== "MESHES"
  );
  const labelsOptions = useSelector((s) => s.threedEditor.mesh3dLabels);
  // Outline threshold of curved mailles: the angle that grew the region, so
  // the smooth facet seams inside a shell stay invisible.
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );

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

  // Any annotation or maille selection dims the non-selected mailles — same
  // mechanism as ThreedSelectionDimmer for annotations.
  const hasSelection = useSelector((s) =>
    selectSelectedItems(s).some(
      (it) =>
        it?.type === "NODE" &&
        (it?.nodeType === "ANNOTATION" || it?.nodeType === "MESH3D")
    )
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

    if (hideMeshes3d) {
      setMesh3dObjects({});
      editor.sceneManager.renderScene?.();
      return;
    }

    const sprites = [];
    const faceMeshes = [];
    const labelTargetHandles = [];

    (meshes3d || []).forEach((mesh3d) => {
      if (!mesh3d?.faces?.length && !mesh3d?.shell?.positions?.length) return;
      const selected = selectedIds.has(mesh3d.id);
      const dimmed = hasSelection && !selected;
      const color = mesh3d.color || DEFAULT_MESH3D_COLOR;

      const group = new Group();
      group.userData = { mesh3dId: mesh3d.id, isMesh3d: true };

      // Curved maille: one surface for the whole shell (faceIndex 0). Planar
      // maille: one surface per polygon face.
      if (mesh3d.shell?.positions?.length) {
        const shellMesh = buildShellGeometry(mesh3d.shell, {
          color,
          edgeColor: mesh3d.edgeColor,
          selected,
          dimmed,
          edgeAngleDeg: faceSelectionAngleDeg,
        });
        if (shellMesh) {
          shellMesh.userData = {
            mesh3dId: mesh3d.id,
            faceIndex: 0,
            isMesh3d: true,
          };
          group.add(shellMesh);
          faceMeshes.push(shellMesh);
        }
      }

      (mesh3d.faces || []).forEach((face, faceIndex) => {
        const faceMesh = buildFaceGeometry(face, {
          color,
          edgeColor: mesh3d.edgeColor,
          selected,
          dimmed,
        });
        if (!faceMesh) return;
        faceMesh.userData = {
          mesh3dId: mesh3d.id,
          faceIndex,
          isMesh3d: true,
        };
        group.add(faceMesh);
        faceMeshes.push(faceMesh);
      });

      // Label card content per the "Étiquette" panel options; a SELECTED
      // maille always shows number + surface regardless.
      const showNumber =
        selected || (labelsOptions.visible && labelsOptions.showNumber);
      const showQties =
        selected || (labelsOptions.visible && labelsOptions.showQties);

      const anchor =
        showNumber || showQties ? getMesh3dLabelAnchor(mesh3d) : null;
      const labelOffset = readMesh3dOffset(mesh3d.labelOffset);
      const targetOffset = readMesh3dOffset(mesh3d.labelTargetOffset);
      const labelPosition = getMesh3dPlanePoint(anchor, labelOffset);
      const targetPosition = getMesh3dPlanePoint(anchor, targetOffset);
      if (labelPosition) {
        const displayLabel = getMesh3dDisplayLabel(mesh3d, prefix);
        const surfaceLabel = formatSurfaceM2(mesh3d.surface);
        // The label card's border + text use the maille's visible 3D color
        // (same lightened/varied shade as the fill) so the card reads as
        // belonging to its maille.
        const sprite = createMesh3dLabelSprite({
          text: showNumber ? displayLabel : surfaceLabel,
          surfaceText: showNumber && showQties ? surfaceLabel : null,
          mesh3dId: mesh3d.id,
          color,
          selected,
        });
        sprite.position.set(labelPosition.x, labelPosition.y, labelPosition.z);
        if (dimmed) sprite.material.opacity = 0.3;
        // Consumed by useMesh3dLabelDragHandlers: dragging the card moves it
        // in the maille plane (persisted as mesh3d.labelOffset), dragging the
        // target handle moves the leader's pointed end
        // (mesh3d.labelTargetOffset).
        sprite.userData.labelAnchor = anchor;
        sprite.userData.color = color;
        sprite.userData.labelOffset = labelOffset;
        sprite.userData.labelTargetOffset = targetOffset;
        group.add(sprite);
        sprites.push(sprite);

        // Leader: drawn as soon as either end has been moved away from the
        // anchor (otherwise the card sits on its target, nothing to link).
        const leaderLength = Math.hypot(
          labelOffset.u - targetOffset.u,
          labelOffset.v - targetOffset.v
        );
        if (leaderLength > 1e-4) {
          const leader = createMesh3dLabelLeader({
            from: targetPosition,
            to: labelPosition,
            color,
            dimmed,
          });
          group.add(leader);
          sprite.userData.leader = leader;
        }

        // Target grab handle — selected maille only, to keep the scene clean.
        if (selected) {
          const handle = createMesh3dLabelTargetHandle({
            mesh3dId: mesh3d.id,
            color,
          });
          handle.position.set(
            targetPosition.x,
            targetPosition.y,
            targetPosition.z
          );
          handle.userData.labelAnchor = anchor;
          handle.userData.color = color;
          handle.userData.labelSprite = sprite;
          group.add(handle);
          labelTargetHandles.push(handle);
          sprite.userData.targetHandle = handle;
        }
      }

      root.add(group);
    });

    setMesh3dObjects({ sprites, faceMeshes, labelTargetHandles });
    editor.sceneManager.renderScene?.();
  }, [
    meshes3d,
    selectedIds,
    prefix,
    hideMeshes3d,
    hasSelection,
    labelsOptions,
    faceSelectionAngleDeg,
  ]);

  return null;
}
