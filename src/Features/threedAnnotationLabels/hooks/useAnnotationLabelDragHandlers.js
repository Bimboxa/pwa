import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import getAnnotationLabelDeltaFromDeltaPos from "Features/annotations/utils/getAnnotationLabelDeltaFromDeltaPos";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  toggleItemSelection,
  setShowAnnotationsProperties,
  setAnnotationPropertiesTab,
  selectSelectedItems,
} from "Features/selection/selectionSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import createMesh3dLabelLeader, {
  setMesh3dLabelLeaderEnds,
} from "Features/threedMesh/services/createMesh3dLabelLeader";
// Reused as-is: the flag's consumers (MainThreedEditor pointerup, meshing
// pointer handlers) must stand down for an annotation label gesture exactly
// like for a maille label one — same semantics, zero extra edits.
import { setMesh3dLabelGestureActive } from "Features/threedMesh/services/mesh3dLabelGestureStore";

import {
  getAnnotationLabelSprites,
  getAnnotationLabelTargetHandles,
} from "../services/annotationLabelObjectsStore";

// Pointer movement (CSS px) below which the gesture stays a plain click
// (selection only) — mirrors useMesh3dLabelDragHandlers.
const DRAG_THRESHOLD_PX = 4;

// Below this |ray · n| the basemap plane is seen edge-on: the ray/plane
// intersection runs away to infinity, so the move is ignored.
const MIN_RAY_PLANE_DOT = 0.05;

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Click + drag of an annotation label card (and of the pointed end of its
 * leader) in the 3D view — near-copy of useMesh3dLabelDragHandlers:
 * - pointerdown on a card selects the annotation on pointerup (shift+click
 *   toggles);
 * - dragging the card / target handle moves it WITHIN THE BASEMAP PLANE;
 * - pointerup converts the in-plane displacement to image-px deltas and
 *   persists it through getAnnotationLabelDeltaFromDeltaPos — the exact 2D
 *   commit path (MainMapEditorV3), so both views share the same labelDelta.
 */
