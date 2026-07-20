import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Matrix4, Plane, Raycaster, Vector2, Vector3 } from "three";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import { getDimensionObjects } from "../services/dimensionObjectsStore";

// Pointer movement (in CSS px) below which the gesture is treated as a plain
// click (selection) rather than an offset drag.
const DRAG_THRESHOLD_PX = 4;

const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

// Dragging a cote's value card in 3D adjusts the dimension-line offset:
//   - plane-parallel cote → writes `extensionOffset` (shared with the 2D
//     label drag of NodeCoteStatic, so both views stay in sync);
//   - vertical/oblique cote → writes the `offset3d` vector (basemap-local
//     meters), the only way to give such a cote an offset (its 2D projection
//     is degenerate).
// The drag is live: cursor is projected on a camera-facing plane through the
// label, the delta is constrained perpendicular to the measured segment, and
// the Line2/extensions/sprite are updated imperatively; the annotation is
// persisted on pointerup (the DB write then re-triggers the rebuild).
export default function useCoteLabelDragHandlers({ rendererIsReady }) {
  const updateAnnotation = useUpdateAnnotation();

  // Modes that own the pointer — no label drag while one is active.
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const blockedRef = useRef(false);
  blockedRef.current = Boolean(dimensionActive || drawingActive || walkActive);

  const updateAnnotationRef = useRef(updateAnnotation);
  useEffect(() => {
    updateAnnotationRef.current = updateAnnotation;
  }, [updateAnnotation]);

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

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag && sceneManager.controlsManager?.orbitControls) {
        sceneManager.controlsManager.orbitControls.enabled =
          drag.prevControlsEnabled;
      }
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
      return drag;
    }

    function onPointerDown(e) {
      if (e.button !== 0) return;
      if (blockedRef.current) return;
      const sprites = getDimensionObjects();
      if (!sprites.length) return;
      if (!setRayFromEvent(e)) return;

      const hits = raycaster.intersectObjects(sprites, false);
      const sprite = hits[0]?.object;
      const annotationId = sprite?.userData?.annotationId;
      if (!annotationId) return;

      const group = sprite.parent;
      const coteGeom = group?.userData?.coteGeom;
      const coteObjects = group?.userData?.coteObjects;
      if (!coteGeom || !coteObjects) return;

      group.updateMatrixWorld(true);
      const P1w = new Vector3(
        coteGeom.P1.x,
        coteGeom.P1.y,
        coteGeom.P1.z
      ).applyMatrix4(group.matrixWorld);
      const P2w = new Vector3(
        coteGeom.P2.x,
        coteGeom.P2.y,
        coteGeom.P2.z
      ).applyMatrix4(group.matrixWorld);
      const uWorld = P2w.clone().sub(P1w).normalize();
      const midWorld = P1w.clone().add(P2w).multiplyScalar(0.5);

      // Drag plane: through the current label position, facing the camera.
      const labelWorld = sprite.getWorldPosition(new Vector3());
      const planeNormal = camera.getWorldDirection(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        labelWorld
      );

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      dragRef.current = {
        annotationId,
        group,
        coteGeom,
        coteObjects,
        uWorld,
        midWorld,
        plane,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
        // Live values persisted on pointerup.
        sMeters: null,
        vLocal: null,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);

      // Keep camera-controls (registered on the same element) from starting
      // a camera drag with this gesture.
      e.stopImmediatePropagation();
      e.preventDefault();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
      }
      if (!setRayFromEvent(e)) return;

      const hit = new Vector3();
      if (!raycaster.ray.intersectPlane(drag.plane, hit)) return;

      // Perpendicular component of (hit - segment midpoint) vs the segment.
      const w = hit.sub(drag.midWorld);
      const along = w.dot(drag.uWorld);
      const vWorld = w.addScaledVector(drag.uWorld, -along);

      // World → basemap-local direction (groups are unscaled, so the length
      // is preserved through the rotation).
      const len = vWorld.length();
      const inv = new Matrix4().copy(drag.group.matrixWorld).invert();
      const vLocal = vWorld.transformDirection(inv).multiplyScalar(len);

      const geom = drag.coteGeom;
      let V;
      if (geom.isPlaneParallel && geom.nLocal) {
        // Reduce to the signed in-plane offset shared with the 2D model.
        const s =
          vLocal.x * geom.nLocal.x +
          vLocal.y * geom.nLocal.y +
          vLocal.z * geom.nLocal.z;
        drag.sMeters = s;
        V = {
          x: geom.nLocal.x * s,
          y: geom.nLocal.y * s,
          z: geom.nLocal.z * s,
        };
      } else {
        drag.vLocal = { x: vLocal.x, y: vLocal.y, z: vLocal.z };
        V = drag.vLocal;
      }

      // Live update: dimension line, extensions, sprite.
      const D1 = {
        x: geom.P1.x + V.x,
        y: geom.P1.y + V.y,
        z: geom.P1.z + V.z,
      };
      const D2 = {
        x: geom.P2.x + V.x,
        y: geom.P2.y + V.y,
        z: geom.P2.z + V.z,
      };
      const { line, extensions, sprite } = drag.coteObjects;
      line.geometry.setPositions([D1.x, D1.y, D1.z, D2.x, D2.y, D2.z]);
      line.computeLineDistances();
      if (extensions?.length === 2) {
        extensions[0].geometry.setPositions([
          geom.P1.x,
          geom.P1.y,
          geom.P1.z,
          D1.x,
          D1.y,
          D1.z,
        ]);
        extensions[0].computeLineDistances();
        extensions[1].geometry.setPositions([
          geom.P2.x,
          geom.P2.y,
          geom.P2.z,
          D2.x,
          D2.y,
          D2.z,
        ]);
        extensions[1].computeLineDistances();
      }
      sprite.position.set((D1.x + D2.x) / 2, (D1.y + D2.y) / 2, (D1.z + D2.z) / 2);
      sceneManager.renderScene?.();
    }

    async function onWindowPointerUp() {
      const drag = endDrag();
      if (!drag || !drag.moved) return;
      const geom = drag.coteGeom;
      try {
        if (geom.isPlaneParallel && drag.sMeters !== null) {
          const unit = geom.extensionOffsetUnit;
          const nextOffset =
            unit === "CM"
              ? round2(drag.sMeters * 100)
              : round2(drag.sMeters / geom.meterByPx);
          await updateAnnotationRef.current({
            id: drag.annotationId,
            extensionOffset: nextOffset,
          });
        } else if (!geom.isPlaneParallel && drag.vLocal) {
          await updateAnnotationRef.current({
            id: drag.annotationId,
            offset3d: {
              x: round4(drag.vLocal.x),
              y: round4(drag.vLocal.y),
              z: round4(drag.vLocal.z),
            },
          });
        }
      } catch (err) {
        console.error("[threedDimensions] cote offset persist failed", err);
      }
    }

    function onWindowPointerCancel() {
      endDrag();
    }

    // Capture phase so a sprite hit can stop the gesture before
    // camera-controls sees it.
    dom.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown, true);
      endDrag();
    };
  }, [rendererIsReady]);
}
