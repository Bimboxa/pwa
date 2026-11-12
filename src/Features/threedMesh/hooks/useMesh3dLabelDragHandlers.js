import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import {
  clearAxisLockLine,
  pickPointOnAxes,
  updateAxisLockLine,
} from "Features/threedDrawing/utils/axisLockDrag";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { clearSubSelection } from "Features/threedEditor/threedEditorSlice";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  toggleItemSelection,
} from "Features/selection/selectionSlice";

import createMesh3dLabelLeader, {
  setMesh3dLabelLeaderEnds,
} from "../services/createMesh3dLabelLeader";
import {
  getMesh3dFaceMeshes,
  getMesh3dLabelTargetHandles,
  getMesh3dSprites,
} from "../services/mesh3dObjectsStore";
import { setMesh3dLabelGestureActive } from "../services/mesh3dLabelGestureStore";
import { getMesh3dPlanePoint } from "../utils/getMesh3dLabelAnchor";
import {
  getMesh3dSurfacePoint,
  liftMesh3dSurfacePoint,
} from "../utils/getMesh3dLabelTargetPosition";

// Pointer movement (CSS px) below which the gesture stays a plain click
// (selection only) — mirrors useCoteLabelDragHandlers.
const DRAG_THRESHOLD_PX = 4;

// Below this |ray · n| the maille plane is seen edge-on: the ray/plane
// intersection runs away to infinity, so the move is ignored.
const MIN_RAY_PLANE_DOT = 0.05;

const round4 = (v) => Math.round(v * 10000) / 10000;

/**
 * Click + drag of a maille label card (and of the pointed end of its leader)
 * in the 3D view:
 * - pointerdown on a label sprite selects the maille (shift+click toggles) —
 *   sprites are invisible to the mesh-only pick paths, so this is the only
 *   way to select a maille from its card;
 * - dragging the card moves it WITHIN THE MAILLE PLANE (the cursor ray is
 *   projected on the plane of the label anchor), with a live leader line back
 *   to the target. Holding Shift locks the move on the user axis (X / Y / Z
 *   of the gizmo frame, whatever the maille orientation) closest to the
 *   cursor — same mechanism as the annotation label drag, the axis is drawn
 *   in its colour. An axis out of the maille plane takes the card off that
 *   plane (the `n` component of the offset); a free move then stays in the
 *   parallel plane through the card;
 * - dragging the round handle at the leader's pointed end moves that target
 *   OVER THE MAILLE SURFACE (handle shown on the selected maille only): the
 *   cursor is raycast against the maille's own faces and the result snapped
 *   to the closest point of the stored geometry, so the target follows a
 *   curved shell and slides along the border once the cursor leaves the
 *   maille — it can never detach;
 * - pointerup persists `mesh3d.labelOffset` for the card (displacement
 *   in the anchor (u, v, n) basis, meters) or
 *   `mesh3d.labelTargetPoint` for the target (world point on the surface) —
 *   the useLiveQuery rebuild then re-renders both at their stored positions.
 */
