import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Box3, Object3D, Quaternion, Vector3 } from "three";

import db from "App/db/db";

import getBaseMapTransform, {
  BASE_MAP_ROTATION_ORDER,
  getBaseMapEuler,
} from "Features/baseMaps/js/getBaseMapTransform";
import BaseMap from "Features/baseMaps/js/BaseMap";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  clearSubSelection,
  setMoveDeltaZ,
  setMoveModeActive,
  setMoveSelectedAnnotationId,
  setMoveSubSelectionTarget,
} from "Features/threedEditor/threedEditorSlice";

import { Box, IconButton, Paper, Stack, TextField } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import findConnectedAnnotations from "../services/findConnectedAnnotations";
import {
  buildTransientFaceMesh,
  loadAnnotationSnapshot,
} from "../services/buildTransientFaceMesh";
import getAnnotationFaceNormal from "../utils/getAnnotationFaceNormal";
import roundForDisplay from "../utils/roundForDisplay";

const DEFAULT_Z = new Vector3(0, 0, 1);

// In sub-selection (vertex/edge) mode the user expects the constraint axis
// to be the BASEMAP normal — not the per-face normal. For a horizontal
// basemap the basemap-local Z axis (the normal) maps to world +Y.
function getBaseMapNormalWorld(annoObject) {
  // The annotation is a child of the basemap group, so the parent's world
  // quaternion encodes the basemap orientation.
  const parent = annoObject?.parent;
  if (!parent) return new Vector3(0, 1, 0);
  const q = parent.getWorldQuaternion(new Quaternion());
  return new Vector3(0, 0, 1).applyQuaternion(q).normalize();
}

// Recursively hide an Object3D and every descendant. Setting visible=false on
// the root is sufficient for rendering, but we also flip every child as a
// defensive measure in case some other code reads `.visible` per-mesh.
function deepHide(obj) {
  if (!obj) return;
  obj.visible = false;
  obj.traverse?.((child) => {
    child.visible = false;
  });
}

function deepShow(obj) {
  if (!obj) return;
  obj.visible = true;
  obj.traverse?.((child) => {
    child.visible = true;
  });
}

function getBaseMapInverseRotationQuat(baseMap) {
  const transform = getBaseMapTransform(baseMap);
  const tmp = new Object3D();
  const euler = getBaseMapEuler(transform);
  tmp.rotation.order = BASE_MAP_ROTATION_ORDER;
  tmp.rotation.set(euler.x, euler.y, euler.z);
  tmp.updateMatrixWorld(true);
  return tmp.quaternion.clone().invert();
}

