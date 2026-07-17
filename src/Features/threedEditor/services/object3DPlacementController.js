import {
  CircleGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Plane,
  Quaternion,
  Raycaster,
  RingGeometry,
  Vector2,
  Vector3,
} from "three";

import worldToBaseMapNormalized from "Features/baseMaps/js/worldToBaseMapNormalized";
import pickHostBaseMap from "Features/threedDrawing/utils/pickHostBaseMap";

import pixelToWorld from "../js/utilsAnnotationsManager/pixelToWorld";
import { buildObject3DModelWrap } from "../js/utilsAnnotationsManager/createObject3DAnnotation";
import {
  getActiveClippingPlane,
  filterIntersectionsByClipping,
} from "../js/utilsAnnotationsManager/clippingPick";
import { filterIntersectionsByVisibility } from "../js/utilsAnnotationsManager/visibilityPick";

// Mirrors useDrawingPointerHandlers / useMeshingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;
// A face is a valid landing plane when its world normal is near-vertical
// (|dot| with world up — abs so DoubleSide winding is irrelevant).
const HORIZONTAL_DOT_MIN = 0.7;
// Same fluo green as the 2D auto-detection markers (TransientDetectedShapeLayer).
const FOOTPRINT_COLOR = 0x00ff00;
// Same fallback as getObject3DAnnotationRectanglePointsFromOnePoint (meters).
const FALLBACK_FOOTPRINT_M = 0.5;
// 2D detection markers blink opacity 0.4 → 1 → 0.4 over 1 s.
const BLINK_PERIOD_MS = 1000;
// Lift the footprint circle off the landing plane to avoid z-fighting.
const RING_LIFT_M = 0.01;
// Arrow-key rotation steps (degrees) — Shift = fine step.
const ROTATE_STEP_DEG = 10;
const ROTATE_FINE_STEP_DEG = 1;

