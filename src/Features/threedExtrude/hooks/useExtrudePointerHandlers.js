import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import db from "App/db/db";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  setExtrudeModeActive,
  setExtrudeTargetAnnotationId,
  setExtrudeValue,
} from "Features/threedEditor/threedEditorSlice";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
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
import {
  buildTransientFaceMesh,
  loadAnnotationSnapshot,
} from "Features/threedDrawing/services/buildTransientFaceMesh";
import getBaseMapNormalWorld from "Features/threedDrawing/utils/getBaseMapNormalWorld";
import {
  deepHide,
  deepShow,
} from "Features/threedDrawing/utils/deepVisibility";

import {
  setExtrudeOverlay,
  clearExtrudeOverlay,
} from "../services/extrudeOverlayStore";
import getAxisDragValue from "../utils/getAxisDragValue";
import isAnnotationExtrudable from "../utils/isAnnotationExtrudable";
import isExtrudableFaceHit from "../utils/isExtrudableFaceHit";

// Mirrors useMeshingPointerHandlers / useDrawingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;
// The armed value only starts following the cursor once it has really moved,
// so a click-click without moving applies the value typed in the toolbar.
const TRACKING_THRESHOLD_PX = 4;

function roundCm(value) {
  return Math.round(value * 100) / 100;
}

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
}

