import { useEffect } from "react";

import { useDispatch, useStore } from "react-redux";

import { setSelectedItems } from "Features/selection/selectionSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { getDimensionGroups } from "Features/threedDimensions/services/dimensionObjectsStore";

import { getMesh3dFaceMeshes } from "../services/mesh3dObjectsStore";

// Ctrl/Cmd+A in the Maillage module: selects everything displayed in the 3D
// scene — annotations, dimension-like groups (cut lines, cotes, rulers) and
// mailles. Same item shapes as the 3D lasso (MainThreedEditor.finalizeLasso),
// without the rectangle test. Skipped while a tool is armed (drawing, meshing
// CREATE…) so it never hijacks those flows.
export default function useSelectAllVisibleHotkey({ enabled }) {
  const dispatch = useDispatch();
  const store = useStore();

  useEffect(() => {
    if (!enabled) return undefined;

    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key !== "a" && e.key !== "A") return;
      if (isEditableTarget(e.target)) return;

      const { drawingMode, meshingMode } = store.getState().threedEditor;
      if (drawingMode?.active) return;
      if (meshingMode?.tool && meshingMode.tool !== "SELECT") return;

      const manager = getActiveThreedEditor()?.sceneManager?.annotationsManager;
      if (!manager) return;

      // Stops the browser's native select-all.
      e.preventDefault();

      const items = [];
      const seen = new Set();
      const pushAnnotationItem = (object) => {
        if (!isDisplayed(object)) return;
        const {
          nodeId,
          nodeType,
          annotationType,
          listingId,
          annotationTemplateId,
        } = object.userData || {};
        if (!nodeId || seen.has(nodeId)) return;
        seen.add(nodeId);
        items.push({
          id: nodeId,
          nodeId,
          type: "NODE",
          nodeType,
          annotationType,
          listingId,
          annotationTemplateId,
        });
      };

      // Annotations (scan base maps are a backdrop, never selectable).
      Object.values(manager.annotationsObjectsMap || {}).forEach((object) => {
        if (object?.userData?.isDecor) return;
        pushAnnotationItem(object);
      });

      // Cut lines / cotes / rulers live outside annotationsObjectsMap.
      getDimensionGroups().forEach(pushAnnotationItem);

      // Mailles: the groups are the parents of the published face meshes.
      for (const faceMesh of getMesh3dFaceMeshes()) {
        const mesh3dId = faceMesh.userData?.mesh3dId;
        if (!mesh3dId || seen.has(mesh3dId)) continue;
        if (!isDisplayed(faceMesh.parent)) continue;
        seen.add(mesh3dId);
        items.push({
          id: mesh3dId,
          nodeId: mesh3dId,
          type: "NODE",
          nodeType: "MESH3D",
        });
      }

      dispatch(setSelectedItems(items));
      dispatch(setSelectedNode(null));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, dispatch, store]);
}

// Visible, with every ancestor visible (a hidden base map group hides its
// annotations without touching their own flag).
function isDisplayed(object) {
  if (!object) return false;
  for (let o = object; o; o = o.parent) {
    if (o.visible === false) return false;
  }
  return true;
}

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(el.isContentEditable)
  );
}