// Mouse-follow placement of an OBJECT_3D template in the 3D editor: the GLB
// model + a blinking green footprint circle track the horizontal plane under
// the cursor (baseMap plane or horizontal face of an annotation mesh); a
// click reports the landing spot through `onCommit` and the mode stays
// active for repeated placement. Fully imperative — never touches React
// state per-frame (a MainThreedEditor re-render would rebuild the scene).
export default function createObject3DPlacementController({
  editor,
  sceneManager,
  dom,
  getObject3D,
  realisticShading,
  onCommit,
  onCancel,
}) {
  const imagesManager = sceneManager.imagesManager;

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const up = new Vector3(0, 1, 0);
  const normal = new Vector3();
  const quat = new Quaternion();
  const plane = new Plane();
  const scratch = new Vector3();

  let disposed = false;
  let rafId = null;
  let lastEvent = null;
  let downPos = null;
  let dragging = false;

  // Current landing spot ({ host, xNorm, yNorm, offset } or null).
  let target = null;

  // In-placement rotation (degrees, 2D convention: clockwise on screen —
  // rendered as -deg around basemap-local Z, same as the committed renderer).
  let rotationDeg = 0;

  // ── preview scene objects ────────────────────────────────────────────────

  const object3D = getObject3D();
  const footprintRadius =
    Math.max(
      object3D?.bbox?.width ?? FALLBACK_FOOTPRINT_M,
      object3D?.bbox?.depth ?? FALLBACK_FOOTPRINT_M
    ) / 2;

  const ringMaterial = new MeshBasicMaterial({
    color: FOOTPRINT_COLOR,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const discMaterial = new MeshBasicMaterial({
    color: FOOTPRINT_COLOR,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const ring = new Mesh(
    new RingGeometry(footprintRadius * 0.92, footprintRadius, 48),
    ringMaterial
  );
  const disc = new Mesh(new CircleGeometry(footprintRadius, 48), discMaterial);
  ring.position.z = RING_LIFT_M;
  disc.position.z = RING_LIFT_M;

  // The preview group lives INSIDE the host baseMap's group (re-parented on
  // host change) so it inherits the baseMap/version transform exactly like a
  // committed annotation. Local frame: Z = plane normal.
  const previewGroup = new Group();
  previewGroup.userData.isPlacementPreview = true;
  previewGroup.add(ring);
  previewGroup.add(disc);
  previewGroup.visible = false;

  // The preview must never catch its own picking rays.
  function stubRaycast(root) {
    root.traverse((obj) => {
      obj.raycast = () => {};
    });
  }
  stubRaycast(previewGroup);

  // GLB model loaded asynchronously; the footprint circle works meanwhile.
  buildObject3DModelWrap(object3D, { realisticShading }).then((modelWrap) => {
    if (disposed) {
      disposeObject(modelWrap);
      return;
    }
    if (!modelWrap) {
      onCancel?.({ reason: "GLB_MISSING" });
      return;
    }
    stubRaycast(modelWrap);
    previewGroup.add(modelWrap);
  });

  const previousCursor = dom.style.cursor;
  dom.style.cursor = "crosshair";

  // ── landing-spot resolution ──────────────────────────────────────────────

  function getLoadedBaseMaps() {
    return Object.values(imagesManager?.baseMapsMap ?? {});
  }

  // World point + host baseMap under the cursor: first mesh hit whose face is
  // near-horizontal (baseMap plane or top face of an annotation); fallback to
  // the nearest horizontal infinite baseMap plane (robust when the textured
  // plane is missing or 0-sized — same approach as ControlsManager's pivot).
  function resolveTarget(e) {
    const rect = dom.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, sceneManager.camera);

    const baseMaps = getLoadedBaseMaps();
    if (!baseMaps.length) return null;

    // Explicit targets instead of intersectObjects(scene, recursive): fat
    // lines (Line2/LineSegments2 extend Mesh) have a raycast that throws on
    // stale geometry (see useMeshingPointerHandlers).
    const targets = [];
    sceneManager.scene.traverse((obj) => {
      if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) {
        targets.push(obj);
      }
    });

    const intersects = filterIntersectionsByVisibility(
      filterIntersectionsByClipping(
        raycaster.intersectObjects(targets, false),
        getActiveClippingPlane(sceneManager)
      )
    );

    for (const intersect of intersects) {
      const face = intersect.face;
      if (!face) continue;
      normal.copy(face.normal).transformDirection(intersect.object.matrixWorld);
      if (Math.abs(normal.dot(up)) < HORIZONTAL_DOT_MIN) continue;

      // Host baseMap: ancestor tag first, geometric fallback otherwise.
      let ancestor = intersect.object;
      while (ancestor && !ancestor.userData?.baseMapId) {
        ancestor = ancestor.parent;
      }
      const host = ancestor?.userData?.baseMapId
        ? baseMaps.find((b) => b.id === ancestor.userData.baseMapId)
        : pickHostBaseMap([intersect.point], baseMaps);
      const result = host && buildTarget(host, intersect.point);
      if (result) return result;
    }

    // Fallback: nearest horizontal infinite baseMap plane along the ray.
    let best = null;
    let bestDistSq = Infinity;
    for (const baseMap of baseMaps) {
      const group = imagesManager.getGroup(baseMap.id);
      if (!group) continue;
      group.getWorldQuaternion(quat);
      normal.set(0, 0, 1).applyQuaternion(quat);
      if (Math.abs(normal.dot(up)) < HORIZONTAL_DOT_MIN) continue;
      group.getWorldPosition(scratch);
      plane.setFromNormalAndCoplanarPoint(normal, scratch);
      const point = raycaster.ray.intersectPlane(plane, scratch);
      if (!point) continue;
      const distSq = raycaster.ray.origin.distanceToSquared(point);
      if (distSq < bestDistSq) {
        const result = buildTarget(baseMap, point);
        if (result) {
          bestDistSq = distSq;
          best = result;
        }
      }
    }
    return best;
  }

  function buildTarget(host, worldPoint) {
    const projected = worldToBaseMapNormalized(worldPoint, host);
    if (!projected) return null;
    return {
      host,
      xNorm: projected.x,
      yNorm: projected.y,
      offset: projected.offset,
    };
  }

  function updatePreviewPose() {
    if (!target) {
      previewGroup.visible = false;
      return;
    }
    const group = imagesManager.getGroup(target.host.id);
    // Tolerant to both BaseMap instances and plain records (same pattern as
    // worldToBaseMapNormalized / AnnotationsManager). Reference frame size.
    const imageSize =
      target.host.getImageSize?.() ?? target.host.image?.imageSize;
    const meterByPx = target.host.getMeterByPx?.() ?? target.host.meterByPx;
    if (!group || !imageSize?.width || !imageSize?.height || !meterByPx) {
      previewGroup.visible = false;
      return;
    }
    if (previewGroup.parent !== group) group.add(previewGroup);
    // Same px → basemap-local math as the committed annotation renderer.
    const local = pixelToWorld(
      { x: target.xNorm * imageSize.width, y: target.yNorm * imageSize.height },
      {
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        meterByPx,
      }
    );
    previewGroup.position.set(local.x, local.y, target.offset);
    previewGroup.visible = true;
  }

  // ── rAF loop: blink + mouse-follow + continuous render ───────────────────
  // The scene renders on demand; the blink needs continuous frames while the
  // mode is active (same as WalkModeController owning its own loop).

  function tick(now) {
    if (disposed) return;
    const phase = 0.5 + 0.5 * Math.sin((2 * Math.PI * now) / BLINK_PERIOD_MS);
    ringMaterial.opacity = 0.4 + 0.6 * phase;
    if (lastEvent) {
      target = resolveTarget(lastEvent);
      updatePreviewPose();
      lastEvent = null;
    }
    editor.renderScene?.();
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // ── pointer / key handlers ───────────────────────────────────────────────

  function onPointerDown(e) {
    if (e.button !== 0) return;
    downPos = { x: e.clientX, y: e.clientY };
    dragging = false;
  }

  function onPointerMove(e) {
    lastEvent = e;
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
    // Resolve at the click position (the rAF may not have consumed the last
    // move yet, or the pointer may not have moved at all).
    target = resolveTarget(e);
    updatePreviewPose();
    if (!target) return;
    onCommit?.({
      hostBaseMap: target.host,
      xNorm: target.xNorm,
      yNorm: target.yNorm,
      offset: target.offset,
      rotationDeg: ((rotationDeg % 360) + 360) % 360,
    });
  }

  function onPointerLeave() {
    lastEvent = null;
    target = null;
    previewGroup.visible = false;
  }

  function applyRotation() {
    // Same sign convention as the committed renderer (createObject3DAnnotation):
    // SVG rotation is clockwise on screen → -deg around basemap-local Z.
    previewGroup.rotation.z = MathUtils.degToRad(-rotationDeg);
  }

  function onKeyDown(e) {
    // Never steal keys from form fields (e.g. a search input elsewhere).
    if (e.target?.closest?.("input, textarea, [contenteditable]")) return;
    if (e.key === "Escape") {
      onCancel?.({ reason: "ESCAPE" });
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.shiftKey ? ROTATE_FINE_STEP_DEG : ROTATE_STEP_DEG;
      rotationDeg += e.key === "ArrowRight" ? step : -step;
      applyRotation();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      rotationDeg = 0;
      applyRotation();
    }
  }

  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("pointermove", onPointerMove);
  dom.addEventListener("pointerup", onPointerUp);
  dom.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);

  // ── teardown ─────────────────────────────────────────────────────────────

  function disposeObject(root) {
    root?.traverse?.((obj) => {
      obj.geometry?.dispose?.();
      const materials = Array.isArray(obj.material)
        ? obj.material
        : obj.material
          ? [obj.material]
          : [];
      materials.forEach((m) => m.dispose?.());
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    dom.removeEventListener("pointerdown", onPointerDown);
    dom.removeEventListener("pointermove", onPointerMove);
    dom.removeEventListener("pointerup", onPointerUp);
    dom.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("keydown", onKeyDown);
    previewGroup.parent?.remove(previewGroup);
    disposeObject(previewGroup);
    dom.style.cursor = previousCursor;
    editor.renderScene?.();
  }

  return { dispose };
}
