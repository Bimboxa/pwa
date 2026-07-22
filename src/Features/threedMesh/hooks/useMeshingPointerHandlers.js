import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  appendToMeshingAngleBuffer,
  clearMeshingAngleBuffer,
  deleteLastMeshingAngleBuffer,
  setMeshingModeActive,
  setMeshingNumberingNext,
  setMeshingTool,
  toggleMeshingCutSide,
} from "Features/threedEditor/threedEditorSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import {
  setSelectedItem,
  toggleItemSelection,
} from "Features/selection/selectionSlice";
import {
  getFaceRegion,
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
import { isMesh3dLabelGestureActive } from "../services/mesh3dLabelGestureStore";
import buildMeshDataFromRegion from "../utils/buildMeshDataFromRegion";
import parseMeshingAngleBuffer, {
  MESHING_ANGLE_BUFFER_CHAR_RE,
} from "../utils/parseMeshingAngleBuffer";

// Mirrors useDrawingPointerHandlers / useDimensionPointerHandlers.
const DRAG_THRESHOLD_PX = 4;

// Pointer interactions of the 3D meshing mode. Owns the pointer while
// meshingMode.active (MainThreedEditor's hover/click paths short-circuit):
//
// - SELECT tool: hovering an annotation face shows the coplanar stipple (same
//   overlay as the selection-mode hover) + a "+ nouvelle maille" cursor
//   helper; a click creates a maille from the hovered face. Clicking an
//   existing maille selects it (shift+click toggles).
// - CUT_VERTICAL / CUT_HORIZONTAL / CUT_FREE / CUT_POLYLINE / CUT_ANGULAR:
//   delegated to meshingCutController (red cut line, reference/guide vertices,
//   area chips, split on click). CUT_ANGULAR also captures typed digits into
//   meshingMode.angleBuffer to constrain its opening angle.
export default function useMeshingPointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.meshingMode.active);
  const tool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const offset = useSelector((s) => s.threedEditor.meshingMode.offset);
  const cutSide = useSelector((s) => s.threedEditor.meshingMode.cutSide);
  const angleBuffer = useSelector(
    (s) => s.threedEditor.meshingMode.angleBuffer
  );
  const numberingNext = useSelector(
    (s) => s.threedEditor.meshingMode.numberingNext
  );
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );
  const isMeshesViewer = useSelector(selectEffectiveViewerKey) === "MESHES";
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
  const angleBufferRef = useRef(angleBuffer);
  useEffect(() => {
    angleBufferRef.current = angleBuffer;
  }, [angleBuffer]);
  // Set by the listeners effect: redraws the hover without a mouse move.
  const refreshHoverRef = useRef(null);
  const numberingNextRef = useRef(numberingNext);
  useEffect(() => {
    numberingNextRef.current = numberingNext;
  }, [numberingNext]);
  const faceSelectionAngleDegRef = useRef(faceSelectionAngleDeg);
  useEffect(() => {
    faceSelectionAngleDegRef.current = faceSelectionAngleDeg;
  }, [faceSelectionAngleDeg]);
  const isMeshesViewerRef = useRef(isMeshesViewer);
  useEffect(() => {
    isMeshesViewerRef.current = isMeshesViewer;
  }, [isMeshesViewer]);
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
    if (!active) return;
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
      getAngleDeg: () => parseMeshingAngleBuffer(angleBufferRef.current),
      clearAngleBuffer: () => {
        if (angleBufferRef.current !== "") dispatch(clearMeshingAngleBuffer());
      },
      getMesh3dById: (id) => mesh3dByIdRef.current[id],
      getAllMeshes3d: () => Object.values(mesh3dByIdRef.current),
    });

    dom.style.cursor = tool === "NUMBER" ? "default" : "crosshair";

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

    // Stipple the face under the cursor (same overlay as the selection-mode
    // annotation hover). Works on annotation meshes AND maille face meshes —
    // a hovered maille gets the same highlight, including while a cut tool is
    // active.
    function applyStipple(object, faceIndex) {
      // Plane mode on CSG-carved meshes: highlight the whole coplanar surface
      // (T-junctions break the edge-adjacency walk). Must match the region
      // used by handleSelectClick.
      const angleDeg = faceSelectionAngleDegRef.current;
      const region = getFaceRegion(object.geometry, faceIndex, {
        plane: !!object.userData?.hasSubtraction,
        angleDeg,
      });
      const key = region
        ? `${object.uuid}:${angleDeg}:${region.regionId}`
        : null;
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
      } else if (tool === "NUMBER") {
        setMeshingOverlay({ cursor: null });
        dom.style.cursor = pick?.kind === "MESH3D" ? "pointer" : "default";
      } else {
        cutController.onHover(e, pick);
      }
    }

    // NUMBER tool: assign the typed number to the clicked maille, then +1.
    // Duplicates are allowed; the label override is cleared so the new
    // prefix + number becomes visible.
    async function handleNumberClick(pick) {
      if (pick?.kind !== "MESH3D") return;
      const number = Math.round(numberingNextRef.current);
      if (!Number.isFinite(number) || number < 1) return;
      try {
        await db.meshes3d.update(pick.mesh3dId, { number, label: null });
        dispatch(setMeshingNumberingNext(number + 1));
      } catch (err) {
        console.error("[threedMesh] numbering failed", err);
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
        // Same mode as applyStipple: the created maille covers exactly the
        // highlighted region.
        const region = getFaceRegion(
          pick.hitObject.geometry,
          pick.intersect.faceIndex,
          {
            plane: !!pick.hitObject.userData?.hasSubtraction,
            angleDeg: faceSelectionAngleDegRef.current,
          }
        );
        // Planar region → polygon faces; curved one (revolution, swept
        // profile) → triangulated shell.
        const meshData = region
          ? buildMeshDataFromRegion(pick.hitObject, region.tris)
          : null;
        if (meshData) {
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
              faces: meshData.faces,
              shell: meshData.shell,
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
      // A maille label card owns this gesture (select + in-plane drag).
      if (isMesh3dLabelGestureActive()) return;
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
      // Label drag in progress: the sprite is invisible to pickScene, acting
      // on this pointerup would select/deselect the geometry behind the card.
      if (isMesh3dLabelGestureActive()) return;
      const wasDrag = dragging;
      downPos = null;
      dragging = false;
      if (wasDrag) return;

      const pick = pickScene(e);
      if (tool === "SELECT") {
        handleSelectClick(e, pick);
      } else if (tool === "NUMBER") {
        handleNumberClick(pick);
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
          // In the Maillage module meshing mode is permanent — nothing to exit.
          if (!isMeshesViewerRef.current) dispatch(setMeshingModeActive(false));
        } else if (tool === "NUMBER") {
          dispatch(setMeshingTool("SELECT"));
        } else {
          cutController.onEscape();
        }
      }
      if ((e.key === "s" || e.key === "S") && !e.repeat) {
        if (tool !== "SELECT" && tool !== "NUMBER" && tool !== "CUT_ANGULAR") {
          dispatch(toggleMeshingCutSide());
          // Redraw the cut line with the flipped side on the next frame.
          if (lastEvent && rafId == null) {
            rafId = requestAnimationFrame(runHover);
          }
        }
      }
    }

    // Typed angle of the angular cut: digits captured straight from the
    // keyboard into meshingMode.angleBuffer, exactly like the extrude value
    // buffer. Capture phase so the digits reach the buffer before the
    // window-scoped shortcuts of the other features see them.
    function onKeyDownAngle(e) {
      if (tool !== "CUT_ANGULAR") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        if (angleBufferRef.current === "") return;
        e.preventDefault();
        e.stopPropagation();
        dispatch(deleteLastMeshingAngleBuffer());
        return;
      }
      if (MESHING_ANGLE_BUFFER_CHAR_RE.test(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        dispatch(appendToMeshingAngleBuffer(e.key === "," ? "." : e.key));
      }
    }

    refreshHoverRef.current = () => {
      if (lastEvent && rafId == null) rafId = requestAnimationFrame(runHover);
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onKeyDownAngle, true);

    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onKeyDownAngle, true);
      refreshHoverRef.current = null;
      if (rafId != null) cancelAnimationFrame(rafId);
      clearStipple();
      cutController.dispose();
      clearMeshingOverlay();
      dom.style.cursor = "";
    };
  }, [active, tool, dispatch]);

  // Typed angle → redraw the V cut in place (the mouse has not moved).
  useEffect(() => {
    if (!active || tool !== "CUT_ANGULAR") return;
    refreshHoverRef.current?.();
  }, [active, tool, angleBuffer]);
}

// Same guard as the other keyboard-buffer features: never swallow keystrokes
// aimed at a real field.
function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}
