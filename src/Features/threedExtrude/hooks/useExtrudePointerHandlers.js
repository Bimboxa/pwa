import { useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2, Vector3 } from "three";

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
import { MIN_THICKNESS_M } from "Features/annotationMesh3d/utils/mesh3dConstants";
import { mesh3dFromLocal } from "Features/annotationMesh3d/utils/mesh3dFrame";
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

    // Coplanar-face hover state.
    const hover = { overlay: null, key: null };

    const annotationsManager = sceneManager.annotationsManager;

    // Armed annotation (null until the first click):
    //   { kind, annotationId, axis, anchor, object, parent, ghost, downPos,
    //     tracking, snapVerts, snap,
    //     HEIGHT: snapshot, baseHeight, dig — MESH3D: ctx, faceIndex, range }
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
    // isMesh3d } — which push/pull kinds the annotation accepts.
    const eligibility = new Map();

    dom.style.cursor = "crosshair";

    function scheduleHover() {
      if (rafId == null && lastEvent) rafId = requestAnimationFrame(runHover);
    }
    scheduleHoverRef.current = scheduleHover;

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
        let result = { height: false, mesh: false, isMesh3d: false };
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

    // Which push/pull the face under the cursor gets: "HEIGHT", "MESH3D" or
    // null (not extrudable / eligibility still resolving).
    function getPickKind(pick) {
      if (!pick?.nodeId) return null;
      if (pending.has(pick.nodeId)) return null; // commit still landing
      const el = getEligibility(pick.nodeId);
      if (el === "PENDING") return null;
      if (pick.isMesh3dObject) return el.isMesh3d ? "MESH3D" : null;
      if (pick.isTopFace) return el.height ? "HEIGHT" : null;
      return el.mesh ? "MESH3D" : null;
    }

    // The value really applied for a requested one: a MESH3D face is limited
    // by the material behind it, unless it can go through.
    function getAppliedValue(v) {
      if (armed?.kind !== "MESH3D") return v;
      return resolvePushPullValue(v, armed.range).applied;
    }

    // What the armed annotation becomes for a value:
    //   { applied, ctx, mesh } — a face mesh (written by writeMesh3dService);
    //   { applied, height } — a regular annotation of that height.
    function resolveArmed(v) {
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
      const snapshot = {
        ...armed.snapshot,
        annotation: { ...armed.snapshot.annotation, height: result.height },
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

    async function arm(e, pick, kind) {
      if (arming || armed) return;
      arming = true;
      try {
        if (kind === "MESH3D") {
          await armMesh3d(e, pick);
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
      const unchanged = result.mesh
        ? result.mesh === result.ctx.mesh
        : kind === "HEIGHT" && result.height === baseHeight;

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
          });
        }
      } catch (err) {
        console.error("[threedExtrude] commit failed", err);
        releasePending(annotationId, { restore: true });
      }
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
        updateArmedValue(e);
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
        });
        return;
      }

      const pick = pickScene(e);
      const extrudable = getPickKind(pick) !== null;

      if (extrudable) {
        applyStipple(pick.hitObject, pick.intersect.faceIndex);
        setExtrudeOverlay({
          cursor: {
            x: e.clientX - pick.rect.left,
            y: e.clientY - pick.rect.top,
            label: "Extruder",
          },
          snap: null,
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

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerCancel);
    dom.addEventListener("pointerleave", onPointerLeave);
    // Capture phase: the typed digits / Backspace must reach the buffer before
    // the window-scoped shortcuts of the other features (delete annotation,
    // drawing-tool hotkeys) see them.
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      disposed = true;
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerCancel);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown, true);
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
