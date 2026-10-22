import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Matrix4, Raycaster, Vector2, Vector3 } from "three";

import db from "App/db/db";
import store from "App/store";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  appendToExtrudeValueBuffer,
  clearExtrudeValueBuffer,
  deleteLastExtrudeValueBuffer,
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
import preferLineHits from "Features/threedEditor/js/utilsAnnotationsManager/preferLineHits";
import applyAnnotationMaterialState, {
  STATE_HOVER,
  STATE_NONE,
} from "Features/threedEditor/js/utilsAnnotationsManager/applyAnnotationMaterialState";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import computeAxisLockSnap from "Features/threedAnnotationMove/utils/computeAxisLockSnap";
import {
  buildTransientFaceMesh,
  loadAnnotationSnapshot,
} from "Features/threedDrawing/services/buildTransientFaceMesh";
import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import getBaseMapNormalWorld from "Features/threedDrawing/utils/getBaseMapNormalWorld";
import {
  deepHide,
  deepShow,
} from "Features/threedDrawing/utils/deepVisibility";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import createAnnotationObject3D, {
  getShrunkHeight,
} from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import getEditableMesh3d, {
  mesh3dLocalToWorld,
  worldToMesh3dLocal,
} from "Features/annotationMesh3d/services/getEditableMesh3d";
import { isDisplayedShrunk } from "Features/meshPaint/services/ensureUnshrunkHostObject";
import writeMesh3dService from "Features/annotationMesh3d/services/writeMesh3dService";
import locateHitFaceOnMesh3d from "Features/annotationMesh3d/services/locateHitFaceOnMesh3d";
import getPushPullRange from "Features/annotationMesh3d/utils/getPushPullRange";
import isAnnotationConvertibleToMesh3d from "Features/annotationMesh3d/utils/isAnnotationConvertibleToMesh3d";
import {
  MIN_THICKNESS_M,
  WELD_PRECISION_M,
} from "Features/annotationMesh3d/utils/mesh3dConstants";
import {
  mesh3dFromLocal,
  roundOffsetZ,
} from "Features/annotationMesh3d/utils/mesh3dFrame";
import buildRibbonMesh3d from "Features/annotationMesh3d/utils/buildRibbonMesh3d";
import {
  getDistanceToFacePlane,
  getFaceNormal,
} from "Features/annotationMesh3d/utils/mesh3dTopology";
import pushPullMesh3dFace from "Features/annotationMesh3d/utils/pushPullMesh3dFace";
import resolvePushPull, {
  getMesh3dFaceSheet,
  resolvePushPullValue,
} from "Features/annotationMesh3d/utils/resolvePushPull";

import {
  setExtrudeOverlay,
  clearExtrudeOverlay,
} from "../services/extrudeOverlayStore";
import getAxisDragValue from "../utils/getAxisDragValue";
import isAnnotationExtrudable from "../utils/isAnnotationExtrudable";
import isExtrudableFaceHit from "../utils/isExtrudableFaceHit";
import parseExtrudeValueBuffer, {
  EXTRUDE_BUFFER_CHAR_RE,
} from "../utils/parseExtrudeValueBuffer";
import resolveLineExtrusionAxis from "../utils/resolveLineExtrusionAxis";

// Mirrors useMeshingPointerHandlers / useDrawingPointerHandlers.
const DRAG_THRESHOLD_PX = 4;
// The armed value only starts following the cursor once it has really moved,
// so a click-click without moving applies the value shown in the toolbar.
const TRACKING_THRESHOLD_PX = 4;

// Same guard as the 2D hotkeys: never steal keystrokes from a real field.
const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Screen distance under which the armed face snaps on a scene vertex — the
// vertex snap of the 3D drawing tools.
const SNAP_THRESHOLD_PX = 12;
// A base sheet must be this parallel to the base map to dig along its axis.
const DIG_SHEET_MIN_DOT = 0.999;
// A LINE extrusion axis this parallel to the base map normal keeps the
// polyline a parametric wall (`height`) instead of a ribbon mesh.
const WALL_AXIS_MIN_DOT = 0.999;

// The flat fat line of a POLYLINE (extrudePolylineWall): the only Line2 the
// tool picks. Other fat lines (POINT trait, revolution axis / circle) carry
// exportLine too, hence the annotation type check on the root object.
function isPolylineFatLine(obj) {
  if (!obj.isLine2 || !obj.userData?.isSnapLine || !obj.userData?.exportLine) {
    return false;
  }
  let current = obj;
  while (current) {
    if (current.userData?.nodeId) {
      return current.userData.annotationType === "POLYLINE";
    }
    current = current.parent;
  }
  return false;
}

// A POLYLINE lying flat on its base map: no height, and the same vertical
// offset at every vertex (bottom = offsetBottom, top = height + offsetTop —
// a `height` written on it is then its real span). Such a line pulled along
// the base map normal stays a regular wall.
function isPolylineFlatOnBaseMap(annotation) {
  if (!annotation || Number(annotation.height) > 0) return false;
  const refs = annotation.points || [];
  if (!refs.length) return false;
  const first = Number(refs[0]?.offsetBottom) || 0;
  return refs.every((ref) => {
    const bottom = Number(ref?.offsetBottom) || 0;
    const top = Number(ref?.offsetTop) || 0;
    return Math.abs(bottom - first) < 1e-6 && Math.abs(top - bottom) < 1e-6;
  });
}