// Pointer interactions of the 3D extrude ("push/pull") mode. Owns the pointer
// while extrudeMode.active (MainThreedEditor's hover/click paths
// short-circuit). SketchUp-like two-click flow:
//
// - hover: only faces pointing along the extrusion axis (the baseMap normal)
//   are eligible; they get the coplanar stipple + a cursor helper. Lateral and
//   bottom faces, template-locked heights and REVOLUTION / EXTRUSION_PROFILE
//   shapes are silently ignored.
// - click 1: arms the annotation owning the face. Its real mesh is hidden and
//   replaced by a transient ghost rebuilt at every value change.
// - mouse move: the value follows the cursor along the axis (toolbar field +
//   ghost + cursor chip).
// - click 2 / Enter: commits `height = max(0, height + value)`. Escape cancels
//   the armed state, or leaves the mode when nothing is armed.
export default function useExtrudePointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.extrudeMode.active);
  const value = useSelector((s) => s.threedEditor.extrudeMode.value);
  const valueLocked = useSelector(
    (s) => s.threedEditor.extrudeMode.valueLocked
  );
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );

  const updateAnnotation = useUpdateAnnotation();

  // Values read inside the (stable-per-activation) listeners.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const valueLockedRef = useRef(valueLocked);
  useEffect(() => {
    valueLockedRef.current = valueLocked;
  }, [valueLocked]);
  const faceSelectionAngleDegRef = useRef(faceSelectionAngleDeg);
  useEffect(() => {
    faceSelectionAngleDegRef.current = faceSelectionAngleDeg;
  }, [faceSelectionAngleDeg]);
  const updateAnnotationRef = useRef(updateAnnotation);
  useEffect(() => {
    updateAnnotationRef.current = updateAnnotation;
  }, [updateAnnotation]);
  // Set by the main effect so the typed-value effect below can refresh the
  // ghost without going through the pointer handlers.
  const rebuildGhostRef = useRef(null);

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

    // Coplanar-face hover state.
    const hover = { overlay: null, key: null };

    // Armed annotation (null until the first click):
    //   { annotationId, snapshot, baseHeight, axis, anchor, object, parent,
    //     ghost, downPos, tracking }
    let armed = null;
    let arming = false;

    // Per-annotation extrudability, resolved asynchronously (db reads) and
    // cached for the whole activation. Values: true | false | "PENDING".
    const eligibility = new Map();

    dom.style.cursor = "crosshair";

    function scheduleHover() {
      if (rafId == null && lastEvent) rafId = requestAnimationFrame(runHover);
    }

    function clearStipple() {
      if (hover.overlay) {
        disposeFaceHoverOverlay(hover.overlay);
        hover.overlay = null;
        sceneManager.renderScene?.();
      }
      hover.key = null;
    }

    function getEligibility(annotationId) {
      const cached = eligibility.get(annotationId);
      if (cached !== undefined) return cached;
      eligibility.set(annotationId, "PENDING");
      (async () => {
        let ok = false;
        try {
          const annotation = await db.annotations.get(annotationId);
          const template = annotation?.annotationTemplateId
            ? await db.annotationTemplates.get(annotation.annotationTemplateId)
            : null;
          ok = isAnnotationExtrudable(annotation, template);
        } catch (err) {
          console.error("[threedExtrude] eligibility check failed", err);
        }
        eligibility.set(annotationId, ok);
        // The cursor may have stopped over the face while we were resolving —
        // re-run the hover so the stipple shows up without a mouse move.
        scheduleHover();
      })();
      return "PENDING";
    }

    // Raycast the scene at the event position. Returns the first annotation
    // hit (mesh hits only, clipping- and visibility-aware) together with the
    // extrusion axis and whether the touched face is extrudable.
    //
    // Targets are collected explicitly instead of intersectObjects(scene,
    // recursive) for the same reason as the meshing mode: fat lines
    // (Line2/LineSegments2, which extend Mesh) can throw on a stale geometry.
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
          if (object.userData?.nodeId) {
            const axis = getBaseMapNormalWorld(object);
            return {
              nodeId: object.userData.nodeId,
              annotationObject: object,
              hitObject: intersect.object,
              intersect,
              axis,
              isTopFace: isExtrudableFaceHit(intersect, axis),
              rect,
            };
          }
          object = object.parent;
        }
      }
      return { rect };
    }

    // Stipple the face under the cursor (same overlay as the selection-mode
    // annotation hover), so the extrudable face is obvious before clicking.
    function applyStipple(object, faceIndex) {
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
        sceneManager.renderScene?.();
      }
    }

    function disposeGhost() {
      if (!armed?.ghost) return;
      armed.parent?.remove(armed.ghost);
      disposeObject(armed.ghost);
      armed.ghost = null;
    }

    function rebuildGhost(v) {
      if (!armed) return;
      disposeGhost();
      const height = Math.max(0, armed.baseHeight + v);
      const snapshot = {
        ...armed.snapshot,
        annotation: { ...armed.snapshot.annotation, height },
      };
      const ghost = buildTransientFaceMesh({
        snapshot,
        sharedIds: new Set(),
        deltaLocal: { x: 0, y: 0, z: 0 },
        mode: "WHOLE",
      });
      if (ghost && armed.parent) {
        armed.parent.add(ghost);
        armed.ghost = ghost;
      }
      sceneManager.renderScene?.();
    }
    rebuildGhostRef.current = rebuildGhost;

    // Restore the real mesh and drop the armed state. Never writes to the db.
    function cancelArm() {
      if (!armed) return;
      disposeGhost();
      deepShow(armed.object);
      armed = null;
      dispatch(setExtrudeTargetAnnotationId(null));
      sceneManager.renderScene?.();
    }

    async function arm(e, pick) {
      if (arming || armed) return;
      arming = true;
      try {
        const annotationId = pick.nodeId;
        const snapshot = await loadAnnotationSnapshot(annotationId);
        if (!snapshot) return;
        const object =
          sceneManager.annotationsManager?.annotationsObjectsMap?.[
            annotationId
          ] ?? pick.annotationObject;
        if (!object?.parent) return;

        clearStipple();
        armed = {
          annotationId,
          snapshot,
          baseHeight: Number(snapshot.annotation.height) || 0,
          axis: pick.axis.clone(),
          anchor: pick.intersect.point.clone(),
          object,
          parent: object.parent,
          ghost: null,
          downPos: { x: e.clientX, y: e.clientY },
          tracking: false,
        };
        deepHide(object);
        rebuildGhost(valueRef.current);
        dispatch(setExtrudeTargetAnnotationId(annotationId));
      } catch (err) {
        console.error("[threedExtrude] arming failed", err);
      } finally {
        arming = false;
      }
    }

    async function commit() {
      if (!armed) return;
      const { annotationId, baseHeight } = armed;
      const height = Math.max(0, baseHeight + (valueRef.current || 0));
      // Restore the real mesh first: the AnnotationsManager rebuilds it from
      // the new record as soon as the write propagates.
      cancelArm();
      try {
        await updateAnnotationRef.current({ id: annotationId, height });
      } catch (err) {
        console.error("[threedExtrude] commit failed", err);
      }
    }

    // Armed: the value follows the cursor along the extrusion axis — unless
    // the user typed one, which wins until they hand control back.
    function updateArmedValue(e) {
      if (valueLockedRef.current) return;
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (!armed.tracking) {
        const dx = Math.abs(e.clientX - armed.downPos.x);
        const dy = Math.abs(e.clientY - armed.downPos.y);
        if (dx <= TRACKING_THRESHOLD_PX && dy <= TRACKING_THRESHOLD_PX) return;
        armed.tracking = true;
      }
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const raw = getAxisDragValue({
        ray: raycaster.ray,
        anchor: armed.anchor,
        axis: armed.axis,
      });
      if (raw == null) return; // axis-aligned view: keep the last value
      const next = roundCm(raw);
      if (next === valueRef.current) return;
      valueRef.current = next;
      dispatch(setExtrudeValue(next));
      rebuildGhost(next);
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e) return;

      if (armed) {
        updateArmedValue(e);
        const rect = dom.getBoundingClientRect();
        setExtrudeOverlay({
          cursor: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label: `${valueRef.current > 0 ? "+" : ""}${valueRef.current} m`,
          },
        });
        return;
      }

      const pick = pickScene(e);
      const extrudable =
        pick?.nodeId && pick.isTopFace && getEligibility(pick.nodeId) === true;

      if (extrudable) {
        applyStipple(pick.hitObject, pick.intersect.faceIndex);
        setExtrudeOverlay({
          cursor: {
            x: e.clientX - pick.rect.left,
            y: e.clientY - pick.rect.top,
            label: "Extruder",
          },
        });
        dom.style.cursor = "crosshair";
      } else {
        clearStipple();
        clearExtrudeOverlay();
        dom.style.cursor = "default";
      }
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
      if (wasDrag) return; // camera orbit (shift+drag), not a click

      if (armed) {
        commit();
        return;
      }
      const pick = pickScene(e);
      if (!pick?.nodeId || !pick.isTopFace) return;
      if (getEligibility(pick.nodeId) !== true) return;
      arm(e, pick);
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
      clearExtrudeOverlay();
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        if (armed) cancelArm();
        else dispatch(setExtrudeModeActive(false));
      }
      if (e.key === "Enter" && armed) {
        commit();
      }
    }

    // The AnnotationsManager may recreate the armed annotation while it is
    // hidden (loadAnnotations re-fires on any useAnnotationsV2 recompute) —
    // the fresh object is visible by default and would overlay the ghost.
    const unsubReady =
      sceneManager.annotationsManager?.subscribeAnnotationReady?.((id) => {
        if (!armed || id !== armed.annotationId) return;
        const live =
          sceneManager.annotationsManager?.annotationsObjectsMap?.[id];
        if (!live) return;
        armed.object = live;
        armed.parent = live.parent || armed.parent;
        deepHide(live);
        rebuildGhost(valueRef.current);
      });

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
      unsubReady?.();
      rebuildGhostRef.current = null;
      if (rafId != null) cancelAnimationFrame(rafId);
      cancelArm();
      clearStipple();
      clearExtrudeOverlay();
      dom.style.cursor = "";
    };
  }, [active, dispatch]);

  // Typed value → refresh the ghost. The mouse-driven path rebuilds it
  // itself; here we only cover the keyboard, which never goes through the
  // pointer handlers (`valueLocked` is set by every field edit).
  useEffect(() => {
    if (!active || !valueLocked) return;
    rebuildGhostRef.current?.(value);
  }, [active, value, valueLocked]);
}
