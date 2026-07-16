import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  setMeshingModeActive,
  toggleMeshingCutSide,
} from "Features/threedEditor/threedEditorSlice";
import {
  setSelectedItem,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import {
  getCoplanarRegion,
  buildFaceHoverOverlay,
  disposeFaceHoverOverlay,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

import useMeshes3d from "./useMeshes3d";
import createMesh3dService from "../services/createMesh3dService";
import {
  setMeshingOverlay,
  clearMeshingOverlay,
} from "../services/meshingOverlayStore";
import { createMeshingCutController } from "../services/meshingCutController";
import buildFacesFromRegion from "../utils/buildFacesFromRegion";

// Mirrors useDrawingPointerHandlers / useDimensionPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Pointer interactions of the 3D meshing mode. Owns the pointer while
// meshingMode.active (MainThreedEditor's hover/click paths short-circuit):
//
// - SELECT tool: hovering an annotation face shows the coplanar stipple (same
//   overlay as the selection-mode hover) + a "+ nouvelle maille" cursor
//   helper; a click creates a maille from the hovered face. Clicking an
//   existing maille selects it (shift+click toggles).
// - CUT_VERTICAL / CUT_HORIZONTAL / CUT_FREE / CUT_POLYLINE: delegated to
//   meshingCutController (red cut line, reference/guide vertices, area chips,
//   split on click).
export default function useMeshingPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.meshingMode.active);
  const shootActive = useSelector(
    (s) => s.threedEditor.meshingMode.shootActive
  );
  const tool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const offset = useSelector((s) => s.threedEditor.meshingMode.offset);
  const cutSide = useSelector((s) => s.threedEditor.meshingMode.cutSide);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const meshes3d = useMeshes3d({ projectId, scopeId });

  // Values read inside the (stable-per-activation) listeners.
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  const cutSideRef = useRef(cutSide);
  useEffect(() => {
    cutSideRef.current = cutSide;
  }, [cutSide]);
  const idsRef = useRef({ projectId, scopeId });
  useEffect(() => {
    idsRef.current = { projectId, scopeId };
  }, [projectId, scopeId]);
  const mesh3dByIdRef = useRef({});
  useEffect(() => {
    const byId = {};
    (meshes3d || []).forEach((m) => {
      byId[m.id] = m;
    });
    mesh3dByIdRef.current = byId;
  }, [meshes3d]);

  useEffect(() => {
    // Suspended (torn down / rebuilt) while the shoot sub-mode owns the
    // pointer — see useShootPointerHandlers.
    if (!active || shootActive) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    if (!sceneManager || !dom) return;

    const raycaster = new Raycaster();
    const mouse = new Vector2();
    let rafId = null;
    let lastEvent = null;
    let downPos = null;
    let dragging = false;

    // Coplanar-face hover state (SELECT tool).
    const hover = { overlay: null, key: null };

    // Cut tools machinery (draft line, guide vertices, split commit).
    const cutController = createMeshingCutController({
      editor,
      sceneManager,
      dom,
      getTool: () => tool,
      getOffset: () => offsetRef.current,
      getCutSide: () => cutSideRef.current,
      getMesh3dById: (id) => mesh3dByIdRef.current[id],
      getAllMeshes3d: () => Object.values(mesh3dByIdRef.current),
    });

    dom.style.cursor = "crosshair";

    function clearStipple() {
      if (hover.overlay) {
        disposeFaceHoverOverlay(hover.overlay);
        hover.overlay = null;
        editor.renderScene?.();
      }
      hover.key = null;
    }

    // Raycast the scene at the event position. Returns the first maille or
    // annotation hit (mesh hits only, clipping-aware).
    //
    // Targets are collected explicitly instead of intersectObjects(scene,
    // recursive): the recursive walk raycasts EVERY object, and fat lines
    // (Line2/LineSegments2 — which extend Mesh) have a raycast that throws on
    // an empty/stale LineGeometry (see attachPointTraitRaycast history in
    // createAnnotationObject3D.js), which would break all meshing picks. Fat
    // lines are irrelevant here anyway — meshing only targets faces.
    function pickScene(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
          targets.push(obj);
        }
      });

      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycaster.intersectObjects(targets, false),
          clippingPlane
        )
      );

      for (const intersect of intersects) {
        let object = intersect.object;
        while (object) {
          if (object.userData?.isMesh3d && object.userData?.mesh3dId) {
            return {
              kind: "MESH3D",
              mesh3dId: object.userData.mesh3dId,
              faceIndex: intersect.object.userData?.faceIndex ?? 0,
              intersect,
              rect,
            };
          }
          if (object.userData?.nodeId) {
            return {
              kind: "ANNOTATION",
              nodeId: object.userData.nodeId,
              hitObject: intersect.object,
              intersect,
              rect,
            };
          }
          object = object.parent;
        }
      }
      return { kind: null, rect };
    }

    // Stipple the coplanar face under the cursor (same overlay as the
    // selection-mode annotation hover). Works on annotation meshes AND maille
    // face meshes — a hovered maille gets the same highlight, including while
    // a cut tool is active.
    function applyStipple(object, faceIndex) {
      const region = getCoplanarRegion(object.geometry, faceIndex);
      const key = region ? `${object.uuid}:${region.regionId}` : null;
      if (key !== hover.key) {
        disposeFaceHoverOverlay(hover.overlay);
        hover.overlay = null;
        if (region) {
          const overlay = buildFaceHoverOverlay(object, region.tris);
          if (overlay) {
            object.add(overlay);
            hover.overlay = overlay;
          }
        }
        hover.key = key;
        editor.renderScene?.();
      }
    }

    function updateSelectHover(e, pick) {
      if (pick?.kind === "ANNOTATION") {
        setMeshingOverlay({
          cursor: {
            x: e.clientX - pick.rect.left,
            y: e.clientY - pick.rect.top,
            label: "+ nouvelle maille",
          },
        });
        dom.style.cursor = "crosshair";
      } else {
        setMeshingOverlay({ cursor: null });
        dom.style.cursor = pick?.kind === "MESH3D" ? "pointer" : "crosshair";
      }
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e) return;
      const pick = pickScene(e);

      // Face highlight: mailles in every tool, annotations in SELECT only.
      if (pick?.kind === "MESH3D") {
        applyStipple(pick.intersect.object, pick.intersect.faceIndex);
      } else if (tool === "SELECT" && pick?.kind === "ANNOTATION") {
        applyStipple(pick.hitObject, pick.intersect.faceIndex);
      } else {
        clearStipple();
      }

      if (tool === "SELECT") {
        updateSelectHover(e, pick);
      } else {
        cutController.onHover(e, pick);
      }
    }

    async function handleSelectClick(e, pick) {
      if (pick?.kind === "MESH3D") {
        const item = {
          id: pick.mesh3dId,
          nodeId: pick.mesh3dId,
          type: "NODE",
          nodeType: "MESH3D",
        };
        if (e.shiftKey) dispatch(toggleItemSelection(item));
        else dispatch(setSelectedItem(item));
        return;
      }

      if (pick?.kind === "ANNOTATION") {
        const region = getCoplanarRegion(
          pick.hitObject.geometry,
          pick.intersect.faceIndex
        );
        const faces = region
          ? buildFacesFromRegion(pick.hitObject, region.tris)
          : null;
        if (faces) {
          const { projectId: pId, scopeId: sId } = idsRef.current;
          try {
            // The maille takes the source annotation's hue (lightened fill +
            // raw-color edges) — see createMesh3dService.
            const annotation = await db.annotations.get(pick.nodeId);
            const baseColor =
              annotation?.fillColor || annotation?.strokeColor || null;
            await createMesh3dService({
              projectId: pId,
              scopeId: sId,
              faces,
              baseColor,
              sourceInfo: { annotationId: pick.nodeId },
            });
          } catch (err) {
            console.error("[threedMesh] create failed", err);
          }
          clearStipple();
        }
        return;
      }

      // Empty click: plain deselects, shift preserves.
      if (!e.shiftKey) dispatch(setSelectedItem(null));
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      downPos = { x: e.clientX, y: e.clientY };
      dragging = false;
    }

    function onPointerMove(e) {
      lastEvent = e;
      if (rafId == null) rafId = requestAnimationFrame(runHover);
      if (!downPos) return;
      const dx = Math.abs(e.clientX - downPos.x);
      const dy = Math.abs(e.clientY - downPos.y);
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) dragging = true;
    }

    function onPointerUp(e) {
      if (e.button !== 0) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return;

      const pick = pickScene(e);
      if (tool === "SELECT") {
        handleSelectClick(e, pick);
      } else {
        cutController.onClick(e, pick);
      }
    }

    function onPointerCancel() {
      downPos = null;
      dragging = false;
    }

    function onPointerLeave() {
      lastEvent = null;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      clearStipple();
      cutController.onLeave();
      clearMeshingOverlay();
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (tool === "SELECT") {
          dispatch(setMeshingModeActive(false));
        } else {
          cutController.onEscape();
        }
      }
      if ((e.key === "s" || e.key === "S") && !e.repeat) {
        if (tool !== "SELECT") {
          dispatch(toggleMeshingCutSide());
          // Redraw the cut line with the flipped side on the next frame.
          if (lastEvent && rafId == null) {
            rafId = requestAnimationFrame(runHover);
          }
        }
      }
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      if (rafId != null) cancelAnimationFrame(rafId);
      clearStipple();
      cutController.dispose();
      clearMeshingOverlay();
      dom.style.cursor = "";
    };
  }, [active, shootActive, tool, dispatch]);
}