// Anchor of a push / pull picked on the DISPLAYED object, moved onto the
// plane of the editable face: a conversion reads the un-shrunk object, whose
// face sits up to 10 mm from the shrunk display — a snap (vertex − anchor)
// would otherwise land that far past its target.
function anchorOnMesh3dFace(ctx, faceIndex, point) {
  const face = ctx.mesh.faces[faceIndex];
  const p = worldToMesh3dLocal(point, ctx);
  const n = getFaceNormal(ctx.mesh.vertices, face);
  const d = getDistanceToFacePlane(ctx.mesh.vertices, face, p, n);
  return mesh3dLocalToWorld(
    { x: p.x - n.x * d, y: p.y - n.y * d, z: p.z - n.z * d },
    ctx
  );
}

function roundCm(value) {
  return Math.round(value * 100) / 100;
}

// Snapped values are kept exact, to the precision offsetZ is stored with.
function roundTenthMm(value) {
  return Math.round(value * 1e4) / 1e4;
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
// - hover: eligible faces get the coplanar stipple + a cursor helper. Two
//   kinds of push/pull share the flow:
//   · HEIGHT — a face pointing along the extrusion axis (the baseMap normal)
//     of a regular annotation: the value drives `annotation.height`.
//     Template-locked heights and REVOLUTION / EXTRUSION_PROFILE shapes are
//     silently ignored. Pushed BELOW its base, a plain prism digs an open
//     basin instead of stopping flat: the annotation is then stored as a
//     face mesh, like MESH3D.
//   · MESH3D — any face of an isMesh3d annotation, or a lateral / bottom
//     face of a convertible regular annotation: the face moves along its own
//     normal and the annotation is stored as a face mesh (converted on
//     commit, see annotationMesh3d). A prism face may go through the
//     opposite one (see resolvePushPull).
//   · LINE — a flat POLYLINE (its fat line): the line is swept into a
//     SURFACE, one quad per segment. The axis is the normal of the plane
//     its vertices lie on (resolveLineExtrusionAxis; a 2-point / collinear
//     line uses the base map normal), or, while Shift is held, the gizmo
//     user axis (X / Y / Z) closest to the cursor — the lock of « Déplacer ».
//     A line flat on its base map pulled along the base map normal stays a
//     POLYLINE and gets its `height` (a negative pull lowers `offsetZ`
//     instead); any other sweep stores the ribbon as a face mesh.
// - click 1: arms the annotation owning the face. Its real mesh is hidden and
//   replaced by a transient ghost rebuilt at every value change.
// - mouse move: the value follows the cursor along the axis (toolbar field +
//   ghost + cursor chip). Near a scene vertex, the face snaps on it.
// - typing digits: captured straight from the keyboard into
//   `extrudeMode.valueBuffer` — no focused field, exactly like the 2D drawing
//   constraint buffer. A non-empty buffer wins over the mouse; Backspace
//   erases it character by character.
// - click 2 / Enter: commits. The ghost stays in place of the real mesh until
//   the AnnotationsManager has rebuilt it from the written data, so the
//   previous geometry never flashes back. Escape cancels the armed state, or
//   leaves the mode when nothing is armed.
export default function useExtrudePointerHandlers() {
  const dispatch = useDispatch();

  const active = useSelector((s) => s.threedEditor.extrudeMode.active);
  const value = useSelector((s) => s.threedEditor.extrudeMode.value);
  const valueBuffer = useSelector(
    (s) => s.threedEditor.extrudeMode.valueBuffer
  );
  const faceSelectionAngleDeg = useSelector(
    (s) => s.threedEditor.faceSelectionAngleDeg
  );

  const updateAnnotation = useUpdateAnnotation();

  // The typed buffer wins over the mouse-derived value as soon as it holds a
  // parsable number.
  const effectiveValue = parseExtrudeValueBuffer(valueBuffer) ?? value;

  // Values read inside the (stable-per-activation) listeners.
  const valueRef = useRef(effectiveValue);
  useEffect(() => {
    valueRef.current = effectiveValue;
  }, [effectiveValue]);
  const valueBufferRef = useRef(valueBuffer);
  useEffect(() => {
    valueBufferRef.current = valueBuffer;
  }, [valueBuffer]);
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
  // Same for the cursor helper: replays the hover at the last pointer position.
  const scheduleHoverRef = useRef(null);

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

    // Coplanar-face hover state; `line`: the POLYLINE object recolored while
    // its fat line is hovered (no face to stipple).
    const hover = { overlay: null, key: null, line: null };
    // Shift state read by the LINE kind (axis lock). Tracked from the pointer
    // events AND the key events: a press / release while the mouse is still
    // must re-evaluate the axis.
    let shiftHeld = false;

    const annotationsManager = sceneManager.annotationsManager;

    // Armed annotation (null until the first click):
    //   { kind, annotationId, axis, anchor, object, parent, ghost, downPos,
    //     tracking, snapVerts, snap,
    //     HEIGHT: snapshot, baseHeight, dig — MESH3D: ctx, faceIndex, range
    //     LINE: ctx, localPoints, closeLine, naturalAxis, axisKey, snapshot,
    //           wallAllowed, baseMapNormal }
    let armed = null;
    let arming = false;
    // Set by the cleanup: an arm / commit resuming after an await (the
    // un-shrink rebuild, a carve: up to seconds) must not touch the scene
    // once the tool is off.
    let disposed = false;

    // Committed annotations whose ghost still stands for the real object:
    // annotationId -> { ghost, object, source }. `source` is the resolved
    // annotation the hidden object was built from at commit time.
    const pending = new Map();

    // Per-annotation extrudability, resolved asynchronously (db reads) and
    // cached for the whole activation. Values: "PENDING" | { height, mesh,
    // isMesh3d, line } — which push/pull kinds the annotation accepts.
    const eligibility = new Map();

    dom.style.cursor = "crosshair";

    function scheduleHover() {
      if (rafId == null && lastEvent) rafId = requestAnimationFrame(runHover);
    }
    scheduleHoverRef.current = scheduleHover;

    function clearLineHover() {
      if (!hover.line) return;
      applyAnnotationMaterialState(hover.line, STATE_NONE);
      hover.line = null;
      sceneManager.renderScene?.();
    }

    function clearStipple() {
      if (hover.overlay) {
        disposeFaceHoverOverlay(hover.overlay);
        hover.overlay = null;
        sceneManager.renderScene?.();
      }
      hover.key = null;
      clearLineHover();
    }

    // Whole-object recolor of a hovered flat polyline — the fallback the
    // selection hover uses for fat-line hits (no face to stipple).
    function applyLineHover(object) {
      if (hover.line === object) return;
      clearStipple();
      applyAnnotationMaterialState(object, STATE_HOVER);
      hover.line = object;
      sceneManager.renderScene?.();
    }

    function getEligibility(annotationId) {
      const cached = eligibility.get(annotationId);
      if (cached !== undefined) return cached;
      eligibility.set(annotationId, "PENDING");
      (async () => {
        let result = {
          height: false,
          mesh: false,
          isMesh3d: false,
          line: false,
        };
        try {
          const annotation = await db.annotations.get(annotationId);
          const template = annotation?.annotationTemplateId
            ? await db.annotationTemplates.get(annotation.annotationTemplateId)
            : null;
          const isMesh3d = Boolean(annotation?.isMesh3d);
          result = {
            isMesh3d,
            height: !isMesh3d && isAnnotationExtrudable(annotation, template),
            mesh: isMesh3d || isAnnotationConvertibleToMesh3d(annotation),
            // A flat polyline (fat line): swept into a surface.
            line:
              !isMesh3d &&
              annotation?.type === "POLYLINE" &&
              !(Number(annotation.height) > 0) &&
              annotation.strokeWidthUnit !== "CM" &&
              isAnnotationConvertibleToMesh3d(annotation),
          };
        } catch (err) {
          console.error("[threedExtrude] eligibility check failed", err);
        }
        eligibility.set(annotationId, result);
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
    // The flat polylines are the exception: their fat line carries its own
    // raycast (attachFatLineRaycast), and preferLineHits lets one lying on a
    // slab win the distance tie against that slab.
    function pickScene(e) {
      const rect = dom.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneManager.camera);
      const clippingPlane = getActiveClippingPlane(sceneManager);

      const targets = [];
      sceneManager.scene.traverse((obj) => {
        if (!obj.isMesh) return;
        if (obj.isLine2 || obj.isLineSegments2) {
          if (isPolylineFatLine(obj)) targets.push(obj);
          return;
        }
        targets.push(obj);
      });

      const intersects = preferLineHits(
        filterIntersectionsByVisibility(
          filterIntersectionsByClipping(
            raycaster.intersectObjects(targets, false),
            clippingPlane
          )
        )
      );

      for (const intersect of intersects) {
        let object = intersect.object;
        while (object) {
          if (object.userData?.nodeId) {
            const axis = getBaseMapNormalWorld(object);
            const isLine = Boolean(intersect.object.isLine2);
            return {
              nodeId: object.userData.nodeId,
              annotationObject: object,
              hitObject: intersect.object,
              intersect,
              axis,
              isLine,
              isTopFace: !isLine && isExtrudableFaceHit(intersect, axis),
              isMesh3dObject: Boolean(object.userData.isAnnotationMesh3d),
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
      clearLineHover();
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

    // Which push/pull the face under the cursor gets: "HEIGHT", "MESH3D",
    // "LINE" or null (not extrudable / eligibility still resolving).
    function getPickKind(pick) {
      if (!pick?.nodeId) return null;
      if (pending.has(pick.nodeId)) return null; // commit still landing
      const el = getEligibility(pick.nodeId);
      if (el === "PENDING") return null;
      if (pick.isLine) return el.line ? "LINE" : null;
      // A mesh host carved live by a subtraction has one collapsed solid
      // (no mesh3dFaceIndex): not editable until « Soustraire
      // définitivement » (getEditableMesh3d refuses it) — no stipple either.
      if (pick.isMesh3dObject) {
        return el.isMesh3d && !pick.hitObject?.userData?.hasSubtraction
          ? "MESH3D"
          : null;
      }
      if (pick.isTopFace) return el.height ? "HEIGHT" : null;
      return el.mesh ? "MESH3D" : null;
    }

    // The value really applied for a requested one: a MESH3D face is limited
    // by the material behind it, unless it can go through.
    function getAppliedValue(v) {
      if (armed?.kind !== "MESH3D") return v;
      return resolvePushPullValue(v, armed.range).applied;
    }

    // LINE: the ribbon the polyline sweeps for a value. Along the base map
    // normal, a line flat on its base map stays a wall: `height` = the span,
    // a negative pull lowers `offsetZ` by it. Anything else is a face mesh.
    // Under the minimum thickness there is nothing to write ({ mesh: null,
    // height: undefined }).
    function resolveLine(v) {
      const { ctx, localPoints, closeLine, axis, baseMapNormal, wallAllowed } =
        armed;
      if (!Number.isFinite(v) || Math.abs(v) < MIN_THICKNESS_M) {
        return { applied: v, ctx, mesh: null };
      }
      const along = axis.dot(baseMapNormal);
      if (wallAllowed && Math.abs(along) > WALL_AXIS_MIN_DOT) {
        const signed = along > 0 ? v : -v;
        const base = Number(ctx.annotation.offsetZ) || 0;
        return {
          applied: v,
          height: Math.abs(v),
          offsetZ: roundOffsetZ(signed < 0 ? base + signed : base),
        };
      }
      ctx.baseMapGroup.updateWorldMatrix(true, false);
      const toLocal = new Matrix4().copy(ctx.baseMapGroup.matrixWorld).invert();
      const direction = axis.clone().transformDirection(toLocal).normalize();
      const camera = sceneManager.camera;
      const eye = camera
        ? ctx.baseMapGroup.worldToLocal(camera.position.clone())
        : null;
      const normalHint = eye
        ? {
            x: eye.x - localPoints[0].x,
            y: eye.y - localPoints[0].y,
            z: eye.z - localPoints[0].z,
          }
        : null;
      const mesh = buildRibbonMesh3d({
        points: localPoints,
        direction,
        distance: v,
        closeLine,
        normalHint,
      });
      return { applied: v, ctx, mesh };
    }

    // What the armed annotation becomes for a value:
    //   { applied, ctx, mesh } — a face mesh (written by writeMesh3dService);
    //   { applied, height, offsetZ? } — a regular annotation of that height.
    function resolveArmed(v) {
      if (armed.kind === "LINE") return resolveLine(v);
      if (armed.kind === "MESH3D") {
        const { ctx, faceIndex, range } = armed;
        return { ctx, ...resolvePushPull(ctx.mesh, faceIndex, v, range) };
      }
      const total = armed.baseHeight + v;
      const { dig } = armed;
      if (dig && total <= -MIN_THICKNESS_M) {
        return {
          applied: v,
          ctx: dig.ctx,
          mesh: pushPullMesh3dFace(dig.sheet, 0, total * dig.sign),
        };
      }
      return { applied: v, height: Math.max(0, total) };
    }

    function disposeGhost() {
      if (!armed?.ghost) return;
      armed.parent?.remove(armed.ghost);
      disposeObject(armed.ghost);
      armed.ghost = null;
    }

    function buildGhost(result) {
      if (result.mesh) {
        const { ctx } = result;
        const { mesh3d, offsetZ } = mesh3dFromLocal(
          result.mesh,
          ctx.metrics,
          ctx.baseOffsetZ
        );
        return createAnnotationObject3D(
          {
            ...ctx.annotation,
            type: "POLYGON",
            isMesh3d: true,
            mesh3d,
            offsetZ,
          },
          ctx.metrics
        );
      }
      if (result.height == null || !armed.snapshot) return null;
      const snapshot = {
        ...armed.snapshot,
        annotation: {
          ...armed.snapshot.annotation,
          height: result.height,
          ...(result.offsetZ != null ? { offsetZ: result.offsetZ } : {}),
        },
      };
      return buildTransientFaceMesh({
        snapshot,
        sharedIds: new Set(),
        deltaLocal: { x: 0, y: 0, z: 0 },
        mode: "WHOLE",
      });
    }

    function rebuildGhost(v) {
      if (!armed) return;
      disposeGhost();
      const ghost = buildGhost(resolveArmed(v));
      if (ghost && armed.parent) {
        armed.parent.add(ghost);
        armed.ghost = ghost;
      }
      // Nothing to show for the value (a LINE under the minimum thickness):
      // the real object stands in for the ghost instead of vanishing.
      if (ghost) deepHide(armed.object);
      else deepShow(armed.object);
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

    // Commit: the ghost keeps standing for the annotation, whose real object
    // stays hidden, until the AnnotationsManager has rebuilt it from the
    // written data (see the annotation-ready subscription below). Showing the
    // real object back right away would flash its previous geometry.
    function holdGhostUntilRebuilt() {
      const { annotationId, ghost, object } = armed;
      pending.set(annotationId, {
        ghost,
        object,
        source: annotationsManager.getAnnotationSource(annotationId),
      });
      armed = null;
      dispatch(setExtrudeTargetAnnotationId(null));
    }

    // Drops the ghost of a committed annotation. restore: the write did not
    // land — show the (unchanged) real object back.
    function releasePending(annotationId, { restore = false } = {}) {
      const entry = pending.get(annotationId);
      if (!entry) return;
      pending.delete(annotationId);
      entry.ghost.parent?.remove(entry.ghost);
      disposeObject(entry.ghost);
      if (restore) {
        deepShow(
          annotationsManager?.annotationsObjectsMap?.[annotationId] ??
            entry.object
        );
      }
      sceneManager.renderScene?.();
    }

    // HEIGHT arm: what the annotation digs from once its top goes below its
    // base — the base outline as a lone sheet, pushed down into a basin (see
    // resolveArmed). Null when the solid is not a plain prism (sloped top,
    // not convertible...): the height then just stops at 0.
    // unshrink: false = a probe of the displayed object (the arm: the host
    // keeps its anti-aliasing shrink unless the dig is really committed —
    // then the commit re-probes with unshrink: true, see commit()).
    async function loadDig(pick, { unshrink = false } = {}) {
      if (!eligibility.get(pick.nodeId)?.mesh) return null;
      try {
        const ctx = await getEditableMesh3d({
          editor,
          annotationId: pick.nodeId,
          unshrink,
        });
        if (!ctx) return null;
        let sheet = null;
        if (ctx.mesh.faces.length === 1) {
          sheet = ctx.mesh; // flat polygon
        } else {
          const faceIndex = locateHitFaceOnMesh3d(
            ctx,
            pick.intersect,
            sceneManager.camera
          );
          if (faceIndex < 0) return null;
          const { through } = getPushPullRange(ctx.mesh, faceIndex);
          if (through) {
            sheet = getMesh3dFaceSheet(ctx.mesh, faceIndex, -through.depth);
          }
        }
        if (!sheet) return null;
        // The value runs along the base map normal (local +z), a push/pull
        // distance along the face normal.
        const nz = getFaceNormal(sheet.vertices, sheet.faces[0]).z;
        if (Math.abs(nz) < DIG_SHEET_MIN_DOT) return null;
        return { ctx, sheet, sign: Math.sign(nz), pick };
      } catch (err) {
        console.error("[threedExtrude] dig context failed", err);
        return null;
      }
    }

    // Snap targets of an arm: every scene vertex, the armed annotation's own
    // included — read BEFORE it is hidden and before any ghost exists.
    function buildSnapVerts() {
      return buildIndex(sceneManager.scene).verts;
    }

    // MESH3D arm: the face moves along its own normal. A regular annotation
    // is converted in memory here — nothing is written before the commit.
    async function armMesh3d(e, pick) {
      const annotationId = pick.nodeId;
      const ctx = await getEditableMesh3d({ editor, annotationId });
      if (disposed) return;
      if (!ctx) {
        console.warn(
          `[threedExtrude] annotation ${annotationId} cannot be edited as a mesh`
        );
        return;
      }
      const faceIndex = ctx.isConversion
        ? locateHitFaceOnMesh3d(ctx, pick.intersect, sceneManager.camera)
        : (pick.hitObject.userData?.mesh3dFaceIndex ?? -1);
      if (!ctx.mesh.faces[faceIndex]) return;

      const object =
        sceneManager.annotationsManager?.annotationsObjectsMap?.[
          annotationId
        ] ?? pick.annotationObject;
      if (!object?.parent) return;

      const normal = getFaceNormal(
        ctx.mesh.vertices,
        ctx.mesh.faces[faceIndex]
      );
      ctx.baseMapGroup.updateWorldMatrix(true, false);
      const axis = new Vector3(normal.x, normal.y, normal.z)
        .transformDirection(ctx.baseMapGroup.matrixWorld)
        .normalize();

      clearStipple();
      armed = {
        kind: "MESH3D",
        annotationId,
        ctx,
        faceIndex,
        range: getPushPullRange(ctx.mesh, faceIndex),
        axis,
        anchor: ctx.isConversion
          ? anchorOnMesh3dFace(ctx, faceIndex, pick.intersect.point)
          : pick.intersect.point.clone(),
        object,
        parent: object.parent,
        ghost: null,
        downPos: { x: e.clientX, y: e.clientY },
        tracking: false,
        snapVerts: buildSnapVerts(),
        snap: null,
      };
      deepHide(object);
      rebuildGhost(valueRef.current);
      dispatch(setExtrudeTargetAnnotationId(annotationId));
    }

    // LINE arm: the polyline's points come from its displayed fat line
    // (exportLine: the builder's sampled, offset points in the base map
    // frame), so the ribbon starts exactly on what was clicked.
    async function armLine(e, pick) {
      const annotationId = pick.nodeId;
      const annotation = await db.annotations.get(annotationId);
      if (disposed || !annotation || annotation.deletedAt) return;
      const imagesManager = sceneManager.imagesManager;
      const metrics = getBaseMapForRender(
        imagesManager?.baseMapsMap?.[annotation.baseMapId]
      );
      const baseMapGroup = imagesManager?.getGroup?.(annotation.baseMapId);
      if (!metrics || !baseMapGroup) return;
      const object =
        sceneManager.annotationsManager?.annotationsObjectsMap?.[
          annotationId
        ] ?? pick.annotationObject;
      if (!object?.parent) return;

      const line = pick.hitObject;
      const positions = line?.userData?.exportLine?.positions || [];
      line.updateWorldMatrix(true, false);
      baseMapGroup.updateWorldMatrix(true, false);
      const worldPoints = [];
      const localPoints = [];
      for (let i = 0; i + 2 < positions.length; i += 3) {
        const world = line.localToWorld(
          new Vector3(positions[i], positions[i + 1], positions[i + 2])
        );
        const local = baseMapGroup.worldToLocal(world.clone());
        const last = localPoints[localPoints.length - 1];
        if (
          last &&
          Math.abs(last.x - local.x) < WELD_PRECISION_M &&
          Math.abs(last.y - local.y) < WELD_PRECISION_M &&
          Math.abs(last.z - local.z) < WELD_PRECISION_M
        ) {
          continue;
        }
        worldPoints.push(world);
        localPoints.push({ x: local.x, y: local.y, z: local.z });
      }
      const closeLine = Boolean(annotation.closeLine);
      if (closeLine && localPoints.length > 1) {
        const first = localPoints[0];
        const last = localPoints[localPoints.length - 1];
        if (
          Math.abs(last.x - first.x) < WELD_PRECISION_M &&
          Math.abs(last.y - first.y) < WELD_PRECISION_M &&
          Math.abs(last.z - first.z) < WELD_PRECISION_M
        ) {
          localPoints.pop();
          worldPoints.pop();
        }
      }
      if (localPoints.length < 2) return;

      const baseMapNormal = getBaseMapNormalWorld(object);
      const anchor = pick.intersect.point.clone();
      const { axis: naturalAxis } = resolveLineExtrusionAxis({
        worldPoints,
        baseMapNormal,
        cameraPosition: sceneManager.camera?.position ?? null,
        anchor,
      });
      // The wall ghost (buildTransientFaceMesh) and the "flat" test read the
      // resolved snapshot.
      const snapshot = await loadAnnotationSnapshot(annotationId);
      if (disposed) return;
      const el = eligibility.get(annotationId);
      const wallAllowed =
        Boolean(el?.height) &&
        Boolean(snapshot) &&
        isPolylineFlatOnBaseMap(annotation);

      clearStipple();
      armed = {
        kind: "LINE",
        annotationId,
        ctx: {
          annotation,
          mesh: null,
          baseOffsetZ: 0,
          metrics,
          baseMapGroup,
          isConversion: true,
          isShrunk: false,
        },
        localPoints,
        closeLine,
        naturalAxis,
        axis: naturalAxis.clone(),
        axisKey: null,
        anchor,
        snapshot,
        wallAllowed,
        baseMapNormal,
        object,
        parent: object.parent,
        ghost: null,
        downPos: { x: e.clientX, y: e.clientY },
        tracking: false,
        snapVerts: buildSnapVerts(),
        snap: null,
      };
      rebuildGhost(valueRef.current);
      dispatch(setExtrudeTargetAnnotationId(annotationId));
    }

    async function arm(e, pick, kind) {
      if (arming || armed) return;
      arming = true;
      try {
        if (kind === "MESH3D") {
          await armMesh3d(e, pick);
          return;
        }
        if (kind === "LINE") {
          await armLine(e, pick);
          return;
        }
        const annotationId = pick.nodeId;
        const snapshot = await loadAnnotationSnapshot(annotationId);
        if (disposed || !snapshot) return;
        const dig = await loadDig(pick);
        if (disposed) return;
        const object =
          sceneManager.annotationsManager?.annotationsObjectsMap?.[
            annotationId
          ] ?? pick.annotationObject;
        if (!object?.parent) return;

        // A top picked on a shrunk display sits up to 5 mm below the real
        // top: the anchor goes back up to it, so a snapped height is exact.
        const baseHeight = Number(snapshot.annotation.height) || 0;
        const anchor = pick.intersect.point.clone();
        const source = annotationsManager?.getAnnotationSource?.(annotationId);
        const shrinkOn = Boolean(
          store.getState().threedEditor?.antiAliasingShrink
        );
        if (isDisplayedShrunk(source, shrinkOn) && baseHeight > 0) {
          const topShrink =
            baseHeight -
            getShrunkHeight(baseHeight, { antiAliasingShrink: true }, source);
          if (topShrink > 0) anchor.addScaledVector(pick.axis, topShrink);
        }

        clearStipple();
        armed = {
          kind: "HEIGHT",
          annotationId,
          snapshot,
          baseHeight,
          dig,
          axis: pick.axis.clone(),
          anchor,
          object,
          parent: object.parent,
          ghost: null,
          downPos: { x: e.clientX, y: e.clientY },
          tracking: false,
          snapVerts: buildSnapVerts(),
          snap: null,
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
      // A dig probed on the displayed (shrunk) object: re-probed on the
      // un-shrunk one before writing, so the anti-aliasing inset never
      // reaches the stored basin. Only a real dig exempts the host.
      if (
        armed.kind === "HEIGHT" &&
        armed.dig?.ctx?.isShrunk &&
        resolveArmed(valueRef.current || 0).mesh
      ) {
        const target = armed;
        const dig = await loadDig(target.dig.pick, { unshrink: true });
        if (disposed || armed !== target) return;
        if (dig) armed.dig = dig;
      }
      const { annotationId, kind, baseHeight } = armed;
      const result = resolveArmed(valueRef.current || 0);
      // A zero push changes nothing — in particular it must not convert a
      // regular annotation into a mesh.
      let unchanged;
      if (kind === "LINE") unchanged = !result.mesh && result.height == null;
      else if (result.mesh) unchanged = result.mesh === result.ctx.mesh;
      else unchanged = kind === "HEIGHT" && result.height === baseHeight;

      if (unchanged || !armed.ghost || !annotationsManager) cancelArm();
      else holdGhostUntilRebuilt();
      // The typed value is consumed by the commit (same as the 2D constraint
      // buffer), but stays displayed so the next face can reuse it.
      if (valueBufferRef.current !== "") {
        dispatch(setExtrudeValue(result.applied));
        dispatch(clearExtrudeValueBuffer());
      }
      if (unchanged) return;

      // The annotation may have just become a mesh: its faces are picked
      // another way from now on.
      eligibility.delete(annotationId);
      try {
        if (result.mesh) {
          const { ctx } = result;
          const written = await writeMesh3dService({
            annotation: ctx.annotation,
            mesh: result.mesh,
            baseOffsetZ: ctx.baseOffsetZ,
            metrics: ctx.metrics,
            dispatch,
          });
          if (!written) throw new Error("mesh not writable");
        } else {
          await updateAnnotationRef.current({
            id: annotationId,
            height: result.height,
            ...(result.offsetZ != null ? { offsetZ: result.offsetZ } : {}),
          });
        }
      } catch (err) {
        console.error("[threedExtrude] commit failed", err);
        releasePending(annotationId, { restore: true });
      }
    }

    // LINE: the axis the value runs along — the gizmo user axis closest to
    // the cursor while Shift is held (computeAxisLockSnap, as « Déplacer »),
    // the natural axis otherwise. Returns true when it changed.
    function updateArmedAxis(e) {
      if (armed.kind !== "LINE") return false;
      let axis = armed.naturalAxis;
      let axisKey = null;
      if (shiftHeld) {
        const rect = dom.getBoundingClientRect();
        if (rect.width && rect.height) {
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const yawDeg = store.getState().threedEditor.axesSettings?.yawDeg;
          const axes = getUserAxesWorldDirections(yawDeg);
          const lock = computeAxisLockSnap({
            mouseNdc: mouse,
            camera: sceneManager.camera,
            canvasSize: { width: rect.width, height: rect.height },
            origin: armed.anchor,
            axes,
            raycaster,
          });
          const locked = lock && axes.find((a) => a.key === lock.axis);
          if (locked) {
            axis = locked.dir;
            axisKey = locked.key;
          }
        }
      }
      if (axisKey === armed.axisKey && axis.equals(armed.axis)) return false;
      armed.axis = axis.clone();
      armed.axisKey = axisKey;
      return true;
    }

    // Armed: the value follows the cursor along the extrusion axis — unless
    // the user typed one, which wins until they hand control back.
    function updateArmedValue(e) {
      if (valueBufferRef.current !== "") {
        armed.snap = null;
        return;
      }
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

      // A scene vertex near the cursor wins: the face moves to its level.
      let requested;
      const vertex = findNearestVertexInVerts(
        armed.snapVerts,
        mouse,
        sceneManager.camera,
        { width: rect.width, height: rect.height },
        SNAP_THRESHOLD_PX
      );
      if (vertex) {
        requested = roundTenthMm(
          vertex.position.clone().sub(armed.anchor).dot(armed.axis)
        );
        armed.snap = { position: vertex.position, value: requested };
      } else {
        armed.snap = null;
        raycaster.setFromCamera(mouse, sceneManager.camera);
        const raw = getAxisDragValue({
          ray: raycaster.ray,
          anchor: armed.anchor,
          axis: armed.axis,
        });
        if (raw == null) return; // axis-aligned view: keep the last value
        requested = roundCm(raw);
      }

      const next = getAppliedValue(requested);
      if (next === valueRef.current) return;
      valueRef.current = next;
      dispatch(setExtrudeValue(next));
      rebuildGhost(next);
    }

    // Canvas position of the snapped vertex — only while the face really
    // sits on it (not when the value is held back by the material limit).
    function getSnapMarker(applied, rect) {
      const snap = armed.snap;
      if (!snap || Math.abs(applied - snap.value) > 1e-6) return null;
      const p = snap.position.clone().project(sceneManager.camera);
      return {
        x: ((p.x + 1) / 2) * rect.width,
        y: ((1 - p.y) / 2) * rect.height,
      };
    }

    function runHover() {
      rafId = null;
      const e = lastEvent;
      if (!e) return;

      if (armed) {
        // The axis may change without the value (Shift pressed while the
        // mouse is still): the ghost follows it anyway.
        const axisChanged = updateArmedAxis(e);
        const before = valueRef.current;
        updateArmedValue(e);
        if (axisChanged && valueRef.current === before) {
          rebuildGhost(valueRef.current);
        }
        const rect = dom.getBoundingClientRect();
        // A typed value beyond the mesh range is applied clamped — show what
        // will really be committed.
        const applied = getAppliedValue(valueRef.current || 0);
        const shown = roundCm(applied);
        setExtrudeOverlay({
          cursor: {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label: `${shown > 0 ? "+" : ""}${shown} m`,
          },
          snap: getSnapMarker(applied, rect),
          axis: armed.axisKey ?? null,
        });
        return;
      }

      const pick = pickScene(e);
      const kind = getPickKind(pick);

      if (kind) {
        if (kind === "LINE") applyLineHover(pick.annotationObject);
        else applyStipple(pick.hitObject, pick.intersect.faceIndex);
        setExtrudeOverlay({
          cursor: {
            x: e.clientX - pick.rect.left,
            y: e.clientY - pick.rect.top,
            label: kind === "LINE" ? "Extruder la ligne" : "Extruder",
          },
          snap: null,
          axis: null,
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
      shiftHeld = Boolean(e.shiftKey);
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
      const kind = getPickKind(pick);
      if (!kind) return;
      arm(e, pick, kind);
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
      if (e.key === "Shift") {
        if (!shiftHeld) {
          shiftHeld = true;
          scheduleHover();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape") {
        if (valueBufferRef.current !== "") dispatch(clearExtrudeValueBuffer());
        if (armed) cancelArm();
        else if (valueBufferRef.current === "")
          dispatch(setExtrudeModeActive(false));
        return;
      }
      if (e.key === "Enter") {
        if (armed) commit();
        return;
      }

      // Everything below is the typed-value buffer — leave real fields alone
      // (the toolbar field feeds the same buffer through onChangeText).
      if (isEditableTarget(e.target)) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        if (valueBufferRef.current === "") return;
        e.preventDefault();
        e.stopPropagation();
        dispatch(deleteLastExtrudeValueBuffer());
        return;
      }
      if (EXTRUDE_BUFFER_CHAR_RE.test(e.key)) {
        // A minus only makes sense as the first character (pull the face back
        // down); anywhere else it would just break parseFloat.
        if (e.key === "-" && valueBufferRef.current !== "") return;
        e.preventDefault();
        e.stopPropagation();
        dispatch(appendToExtrudeValueBuffer(e.key === "," ? "." : e.key));
      }
    }

    // The AnnotationsManager rebuilds an annotation object whenever its
    // resolved data, the build options or the base map metrics change.
    const unsubReady = annotationsManager?.subscribeAnnotationReady?.((ids) => {
      const objects = annotationsManager.annotationsObjectsMap;

      // Committed annotations: the rebuild made from NEW resolved data is the
      // write landing — the ghost hands over to the fresh object in this very
      // pass, before anything is drawn. Any other rebuild (same data) still
      // shows the previous geometry: keep it hidden behind the ghost.
      for (const id of ids) {
        const entry = pending.get(id);
        if (!entry) continue;
        if (annotationsManager.getAnnotationSource(id) !== entry.source) {
          releasePending(id);
        } else if (objects?.[id]) {
          entry.object = objects[id];
          deepHide(entry.object);
        }
      }

      // Armed annotation recreated while hidden (loadAnnotations re-fires on
      // any useAnnotationsV2 recompute): the fresh object is visible by
      // default and would overlay the ghost.
      if (!armed || !ids.includes(armed.annotationId)) return;
      const live = objects?.[armed.annotationId];
      if (!live) return;
      armed.object = live;
      armed.parent = live.parent || armed.parent;
      deepHide(live);
      rebuildGhost(valueRef.current);
    });

    // Shift released (or the window losing focus while it is held): the
    // LINE axis goes back to its natural direction at the same cursor.
    function onKeyUp(e) {
      if (e.key !== "Shift" || !shiftHeld) return;
      shiftHeld = false;
      scheduleHover();
    }

    function onWindowBlur() {
      if (!shiftHeld) return;
      shiftHeld = false;
      scheduleHover();
    }

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    // Capture phase: the typed digits / Backspace must reach the buffer before
    // the window-scoped shortcuts of the other features (delete annotation,
    // drawing-tool hotkeys) see them.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      disposed = true;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onWindowBlur);
      unsubReady?.();
      rebuildGhostRef.current = null;
      scheduleHoverRef.current = null;
      if (rafId != null) cancelAnimationFrame(rafId);
      cancelArm();
      for (const id of [...pending.keys()]) {
        releasePending(id, { restore: true });
      }
      clearStipple();
      clearExtrudeOverlay();
      dom.style.cursor = "";
    };
  }, [active, dispatch]);

  // Typed value → refresh the ghost and the cursor helper (no pointer move
  // needed). The mouse-driven path rebuilds them itself, so we only act while
  // the buffer holds something — plus the one tick where it is emptied, to
  // hand them back to the mouse value.
  const prevValueBufferRef = useRef(valueBuffer);
  useEffect(() => {
    const prev = prevValueBufferRef.current;
    prevValueBufferRef.current = valueBuffer;
    if (!active) return;
    if (valueBuffer === "" && prev === "") return;
    rebuildGhostRef.current?.(effectiveValue);
    scheduleHoverRef.current?.();
  }, [active, valueBuffer, effectiveValue]);
}