export default function useAnnotationLabelDragHandlers({ rendererIsReady }) {
  const dispatch = useDispatch();

  // Modes that own the pointer (same list as useMesh3dLabelDragHandlers).
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);

  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    dimensionActive ||
    drawingActive ||
    walkActive ||
    extrudeActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  // Currently-selected annotation id — a label is only draggable once its
  // annotation is selected (same rule as the 2D editor).
  const selectedItems = useSelector(selectSelectedItems);
  const selectedAnnotationIdRef = useRef(null);
  selectedAnnotationIdRef.current =
    selectedItems.length === 1 &&
    selectedItems[0]?.type === "NODE" &&
    selectedItems[0]?.nodeType === "ANNOTATION"
      ? selectedItems[0].nodeId
      : null;

  const dragRef = useRef(null);

  useEffect(() => {
    if (!rendererIsReady) return;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const dom = sceneManager?.renderer?.domElement;
    const camera = sceneManager?.camera;
    if (!dom || !camera) return;

    const raycaster = new Raycaster();
    const ndc = new Vector2();

    function setRayFromEvent(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return true;
    }

    // Cursor projected on the basemap plane through the dragged object.
    function pickOnPlane(e, plane) {
      if (!setRayFromEvent(e)) return null;
      const dir = raycaster.ray.direction;
      if (Math.abs(dir.dot(plane.normal)) < MIN_RAY_PLANE_DOT) return null;
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls && drag.prevControlsEnabled) controls.enabled = true;
        if (drag.tempLeader) {
          drag.dragged.parent?.remove(drag.tempLeader);
          drag.tempLeader.geometry?.dispose();
          drag.tempLeader.material?.dispose();
        }
      }
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      return drag;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      if (!setRayFromEvent(e)) return;

      // Target handles first: they are smaller than the card and may overlap
      // it (both ends sit on the barycenter until one is moved).
      const handles = getAnnotationLabelTargetHandles();
      let kind = "TARGET";
      let dragged = handles.length
        ? raycaster.intersectObjects(handles, false)[0]?.object
        : null;
      if (!dragged) {
        const sprites = getAnnotationLabelSprites();
        if (!sprites.length) return;
        kind = "LABEL";
        dragged = raycaster.intersectObjects(sprites, false)[0]?.object;
      }

      const annotationId = dragged?.userData?.annotationId;
      const sprite =
        kind === "LABEL" ? dragged : dragged?.userData?.labelSprite;
      const group = dragged?.parent;
      if (!annotationId || !sprite || !group) return;

      // Unselected label: the gesture is click-only (selection on pointerup,
      // no drag, camera controls stay free) — same rule as the 2D editor.
      const clickOnly = selectedAnnotationIdRef.current !== annotationId;

      // The card owns the gesture from here on (the pointerup pick paths are
      // told to stand down, see mesh3dLabelGestureStore). Selection is
      // dispatched on pointerup, NOT here: it re-runs the
      // ThreedAnnotationLabels rebuild, which would dispose the very sprite
      // being dragged.
      setMesh3dLabelGestureActive(true);

      group.updateMatrixWorld(true);
      const planeNormal = new Vector3(0, 0, 1).transformDirection(
        group.matrixWorld
      );
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        dragged.getWorldPosition(new Vector3())
      );
      const startHit = pickOnPlane(e, plane);

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls && !clickOnly) controls.enabled = false;

      const startLocal =
        kind === "LABEL"
          ? sprite.userData.labelLocal
          : sprite.userData.targetLocal;
      // The end that stays put during this drag — the other leader endpoint.
      const fixedEnd =
        kind === "LABEL"
          ? sprite.userData.targetLocal
          : sprite.userData.labelLocal;

      dragRef.current = {
        kind,
        partType: kind === "LABEL" ? "LABEL_BOX" : "TARGET",
        clickOnly,
        annotationId,
        dragged,
        sprite,
        group,
        plane,
        startHit,
        startLocal,
        fixedEnd,
        deltaLocal: null,
        meterByPx: sprite.userData.meterByPx || 0.01,
        leader: sprite.userData.leader || null,
        tempLeader: null,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);

      if (!clickOnly) e.preventDefault();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag || !drag.startHit) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        if (!drag.clickOnly) dom.style.cursor = "grabbing";
      }
      // Click-only gesture: never drags — only tracks `moved` so a camera
      // orbit started on an unselected card doesn't select it on pointerup.
      if (drag.clickOnly) return;

      const hit = pickOnPlane(e, drag.plane);
      if (!hit) return;

      // World displacement since pointerdown → basemap-local (groups are
      // unscaled, so the length is preserved through the rotation).
      const vWorld = hit.sub(drag.startHit);
      const len = vWorld.length();
      const inv = new Matrix4().copy(drag.group.matrixWorld).invert();
      const vLocal = vWorld.transformDirection(inv).multiplyScalar(len);
      drag.deltaLocal = { x: vLocal.x, y: vLocal.y };

      const position = new Vector3(
        drag.startLocal.x + vLocal.x,
        drag.startLocal.y + vLocal.y,
        drag.startLocal.z
      );
      drag.dragged.position.copy(position);

      // Dragging the target: keep the fixed-size anchor marker on it.
      if (drag.kind === "TARGET") {
        drag.sprite.userData.anchorDot?.position.copy(position);
      }

      // Leader line: reuse the one built by ThreedAnnotationLabels, or add a
      // temporary one when both ends still sat on the barycenter.
      if (!drag.leader && !drag.tempLeader && drag.dragged.parent) {
        drag.tempLeader = createMesh3dLabelLeader({
          from: drag.fixedEnd,
          to: position,
          depthTest: true,
        });
        drag.dragged.parent.add(drag.tempLeader);
      }
      const leader = drag.leader || drag.tempLeader;
      // The leader always runs target → card.
      if (drag.kind === "LABEL") {
        setMesh3dLabelLeaderEnds(leader, drag.fixedEnd, position);
      } else {
        setMesh3dLabelLeaderEnds(leader, position, drag.fixedEnd);
      }

      sceneManager.renderScene?.();
    }

    async function onWindowPointerUp(e) {
      const drag = endDrag();
      dom.style.cursor = "";
      // Released after the canvas-level pointerup listeners have run.
      setMesh3dLabelGestureActive(false);
      if (!drag) return;

      // Click-only gesture that turned into a camera orbit: no selection.
      if (drag.clickOnly && drag.moved) return;

      // Selection (click OR drag end) — safe here: the rebuild it triggers
      // now happens after the gesture. Mirrors the cote-sprite click branch
      // of MainThreedEditor.
      const { annotationType, listingId, annotationTemplateId } =
        drag.sprite.userData;
      const item = {
        id: drag.annotationId,
        nodeId: drag.annotationId,
        type: "NODE",
        nodeType: "ANNOTATION",
        annotationType,
        listingId,
        annotationTemplateId,
      };
      const position = { x: e.clientX, y: e.clientY };
      if (e?.shiftKey) {
        dispatch(toggleItemSelection(item));
      } else {
        dispatch(
          setSelectedNode({
            id: drag.annotationId,
            nodeId: drag.annotationId,
            nodeType: "ANNOTATION",
            annotationType,
            listingId,
          })
        );
        dispatch(setSelectedItem(item));
        dispatch(setShowAnnotationsProperties(true));
        // Clicking a label card = selecting the label: open the annotation's
        // properties panel directly on the Etiquette tab (same behavior as
        // clicking the 2D chip, where the label:: nodeId drives the reducer).
        dispatch(setAnnotationPropertiesTab("LABEL"));
      }
      dispatch(clearSubSelection());
      dispatch(setAnnotationToolbarPosition(position));
      dispatch(setAnnotationsToolbarPosition(position));

      if (!drag.moved || !drag.deltaLocal) return;
      try {
        // Basemap-local meters → image px (pixel y axis points down).
        const deltaPos = {
          x: round2(drag.deltaLocal.x / drag.meterByPx),
          y: round2(-drag.deltaLocal.y / drag.meterByPx),
        };
        const annotation = await db.annotations.get(drag.annotationId);
        if (!annotation) return;
        const labelDelta = getAnnotationLabelDeltaFromDeltaPos(
          annotation,
          deltaPos,
          drag.partType
        );
        await db.annotations.update(drag.annotationId, { labelDelta });
        dispatch(triggerAnnotationsUpdate());
      } catch (err) {
        console.error(
          "[threedAnnotationLabels] label delta persist failed",
          err
        );
      }
    }

    function onWindowPointerCancel() {
      endDrag();
      dom.style.cursor = "";
      setMesh3dLabelGestureActive(false);
    }

    // Capture phase so the hit-test runs before the camera controls' own
    // pointerdown work (disabling the controls is what actually keeps the
    // camera still — see useCoteLabelDragHandlers).
    dom.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      endDrag();
      setMesh3dLabelGestureActive(false);
    };
  }, [rendererIsReady, dispatch]);
}