function disposeMesh(obj) {
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

// Move-mode UI: gizmo + numeric field for the selected annotation.
// Translation is constrained to the face's own normal. During the drag:
//   - the moved annotation's own mesh is shifted imperatively (whole mesh
//     follows uniformly)
//   - each connected annotation's mesh is hidden and replaced by a
//     "transient" ghost that's regenerated per drag tick — only the
//     shared refs follow the delta, the other corners stay still
// On commit we persist the corresponding DB writes (shared db.points XY +
// per-annotation per-ref offsetTop for Z) and let the AnnotationsManager
// re-render normally. On cancel we just dispose the transients.
export default function MoveGizmoThreed() {
  const dispatch = useDispatch();
  const active = useSelector((s) => s.threedEditor.moveMode.active);
  const selectedAnnotationId = useSelector(
    (s) => s.threedEditor.moveMode.selectedAnnotationId
  );
  const deltaZ = useSelector((s) => s.threedEditor.moveMode.deltaZ);
  const subSelectionTarget = useSelector(
    (s) => s.threedEditor.moveMode.subSelectionTarget
  );
  // Stable identity inside the effect: a primitive key recomputed only when
  // the meaningful sub-selection target changes.
  const subTargetKey = subSelectionTarget
    ? `${subSelectionTarget.annotationId}|${subSelectionTarget.kind}|${(
        subSelectionTarget.pointIds || []
      ).join(",")}`
    : null;

  const [fieldValue, setFieldValue] = useState("0");

  // Gizmo bookkeeping.
  const targetRef = useRef(null);
  const initialPosRef = useRef(null);
  const faceNormalRef = useRef(null);
  const baseMapInvRotRef = useRef(null);

  // Moved annotation: imperative mesh shift bookkeeping.
  const movedMeshRef = useRef(null);
  const movedMeshInitialLocalPosRef = useRef(null);

  // Connected annotations bookkeeping. For each connected id we track:
  //   - originalMesh: the mesh AnnotationsManager rendered (hidden during drag)
  //   - snapshot: the data we use to rebuild the transient (annotation + db.points)
  //   - sharedIds: subset of refs of THIS annotation that are shared with the
  //     moved one (regen target uses these to know which refs to shift)
  //   - transientMesh: the current ghost (replaced per tick)
  //   - parent: the original mesh's parent (where we re-attach transients)
  const connectedRef = useRef(new Map());
  const movedSnapshotRef = useRef(null);
  const sharedPointIdsRef = useRef(new Set());
  // Sub-selection mode only: the moved annotation is itself rendered as a
  // transient so non-targeted vertices stay put. Tracks the moved
  // annotation's parent + current transient mesh + the sub-selected pointIds.
  const movedTransientRef = useRef(null);
  const subTargetPointIdsRef = useRef(new Set());
  // Mirror of `selectedAnnotationId` for use inside imperative callbacks
  // (regenTransients) without stale-closure risk.
  const selectedAnnotationIdRef = useRef(null);
  useEffect(() => {
    selectedAnnotationIdRef.current = selectedAnnotationId;
  }, [selectedAnnotationId]);

  // Throttle expensive transient regen to one rAF.
  const pendingFrameRef = useRef(null);
  const latestDeltaRef = useRef(0);

  useEffect(() => {
    if (!active || !selectedAnnotationId) return;
    // CRITICAL: reset the live-delta accumulator. This ref is NOT cleared by
    // setMoveDeltaZ(0) at commit time — it's local component state. If a
    // previous gizmo session ended at dn != 0, the next session's initial
    // transient build (in the async block below) would apply that stale
    // delta and the user would see a jump on the very first frame, before
    // the gizmo's first `update` callback resets it to 0.
    latestDeltaRef.current = 0;
    const editor = getActiveThreedEditor();
    const tcm = editor?.sceneManager?.transformControlsManager;
    const annotationsManager = editor?.sceneManager?.annotationsManager;
    const scene = editor?.sceneManager?.scene;
    if (!tcm || !annotationsManager || !scene) return;

    const annoObject =
      annotationsManager.annotationsObjectsMap?.[selectedAnnotationId];
    if (!annoObject) return;

    // Force-refresh the matrix chain so localToWorld + getWorldQuaternion
    // calls below see the current basemap-group transform (otherwise we can
    // pick up stale matrices from before the last render and place the
    // gizmo target far from the actual rendered geometry).
    annoObject.parent?.updateMatrixWorld?.(true);
    annoObject.updateMatrixWorld?.(true);

    // Centroid of the gizmo target. Default = annotation bbox center
    // (whole-face move). Sub-selection mode = centroid of the targeted
    // vertices (vertex/edge centroid).
    let centerWorld;
    if (subSelectionTarget?.pointIds?.length && annoObject.userData?.vertexRefs) {
      const refs = annoObject.userData.vertexRefs;
      const targetIdx = new Set();
      if (subSelectionTarget.vertexIndex != null) {
        targetIdx.add(subSelectionTarget.vertexIndex);
      }
      if (subSelectionTarget.vertexIndexB != null) {
        targetIdx.add(subSelectionTarget.vertexIndexB);
      }
      const accum = new Vector3();
      let count = 0;
      for (const i of targetIdx) {
        const ref = refs[i];
        if (!ref) continue;
        const local = new Vector3(ref.position.x, ref.position.y, ref.position.z);
        annoObject.localToWorld(local);
        accum.add(local);
        count++;
      }
      centerWorld =
        count > 0
          ? accum.multiplyScalar(1 / count)
          : (() => {
              const bbox = new Box3().setFromObject(annoObject);
              const c = new Vector3();
              bbox.getCenter(c);
              return c;
            })();
    } else {
      const bbox = new Box3().setFromObject(annoObject);
      centerWorld = new Vector3();
      bbox.getCenter(centerWorld);
    }

    // Constraint axis: in sub-selection (vertex/edge) mode use the basemap
    // normal (so "vertical" matches what the user sees as up regardless of
    // any per-vertex tilt the face may already have). In whole-face mode
    // keep the historical face-normal behaviour.
    const isSubSelectionMode = !!(
      subSelectionTarget && (subSelectionTarget.pointIds || []).length > 0
    );
    const constraintNormal = isSubSelectionMode
      ? getBaseMapNormalWorld(annoObject)
      : getAnnotationFaceNormal(annoObject) || new Vector3(0, 1, 0);
    faceNormalRef.current = constraintNormal;
    movedMeshRef.current = annoObject;
    movedMeshInitialLocalPosRef.current = annoObject.position.clone();

    // Sub-selection mode: commit the visual swap synchronously so there is
    // no race between the gizmo subscribe (which may fire on the very first
    // pointer-move) and the async db.get below. Hide the original mesh and
    // populate the targeted-pointIds ref now; the transient mesh itself is
    // built once the snapshot is loaded (still async, but the imperative
    // mesh.position shift is already short-circuited by subTargetPointIdsRef).
    const subPointIdsSync = new Set(
      (subSelectionTarget?.pointIds || []).filter(Boolean)
    );
    subTargetPointIdsRef.current = subPointIdsSync;
    if (subSelectionTarget && subPointIdsSync.size > 0) {
      deepHide(annoObject);
      // Placeholder so regenTransients knows the parent before the snapshot
      // arrives — even regen tick before the snapshot loads will be a no-op
      // for the moved transient and skip safely.
      movedTransientRef.current = {
        parent: annoObject.parent,
        transientMesh: null,
      };
      editor.sceneManager.renderScene?.();
    }

    const target = new Object3D();
    target.name = "MoveGizmoTarget";
    target.position.copy(centerWorld);
    target.quaternion.setFromUnitVectors(DEFAULT_Z, constraintNormal);
    scene.add(target);
    targetRef.current = target;
    initialPosRef.current = centerWorld.clone();

    tcm.attach(target);
    tcm.setMode("translate");
    tcm.setSpace("local");
    tcm.setShowAxes({ x: false, y: false, z: true });

    let cancelled = false;
    (async () => {
      const ann = await db.annotations.get(selectedAnnotationId);
      if (cancelled || !ann) return;

      const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
      const baseMap =
        baseMapRecord && (await BaseMap.createFromRecord(baseMapRecord));
      if (cancelled) return;
      if (baseMap) {
        baseMapInvRotRef.current = getBaseMapInverseRotationQuat(baseMap);
      }

      const { sharedPointIds, connectedAnnotations } =
        await findConnectedAnnotations(ann, selectedAnnotationId);
      if (cancelled) return;
      sharedPointIdsRef.current = sharedPointIds;

      // Snapshot the moved annotation (used at commit to read .offsetZ).
      movedSnapshotRef.current =
        await loadAnnotationSnapshot(selectedAnnotationId);
      if (cancelled) return;

      // Sub-selection mode: build the initial (delta=0) transient now that
      // the snapshot is loaded. The visibility swap + parent slot were set
      // up synchronously above, so any drag tick that fired in the meantime
      // is already short-circuiting the imperative mesh.position shift.
      const subPointIds = subTargetPointIdsRef.current;
      const slot = movedTransientRef.current;
      if (
        subSelectionTarget &&
        subPointIds.size > 0 &&
        slot &&
        slot.parent &&
        !slot.transientMesh &&
        movedSnapshotRef.current
      ) {
        // Apply any delta the user has already accumulated during the async
        // setup window so the very first transient mirrors the gizmo position.
        const dn = latestDeltaRef.current || 0;
        const n = faceNormalRef.current;
        const invRot = baseMapInvRotRef.current;
        const deltaLocal = { x: 0, y: 0, z: 0 };
        if (n && Math.abs(dn) > 1e-9) {
          const deltaWorld = n.clone().multiplyScalar(dn);
          const v = invRot
            ? deltaWorld.clone().applyQuaternion(invRot)
            : deltaWorld;
          deltaLocal.x = v.x;
          deltaLocal.y = v.y;
          deltaLocal.z = v.z;
        }
        const movedTransient = buildTransientFaceMesh({
          snapshot: movedSnapshotRef.current,
          sharedIds: subPointIds,
          deltaLocal,
          mode: "SHARED_ONLY",
        });
        if (movedTransient) {
          slot.parent.add(movedTransient);
          slot.transientMesh = movedTransient;
          // Defensive re-hide via LIVE lookup: AnnotationsManager may have
          // recreated the moved annotation during the async window above
          // (loadAnnotations re-fires on any useAnnotationsV2 recompute).
          // Re-fetch from the map so we hide the object actually in the scene.
          const liveNow =
            annotationsManager?.annotationsObjectsMap?.[selectedAnnotationId];
          if (liveNow) {
            deepHide(liveNow);
            movedMeshRef.current = liveNow;
          } else if (movedMeshRef.current) {
            deepHide(movedMeshRef.current);
          }
          editor.sceneManager.renderScene?.();
        }
      }

      // For each connected annotation: snapshot, hide original, create
      // initial (delta=0) transient.
      const connectedMap = new Map();
      for (const other of connectedAnnotations) {
        const snapshot = await loadAnnotationSnapshot(other.id);
        if (cancelled) return;
        if (!snapshot) continue;
        const originalMesh =
          annotationsManager.annotationsObjectsMap?.[other.id];
        const parent = originalMesh?.parent;
        if (!originalMesh || !parent) continue;
        // Restrict shared ids to the intersection of THIS annotation's refs
        // and the global shared set. In sub-selection mode, further restrict
        // to the targeted point ids so only the moved vertex/edge propagates
        // to neighbors (other shared corners stay put).
        const ownIds = new Set(
          (other.points || []).map((p) => p.id).filter(Boolean)
        );
        const localShared = new Set();
        for (const id of sharedPointIds) {
          if (!ownIds.has(id)) continue;
          if (subPointIds.size > 0 && !subPointIds.has(id)) continue;
          localShared.add(id);
        }
        if (localShared.size === 0) continue;

        deepHide(originalMesh);
        const transient = buildTransientFaceMesh({
          snapshot,
          sharedIds: localShared,
          deltaLocal: { x: 0, y: 0, z: 0 },
          mode: "SHARED_ONLY",
        });
        if (transient) {
          parent.add(transient);
        }
        connectedMap.set(other.id, {
          originalMesh,
          parent,
          snapshot,
          sharedIds: localShared,
          transientMesh: transient,
        });
      }
      connectedRef.current = connectedMap;
      editor.sceneManager.renderScene?.();
    })();

    const update = () => {
      const t = targetRef.current;
      const init = initialPosRef.current;
      const n = faceNormalRef.current;
      if (!t || !init || !n) return;
      const disp = t.position.clone().sub(init);
      const dn = disp.dot(n);
      latestDeltaRef.current = dn;
      dispatch(setMoveDeltaZ(dn));
      setFieldValue(String(roundForDisplay(dn)));
      shiftMovedMeshLive(dn);
      scheduleTransientRegen();
    };
    const unsub = tcm.subscribe(update);

    // If AnnotationsManager recreates an annotation mid-drag (loadAnnotations
    // re-fires from useAutoLoadAnnotationsInThreedEditor on any
    // useAnnotationsV2 recompute), the freshly-rebuilt object is visible by
    // default — overlaying our transient. Subscribe so we re-hide the moved
    // annotation as soon as it reappears, and bump the transient regen so
    // the deformation is reapplied to the new geometry.
    const unsubReady = annotationsManager.subscribeAnnotationReady?.((id) => {
      if (subTargetPointIdsRef.current.size === 0) return;
      if (id !== selectedAnnotationIdRef.current) return;
      const liveAnno =
        annotationsManager.annotationsObjectsMap?.[
          selectedAnnotationIdRef.current
        ];
      if (liveAnno) {
        deepHide(liveAnno);
        movedMeshRef.current = liveAnno;
        // The slot's parent reference may also be stale after a recreate.
        if (movedTransientRef.current) {
          movedTransientRef.current.parent = liveAnno.parent || movedTransientRef.current.parent;
        }
        scheduleTransientRegen();
        editor.sceneManager.renderScene?.();
      }
    });

    return () => {
      cancelled = true;
      unsub();
      unsubReady?.();
      tcm.detach();
      if (target.parent) target.parent.remove(target);

      // Restore moved mesh: position (in whole-face mode) and visibility
      // (in sub-selection mode, where it was hidden in favor of a transient).
      const mesh = movedMeshRef.current;
      const initLocal = movedMeshInitialLocalPosRef.current;
      if (mesh && initLocal) {
        mesh.position.copy(initLocal);
      }
      if (movedTransientRef.current) {
        const { parent, transientMesh } = movedTransientRef.current;
        if (transientMesh && parent) {
          parent.remove(transientMesh);
          disposeMesh(transientMesh);
        }
        movedTransientRef.current = null;
      }
      if (mesh) deepShow(mesh);
      // Dispose transients + restore connected originals.
      for (const entry of connectedRef.current.values()) {
        if (entry.transientMesh && entry.parent) {
          entry.parent.remove(entry.transientMesh);
          disposeMesh(entry.transientMesh);
        }
        if (entry.originalMesh) deepShow(entry.originalMesh);
      }
      if (pendingFrameRef.current != null) {
        cancelAnimationFrame(pendingFrameRef.current);
        pendingFrameRef.current = null;
      }
      editor.sceneManager.renderScene?.();

      targetRef.current = null;
      initialPosRef.current = null;
      faceNormalRef.current = null;
      baseMapInvRotRef.current = null;
      movedMeshRef.current = null;
      movedMeshInitialLocalPosRef.current = null;
      movedSnapshotRef.current = null;
      sharedPointIdsRef.current = new Set();
      connectedRef.current = new Map();
      subTargetPointIdsRef.current = new Set();
    };
  }, [active, selectedAnnotationId, dispatch, subTargetKey]);

  useEffect(() => {
    setFieldValue(String(roundForDisplay(deltaZ)));
  }, [deltaZ]);

  function shiftMovedMeshLive(dn) {
    // In sub-selection mode the moved annotation is rendered via a transient
    // mesh (regenerated per tick) — globally translating the original mesh
    // would make the entire face move instead of only the targeted vertices.
    if (subTargetPointIdsRef.current.size > 0) return;
    const mesh = movedMeshRef.current;
    const initLocal = movedMeshInitialLocalPosRef.current;
    const n = faceNormalRef.current;
    const invRot = baseMapInvRotRef.current;
    if (!mesh || !initLocal || !n) return;
    const deltaWorld = n.clone().multiplyScalar(dn);
    const deltaLocal = invRot
      ? deltaWorld.clone().applyQuaternion(invRot)
      : deltaWorld;
    mesh.position.copy(initLocal).add(deltaLocal);
    getActiveThreedEditor()?.sceneManager?.renderScene?.();
  }

  // Regenerate the transient ghost meshes for connected annotations on the
  // next animation frame, using the latest delta.
  function scheduleTransientRegen() {
    if (pendingFrameRef.current != null) return;
    pendingFrameRef.current = requestAnimationFrame(() => {
      pendingFrameRef.current = null;
      regenTransients(latestDeltaRef.current);
    });
  }

  function regenTransients(dn) {
    const editor = getActiveThreedEditor();
    const n = faceNormalRef.current;
    const invRot = baseMapInvRotRef.current;
    const map = connectedRef.current;
    const subPointIds = subTargetPointIdsRef.current;
    const movedTransient = movedTransientRef.current;
    if (!n) return;
    const deltaWorld = n.clone().multiplyScalar(dn);
    const deltaLocalVec = invRot
      ? deltaWorld.clone().applyQuaternion(invRot)
      : deltaWorld;
    const deltaLocal = {
      x: deltaLocalVec.x,
      y: deltaLocalVec.y,
      z: deltaLocalVec.z,
    };
    // Sub-selection mode: regenerate the moved annotation transient too —
    // the original mesh is hidden, so the transient is the only visual.
    if (movedTransient && subPointIds.size > 0 && movedSnapshotRef.current) {
      if (movedTransient.transientMesh && movedTransient.parent) {
        movedTransient.parent.remove(movedTransient.transientMesh);
        disposeMesh(movedTransient.transientMesh);
        movedTransient.transientMesh = null;
      }
      const freshMoved = buildTransientFaceMesh({
        snapshot: movedSnapshotRef.current,
        sharedIds: subPointIds,
        deltaLocal,
        mode: "SHARED_ONLY",
      });
      if (freshMoved && movedTransient.parent) {
        movedTransient.parent.add(freshMoved);
        movedTransient.transientMesh = freshMoved;
      }
      // Re-assert the original-mesh hide on every regen tick. CRITICAL:
      // `useAutoLoadAnnotationsInThreedEditor` may re-fire `loadAnnotations`
      // mid-drag (e.g. on any `useAnnotationsV2` recompute), which calls
      // `deleteAllAnnotationsObjects` + recreate. The fresh annoObject is
      // visible by default and our captured `movedMeshRef.current` becomes
      // an orphan. Look up the LIVE entry from the map every tick so the
      // hide always targets the object actually in the scene.
      const liveAnno =
        editor?.sceneManager?.annotationsManager?.annotationsObjectsMap?.[
          selectedAnnotationIdRef.current
        ];
      if (liveAnno) {
        deepHide(liveAnno);
        if (liveAnno !== movedMeshRef.current) {
          movedMeshRef.current = liveAnno;
        }
      }
    }
    for (const entry of map.values()) {
      if (entry.transientMesh && entry.parent) {
        entry.parent.remove(entry.transientMesh);
        disposeMesh(entry.transientMesh);
        entry.transientMesh = null;
      }
      const fresh = buildTransientFaceMesh({
        snapshot: entry.snapshot,
        sharedIds: entry.sharedIds,
        deltaLocal,
        mode: "SHARED_ONLY",
      });
      if (fresh && entry.parent) {
        entry.parent.add(fresh);
        entry.transientMesh = fresh;
      }
    }
    editor?.sceneManager?.renderScene?.();
  }

  async function handleApply() {
    if (!selectedAnnotationId) return;
    const dn = Number(fieldValue);
    if (!Number.isFinite(dn) || Math.abs(dn) < 1e-6) {
      // Nothing to write — exit cleanly so the user is back to selection mode.
      dispatch(setMoveSelectedAnnotationId(null));
      dispatch(setMoveDeltaZ(0));
      dispatch(setMoveSubSelectionTarget(null));
      dispatch(setMoveModeActive(false));
      return;
    }
    const ann = await db.annotations.get(selectedAnnotationId);
    if (!ann) return;
    const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
    if (!baseMapRecord) return;
    const baseMap = await BaseMap.createFromRecord(baseMapRecord);
    if (!baseMap) return;

    const imageSize = baseMap.getImageSize();
    const meterByPx = baseMap.getMeterByPx();
    if (!imageSize?.width || !imageSize?.height || !meterByPx) return;

    const n = faceNormalRef.current || new Vector3(0, 1, 0);
    const deltaWorld = n.clone().multiplyScalar(dn);
    const invRot = getBaseMapInverseRotationQuat(baseMap);
    const deltaLocal = deltaWorld.clone().applyQuaternion(invRot);

    const dxNorm = deltaLocal.x / (meterByPx * imageSize.width);
    const dyNorm = -deltaLocal.y / (meterByPx * imageSize.height);
    const dz = deltaLocal.z;

    const ownPointIds = (ann.points || []).map((p) => p.id).filter(Boolean);
    const ownPointIdSet = new Set(ownPointIds);
    const sharedIds = sharedPointIdsRef.current;
    const connectedMap = connectedRef.current;
    const subPointIds = subTargetPointIdsRef.current;
    const isSubMode = subPointIds && subPointIds.size > 0;

    await db.transaction("rw", db.points, db.annotations, async () => {
      if (isSubMode) {
        // Sub-selection mode: vertical-only delta on the targeted vertices.
        // Write per-vertex offsetTop on the moved annotation; do not touch
        // db.points (XY) or annotation.offsetZ.
        const newOwnPoints = (ann.points || []).map((ref) => {
          if (subPointIds.has(ref.id)) {
            return {
              ...ref,
              offsetTop: roundForDisplay((ref.offsetTop ?? 0) + dz),
            };
          }
          return ref;
        });
        await db.annotations.update(selectedAnnotationId, {
          points: newOwnPoints,
        });
      } else {
        // 1. Shared db.points get their (x, y) shifted in baseMap-local — both
        //    the moved annotation and every connected annotation see it.
        for (const pid of ownPointIds) {
          const pt = await db.points.get(pid);
          if (!pt) continue;
          await db.points.update(pid, {
            x: pt.x + dxNorm,
            y: pt.y + dyNorm,
          });
        }

        // 2. Z absorbed by the moved annotation's offsetZ.
        const nextOffsetZ = roundForDisplay((ann.offsetZ ?? 0) + dz);
        await db.annotations.update(selectedAnnotationId, {
          offsetZ: nextOffsetZ,
        });
      }

      // 3. For each connected annotation: bump per-vertex offsetTop on
      //    SHARED refs only by `dz` so the shared corners follow the move
      //    while the others stay put. In sub-selection mode the propagation
      //    is further restricted to the targeted point ids.
      for (const [otherId, entry] of connectedMap.entries()) {
        const other = await db.annotations.get(otherId);
        if (!other) continue;
        let touched = false;
        const newPoints = (other.points || []).map((ref) => {
          if (
            ownPointIdSet.has(ref.id) &&
            entry.sharedIds.has(ref.id) &&
            (sharedIds.size === 0 || sharedIds.has(ref.id)) &&
            (!isSubMode || subPointIds.has(ref.id))
          ) {
            touched = true;
            return {
              ...ref,
              offsetTop: roundForDisplay((ref.offsetTop ?? 0) + dz),
            };
          }
          return ref;
        });
        if (touched) {
          await db.annotations.update(otherId, { points: newPoints });
        }
      }
    });

    // Auto-exit move mode after commit — the new UX is: select → Déplacer
    // → drag → validate → back to selection state.
    dispatch(setMoveSelectedAnnotationId(null));
    dispatch(setMoveDeltaZ(0));
    dispatch(setMoveSubSelectionTarget(null));
    dispatch(clearSubSelection());
    dispatch(setMoveModeActive(false));
  }

  function handleCancel() {
    dispatch(setMoveSelectedAnnotationId(null));
    dispatch(setMoveDeltaZ(0));
    dispatch(setMoveSubSelectionTarget(null));
    dispatch(setMoveModeActive(false));
  }

  function handleFieldChange(e) {
    setFieldValue(e.target.value);
    const v = Number(e.target.value);
    if (Number.isFinite(v)) {
      dispatch(setMoveDeltaZ(v));
      latestDeltaRef.current = v;
      const t = targetRef.current;
      const init = initialPosRef.current;
      const n = faceNormalRef.current;
      if (t && init && n) {
        t.position.copy(init).add(n.clone().multiplyScalar(v));
      }
      shiftMovedMeshLive(v);
      scheduleTransientRegen();
    }
  }

  if (!active) return null;

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1.5,
        py: 1,
        borderRadius: "10px",
        zIndex: 11,
        minWidth: 280,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {subSelectionTarget && (
          <Box sx={{ fontSize: 12, color: "text.secondary" }}>
            {subSelectionTarget.kind === "VERTEX"
              ? `Vertex N°${(subSelectionTarget.vertexIndex ?? 0) + 1}`
              : `Arête N°${(subSelectionTarget.vertexIndex ?? 0) + 1}-${
                  (subSelectionTarget.vertexIndexB ?? 0) + 1
                }`}
          </Box>
        )}
        <Box sx={{ fontSize: 12, color: "text.secondary" }}>
          {subSelectionTarget ? "Δz (m)" : "Δn (m)"}
        </Box>
        <TextField
          size="small"
          value={fieldValue}
          onChange={handleFieldChange}
          type="number"
          sx={{ width: 110 }}
          inputProps={{ step: 0.01 }}
        />
        <IconButton size="small" color="primary" onClick={handleApply}>
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleCancel}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}