export default function useMesh3dLabelDragHandlers({ rendererIsReady }) {
  const dispatch = useDispatch();

  // Modes that own the pointer. Meshing mode is permanent in the Maillage
  // module, so it only blocks the drag when a tool other than SELECT is armed
  // (a cut / numbering click must not be swallowed by a label).
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingTool = useSelector((s) => s.threedEditor.meshingMode.tool);
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const walkActive = useSelector((s) => s.threedEditor.walkMode?.active);
  const extrudeActive = useSelector((s) => s.threedEditor.extrudeMode?.active);

  const blockedRef = useRef(false);
  blockedRef.current = Boolean(
    drawingActive ||
    walkActive ||
    extrudeActive ||
    (meshingActive && meshingTool !== "SELECT")
  );

  // Yaw of the displayed axes frame: the Shift axis lock follows the gizmo
  // axes. Read in the handlers through a ref.
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings?.yawDeg ?? 0);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

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

    // Cursor projected on the maille plane through the label anchor.
    function pickOnPlane(e, plane) {
      if (!setRayFromEvent(e)) return null;
      const dir = raycaster.ray.direction;
      if (Math.abs(dir.dot(plane.normal)) < MIN_RAY_PLANE_DOT) return null;
      const hit = new Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }

    // Cursor snapped on the closest user axis through the grab
    // point: { position, axis } or null.
    function pickOnAxes(e, drag) {
      if (!drag.axes.length || !setRayFromEvent(e)) return null;
      const rect = dom.getBoundingClientRect();
      return pickPointOnAxes({
        ray: raycaster.ray,
        ndc,
        camera,
        canvasSize: { width: rect.width, height: rect.height },
        origin: drag.startHit,
        axes: drag.axes,
        thresholdPx: Infinity,
      });
    }

    // Point of the maille surface under the cursor. Off the maille, the
    // cursor is projected on the camera-facing plane through the current
    // target, then snapped to the closest surface point: the target slides
    // along the border instead of leaving the maille.
    function pickOnMailleSurface(e, drag) {
      if (!setRayFromEvent(e)) return null;
      let candidate = raycaster.intersectObjects(drag.faceMeshes, false)[0]
        ?.point;
      if (!candidate) {
        const plane = new Plane().setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(new Vector3()),
          drag.dragged.position
        );
        candidate = raycaster.ray.intersectPlane(plane, new Vector3());
      }
      if (!candidate) return null;
      return getMesh3dSurfacePoint(drag.mesh3d, candidate);
    }

    function endDrag() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag) {
        // Only re-enable what we disabled: when the controls were already off
        // at pointerdown (shift+lasso), their owner restores them itself.
        const controls = sceneManager.controlsManager?.orbitControls;
        if (controls && drag.prevControlsEnabled) controls.enabled = true;
        if (drag.tempLeader) {
          drag.dragged.parent?.remove(drag.tempLeader);
          drag.tempLeader.geometry?.dispose();
          drag.tempLeader.material?.dispose();
        }
        if (drag.axisLine) {
          clearAxisLockLine(drag);
          sceneManager.renderScene?.();
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
      // it (both ends sit on the anchor until one is moved).
      const handles = getMesh3dLabelTargetHandles();
      let kind = "TARGET";
      let dragged = handles.length
        ? raycaster.intersectObjects(handles, false)[0]?.object
        : null;
      if (!dragged) {
        const sprites = getMesh3dSprites();
        if (!sprites.length) return;
        kind = "LABEL";
        dragged = raycaster.intersectObjects(sprites, false)[0]?.object;
      }

      const mesh3dId = dragged?.userData?.mesh3dId;
      const anchor = dragged?.userData?.labelAnchor;
      const sprite =
        kind === "LABEL" ? dragged : dragged?.userData?.labelSprite;
      if (!mesh3dId || !anchor || !sprite) return;
      const mesh3d = kind === "TARGET" ? dragged.userData.mesh3d : null;
      if (kind === "TARGET" && !mesh3d) return;

      // The card owns the gesture from here on (the pointerup pick paths are
      // told to stand down, see mesh3dLabelGestureStore). Selection is
      // dispatched on pointerup, NOT here: it re-runs the ThreedMeshes
      // rebuild, which would dispose the very sprite being dragged.
      setMesh3dLabelGestureActive(true);

      const normal = new Vector3(anchor.n.x, anchor.n.y, anchor.n.z);
      const startWorld = dragged.getWorldPosition(new Vector3());
      const plane = new Plane().setFromNormalAndCoplanarPoint(
        normal,
        startWorld
      );
      const startHit = pickOnPlane(e, plane);

      const controls = sceneManager.controlsManager?.orbitControls;
      const prevControlsEnabled = controls?.enabled ?? true;
      if (controls) controls.enabled = false;

      // The end that stays put during this drag — the other leader endpoint.
      const fixedEnd =
        kind === "LABEL"
          ? sprite.userData.targetPosition
          : getMesh3dPlanePoint(anchor, sprite.userData.labelOffset);

      dragRef.current = {
        kind,
        mesh3dId,
        // TARGET drag: the stored geometry + displayed faces of this maille.
        mesh3d,
        faceMeshes:
          kind === "TARGET"
            ? getMesh3dFaceMeshes().filter(
                (m) => m.userData?.mesh3dId === mesh3dId
              )
            : [],
        targetPoint: null,
        dragged,
        sprite,
        anchor,
        plane,
        startHit,
        // Shift axis lock (card only — the target stays on the surface).
        startWorld,
        axes:
          kind === "LABEL" ? getUserAxesWorldDirections(yawDegRef.current) : [],
        axis: null,
        axisLine: null,
        startOffset: sprite.userData.labelOffset || { u: 0, v: 0, n: 0 },
        fixedEnd,
        offset: null,
        leader: sprite.userData.leader || null,
        tempLeader: null,
        prevControlsEnabled,
        startClient: { x: e.clientX, y: e.clientY },
        moved: false,
      };

      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);

      e.preventDefault();
    }

    function onWindowPointerMove(e) {
      const drag = dragRef.current;
      // The target drag never relies on the anchor plane (seen edge-on on a
      // curved shell, it yields no start hit).
      if (!drag || (drag.kind === "LABEL" && !drag.startHit)) return;
      if (!drag.moved) {
        const dx = Math.abs(e.clientX - drag.startClient.x);
        const dy = Math.abs(e.clientY - drag.startClient.y);
        if (dx <= DRAG_THRESHOLD_PX && dy <= DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        dom.style.cursor = "grabbing";
      }

      const position = new Vector3();
      if (drag.kind === "TARGET") {
        const surfacePoint = pickOnMailleSurface(e, drag);
        if (!surfacePoint) return;
        drag.targetPoint = surfacePoint.point;
        position.copy(liftMesh3dSurfacePoint(surfacePoint));
      } else {
        // Shift: locked on the user axis through the grab point closest to
        // the cursor, else free move in the plane parallel to the maille
        // through the card.
        const axisHit = e.shiftKey ? pickOnAxes(e, drag) : null;
        const hit = axisHit?.position ?? pickOnPlane(e, drag.plane);
        if (!hit) return;
        updateAxisLockLine(drag, axisHit?.axis ?? null, {
          editor,
          camera,
          scene: sceneManager.scene,
        });

        // Displacement since pointerdown, in the anchor (u, v, n) basis
        // (n is left untouched by a free move: the hit is in the drag plane).
        const { anchor } = drag;
        const d = hit.sub(drag.startHit);
        const du = d.x * anchor.u.x + d.y * anchor.u.y + d.z * anchor.u.z;
        const dv = d.x * anchor.v.x + d.y * anchor.v.y + d.z * anchor.v.z;
        const dn = axisHit
          ? d.x * anchor.n.x + d.y * anchor.n.y + d.z * anchor.n.z
          : 0;
        const offset = {
          u: drag.startOffset.u + du,
          v: drag.startOffset.v + dv,
          n: (drag.startOffset.n || 0) + dn,
        };
        drag.offset = offset;

        position.set(
          anchor.base.x +
            anchor.u.x * offset.u +
            anchor.v.x * offset.v +
            anchor.n.x * offset.n,
          anchor.base.y +
            anchor.u.y * offset.u +
            anchor.v.y * offset.v +
            anchor.n.y * offset.n,
          anchor.base.z +
            anchor.u.z * offset.u +
            anchor.v.z * offset.v +
            anchor.n.z * offset.n
        );
      }
      drag.dragged.position.copy(position);

      // Leader line: reuse the one built by ThreedMeshes, or add a temporary
      // one when both ends still sat on the anchor.
      if (!drag.leader && !drag.tempLeader && drag.dragged.parent) {
        drag.tempLeader = createMesh3dLabelLeader({
          from: drag.fixedEnd,
          to: position,
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

      // Selection (click OR drag end) — safe here: the rebuild it triggers
      // now happens after the gesture.
      const item = {
        id: drag.mesh3dId,
        nodeId: drag.mesh3dId,
        type: "NODE",
        nodeType: "MESH3D",
      };
      // Shift toggles on a plain click only: during a drag it is the axis
      // lock, and must not deselect the maille being moved.
      if (e?.shiftKey && !drag.moved) {
        dispatch(toggleItemSelection(item));
      } else {
        dispatch(setSelectedItem(item));
        dispatch(setSelectedNode(null));
      }
      dispatch(clearSubSelection());

      if (!drag.moved) return;
      // Target: world point ON the surface (supersedes the legacy in-plane
      // labelTargetOffset). Card: (u, v, n) offset from the anchor.
      const changes =
        drag.kind === "TARGET"
          ? drag.targetPoint && {
              labelTargetPoint: {
                x: round4(drag.targetPoint.x),
                y: round4(drag.targetPoint.y),
                z: round4(drag.targetPoint.z),
              },
              labelTargetOffset: null,
            }
          : drag.offset && {
              labelOffset: {
                u: round4(drag.offset.u),
                v: round4(drag.offset.v),
                n: round4(drag.offset.n),
              },
            };
      if (!changes) return;
      try {
        await db.meshes3d.update(drag.mesh3dId, changes);
      } catch (err) {
        console.error("[threedMesh] label offset persist failed", err);
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
