import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { Box3, Object3D, Vector3 } from "three";

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

import {
  buildTransientFaceMesh,
  loadAnnotationSnapshot,
} from "../services/buildTransientFaceMesh";
import getAnnotationFaceNormal from "../utils/getAnnotationFaceNormal";
import getBaseMapNormalWorld from "../utils/getBaseMapNormalWorld";
import { deepHide, deepShow } from "../utils/deepVisibility";
import roundForDisplay from "../utils/roundForDisplay";
import { buildIndex } from "../hooks/useVertexSnap";
import {
  getPolygonEdgeSlopePct,
  deltaZForTargetSlope,
} from "Features/annotations/utils/getPolygonEdgeSlopePct";
import classifyPolylineCornerVsPolygonZ from "Features/annotations/utils/classifyPolylineCornerVsPolygonZ";
import splitPolylineAtSpanInversions from "Features/annotations/utils/splitPolylineAtSpanInversions";
import stripSlidingFromAnnotation from "Features/annotations/utils/stripSlidingFromAnnotation";
import getPolygonZPlane, {
  getZAtXY,
} from "Features/annotations/utils/getPolygonZPlane";
import getRampRailChains from "Features/annotations/utils/getRampRailChains";
import buildRampLayout from "Features/annotations/utils/buildRampLayout";
import rampOffsetTopByPointId from "Features/annotations/utils/rampOffsetTopByPointId";
import getGuideLineAxis from "Features/annotations/utils/getGuideLineAxis";
import { nanoid } from "@reduxjs/toolkit";

const DEFAULT_Z = new Vector3(0, 0, 1);

// Vertical-snap helper: same magenta circle as the drawing snap
// (DrawingOverlayThreed COLOR_VERTEX). Detection is mouse-driven: one helper,
// on the existing vertex closest to the cursor. When the cursor is within
// SNAP_PX of it ("inside"), the helper fills in and that vertex becomes the
// snap target — its elevation is applied on gizmo release.
const SNAP_PX = 12;
const SNAP_COLOR = "#ff2d8d";
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

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

// Resolves the polygon vertices to pixel coords + offsetTop and computes the
// current slope-%, the moved-edge baseline z, and the basemap meterByPx for
// the slope-input mode. Returns null when the mode does not apply (non-edge
// sub-selection, non-POLYGON, missing basemap data, degenerate geometry).
function computeSlopeModeSetup(snapshot, subSelectionTarget) {
  if (!snapshot) return null;
  if (!subSelectionTarget || subSelectionTarget.kind !== "EDGE") return null;
  const annRec = snapshot.annotation;
  if (!annRec || annRec.type !== "POLYGON") return null;
  const { pointsById, baseMapForRender } = snapshot;
  const meterByPx = baseMapForRender?.meterByPx;
  const imageWidth = baseMapForRender?.imageWidth;
  const imageHeight = baseMapForRender?.imageHeight;
  if (
    !Number.isFinite(meterByPx) ||
    meterByPx <= 0 ||
    !imageWidth ||
    !imageHeight
  ) {
    return null;
  }
  const resolved = [];
  for (const ref of annRec.points || []) {
    const norm = pointsById.get(ref.id);
    if (!norm) continue;
    resolved.push({
      id: ref.id,
      x: norm.x * imageWidth,
      y: norm.y * imageHeight,
      offsetTop: ref.offsetTop ?? 0,
    });
  }
  const edgeIds = (subSelectionTarget.pointIds || []).filter(Boolean);
  const initialSlopePct = getPolygonEdgeSlopePct({
    points: resolved,
    edgePointIds: edgeIds,
    meterByPx,
  });
  if (initialSlopePct == null) return null;
  const edgeIdSet = new Set(edgeIds);
  let zSum = 0;
  let zN = 0;
  for (const p of resolved) {
    if (edgeIdSet.has(p.id)) {
      zSum += p.offsetTop;
      zN += 1;
    }
  }
  const currentEdgeZ = zN > 0 ? zSum / zN : 0;
  return { resolved, edgeIds, currentEdgeZ, meterByPx, initialSlopePct };
}

// Move-mode UI: gizmo + numeric field for the selected annotation.
// Translation is constrained to the face's own normal. During the drag:
//   - the moved annotation's own mesh is hidden and replaced by a
//     "transient" ghost regenerated per drag tick — mode WHOLE in
//     whole-face mode (the whole shape follows the delta), mode
//     SHARED_ONLY in sub-selection mode (only targeted vertices follow)
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
  // Slope-% mode: parallel input shown when the moved sub-selection is an
  // edge of a POLYGON face with ≥1 fixed vertex and a non-degenerate
  // direction from the fixed centroid to the moved edge midpoint.
  const [slopePctValue, setSlopePctValue] = useState("");
  const [slopeModeApplies, setSlopeModeApplies] = useState(false);

  // Slope-mode bookkeeping captured on enter (stable across drag).
  // Snapshot of the polygon's vertices in pixel coords + their offsetTop at
  // entry time; the moved-edge ids; the moved-edge baseline z; the basemap's
  // meterByPx. Together they let us convert Δz <-> slope% without re-reading
  // the DB while the live preview is running.
  const slopePointsSnapshotRef = useRef(null);
  const slopeEdgePointIdsRef = useRef(null);
  const slopeCurrentEdgeZRef = useRef(0);
  const slopeMeterByPxRef = useRef(0);

  // Ramp-mode bookkeeping. When the moved annotation is a POLYGON with an
  // isoHeight segment, the whole face is reshaped as a constant-slope ramp
  // between the iso edge (constant z) and the moved edge. Layout (rail chains,
  // inserted points, per-point t) is delta-independent and captured on enter;
  // only the moved height scales with the live delta.
  const rampAppliesRef = useRef(false);
  const rampLayoutRef = useRef(null);
  const rampSnapshotRef = useRef(null);
  const rampSnapshotOffsetTopByIdRef = useRef(null);
  const rampIsoZRef = useRef(0);
  const rampMovedBaseZRef = useRef(0);
  const rampIsoPointsPxRef = useRef(null);
  const rampMovedMidPxRef = useRef(null);
  const rampMeterByPxRef = useRef(0);
  // guideLine mode (takes precedence over the iso-segment ramp): the drawn
  // guideLine is the gradient axis; every vertex's height = linear function
  // of its projection s onto the guideLine. `guideLineSpanPxRef` is the
  // signed pixel distance (s_moved − s_ref) used for the slope ↔ Δz mapping.
  const guideLineModeRef = useRef(false);
  const guideLineSpanPxRef = useRef(0);

  // Gizmo bookkeeping.
  const targetRef = useRef(null);
  const initialPosRef = useRef(null);
  const faceNormalRef = useRef(null);
  const baseMapInvRotRef = useRef(null);
  // Offset the annotation already had when the move started. The field shows
  // the ABSOLUTE resulting offset (base + live delta), not the relative move.
  const baseOffsetRef = useRef(0);

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

  // Vertical snap: all snappable world-space scene vertices captured once at
  // drag start (other annotations don't move during the drag) and the
  // current commit target (closest vertex inside the COMMIT zone — snapped
  // on release).
  const candidateVertsRef = useRef([]);
  const filledSnapRef = useRef(null);
  // Latest cursor position in canvas-relative px — drives which vertex the
  // single helper sticks to and whether it is "inside" (snapped).
  const mouseClientRef = useRef(null);
  // Whole-face only: the annotation's base-plane level (along the drag axis)
  // at drag start with offsetTop/Bottom = 0. The live reference is this +
  // delta. Null in segment mode (there the moving segment centroid is used).
  const baseRefLevelRef = useRef(null);
  const [snapMarkers, setSnapMarkers] = useState([]);

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
    if (
      subSelectionTarget?.pointIds?.length &&
      annoObject.userData?.vertexRefs
    ) {
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
        const local = new Vector3(
          ref.position.x,
          ref.position.y,
          ref.position.z
        );
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

    // Commit the visual swap synchronously so there is no race between the
    // gizmo subscribe (which may fire on the very first pointer-move) and
    // the async db.get below. The moved annotation is rendered via a
    // transient ghost in BOTH modes (sub-selection: SHARED_ONLY;
    // whole-face: WHOLE) so the move stays robust to mid-drag
    // AnnotationsManager recreation — the old imperative mesh.position path
    // orphaned the moved mesh in whole-face mode.
    const subPointIdsSync = new Set(
      (subSelectionTarget?.pointIds || []).filter(Boolean)
    );
    subTargetPointIdsRef.current = subPointIdsSync;
    deepHide(annoObject);
    // Placeholder so regenTransients knows the parent before the snapshot
    // arrives — any regen tick before the snapshot loads is a safe no-op.
    movedTransientRef.current = {
      parent: annoObject.parent,
      transientMesh: null,
    };
    editor.sceneManager.renderScene?.();

    // Candidate vertices for the vertical snap. Built AFTER deepHide so the
    // moved annotation (now invisible) is excluded by buildIndex's
    // visibility filter — you can't snap a thing onto itself. Same source as
    // the drawing snap, so both behave identically.
    candidateVertsRef.current = buildIndex(scene).verts || [];

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

      // Capture the offset the annotation already has so the field can
      // display the absolute resulting offset (base + live delta).
      const subIdsForBase = subTargetPointIdsRef.current;
      if (subIdsForBase && subIdsForBase.size > 0) {
        let s = 0;
        let nb = 0;
        for (const ref of ann.points || []) {
          if (subIdsForBase.has(ref.id) && !ref.isSliding) {
            s += ref.offsetTop ?? 0;
            nb += 1;
          }
        }
        baseOffsetRef.current = nb > 0 ? s / nb : 0;
      } else {
        baseOffsetRef.current = ann.offsetZ ?? 0;
      }

      // Whole-face snap reference = the annotation's base plane at the
      // current offset (offsetTop/Bottom = 0), NOT the bbox centroid. The
      // base plane translates rigidly with the drag, so the live reference
      // is this start level + delta. Segment mode tracks the moving segment
      // centroid instead (the gizmo target) — handled in recompute.
      if (subIdsForBase && subIdsForBase.size > 0) {
        baseRefLevelRef.current = null;
      } else if (faceNormalRef.current && initialPosRef.current) {
        annoObject.updateMatrixWorld?.(true);
        const lc = annoObject.worldToLocal(initialPosRef.current.clone());
        lc.z = baseOffsetRef.current;
        const baseWorld = annoObject.localToWorld(lc);
        baseRefLevelRef.current = baseWorld.dot(faceNormalRef.current);
      }
      // A drag tick may already have accumulated a delta during this async
      // window — reflect the absolute value immediately.
      setFieldValue(
        String(
          roundForDisplay(baseOffsetRef.current + (latestDeltaRef.current || 0))
        )
      );

      const baseMapRecord = await db.baseMaps.get(ann.baseMapId);
      const baseMap =
        baseMapRecord && (await BaseMap.createFromRecord(baseMapRecord));
      if (cancelled) return;
      if (baseMap) {
        baseMapInvRotRef.current = getBaseMapInverseRotationQuat(baseMap);
      }

      // Adjacent annotations are intentionally NOT modified by a gizmo
      // move. They will only follow once they are explicitly "constrained"
      // (a prop introduced later). Until then, skip connected-annotation
      // discovery entirely so the commit mutates ONLY the selected
      // annotation. The transient/commit propagation machinery below is
      // kept (it iterates an empty connected set) so it can be re-enabled
      // once the "constrained" prop exists.
      const connectedAnnotations = [];
      const sharedPointIds = new Set();
      sharedPointIdsRef.current = sharedPointIds;

      // Snapshot the moved annotation (used at commit to read .offsetZ).
      movedSnapshotRef.current =
        await loadAnnotationSnapshot(selectedAnnotationId);
      if (cancelled) return;

      // Slope-% mode setup. Applies only when:
      //   - we're in edge sub-selection
      //   - the moved annotation is a POLYGON
      //   - the (current) polygon vertices yield a finite slope value (i.e.
      //     ≥1 fixed vertex AND non-zero horizontal distance from the fixed
      //     centroid to the moved edge midpoint).
      const slopeSetup = computeSlopeModeSetup(
        movedSnapshotRef.current,
        subSelectionTarget
      );
      if (slopeSetup) {
        slopePointsSnapshotRef.current = slopeSetup.resolved;
        slopeEdgePointIdsRef.current = slopeSetup.edgeIds;
        slopeCurrentEdgeZRef.current = slopeSetup.currentEdgeZ;
        slopeMeterByPxRef.current = slopeSetup.meterByPx;
        setSlopePctValue(String(roundForDisplay(slopeSetup.initialSlopePct)));
        setSlopeModeApplies(true);
      } else {
        slopePointsSnapshotRef.current = null;
        slopeEdgePointIdsRef.current = null;
        setSlopeModeApplies(false);
      }

      // guideLine mode (takes precedence over the iso-segment ramp): a drawn
      // guideLine is the gradient axis. Each polygon vertex's height is a
      // linear function of its projection s onto the guideLine, anchored at
      // the moved edge (z = baseZ + dn) and at the guideLine extremity
      // farthest from it (kept at its current fitted height). iso-height
      // contours are then automatically the constant-s loci.
      guideLineModeRef.current = false;
      rampAppliesRef.current = false;
      rampLayoutRef.current = null;
      rampSnapshotRef.current = null;
      try {
        const snap = movedSnapshotRef.current;
        const rawGuide = ann.guideLine || [];
        if (
          ann.type === "POLYGON" &&
          subSelectionTarget?.kind === "EDGE" &&
          rawGuide.length >= 2 &&
          slopeSetup &&
          Array.isArray(slopeSetup.resolved) &&
          slopeSetup.resolved.length >= 3
        ) {
          const ring = slopeSetup.resolved;
          const mbpx = slopeSetup.meterByPx ?? 0;
          const imgW = snap.baseMapForRender.imageWidth || 1;
          const imgH = snap.baseMapForRender.imageHeight || 1;
          const guideDbPts = await db.points.bulkGet(
            rawGuide.map((g) => g.pointId)
          );
          if (cancelled) return;
          const guidePts = [];
          rawGuide.forEach((g, i) => {
            const p = guideDbPts[i];
            if (p)
              guidePts.push({
                x: p.x * imgW,
                y: p.y * imgH,
                type: g?.type ?? "square",
              });
          });
          const axis =
            guidePts.length >= 2
              ? getGuideLineAxis({ guidePts, polygonPts: ring })
              : null;
          const movedIds = (subSelectionTarget.pointIds || []).filter(Boolean);
          if (axis && mbpx > 0 && movedIds.length === 2) {
            const { sById, L2D } = axis;
            const sMovedVals = movedIds
              .map((id) => sById.get(id))
              .filter((v) => Number.isFinite(v));
            if (sMovedVals.length > 0) {
              const sMoved =
                sMovedVals.reduce((a, b) => a + b, 0) / sMovedVals.length;
              // Fixed reference = guideLine extremity farthest from the moved
              // edge's projection.
              const sRef =
                Math.abs(0 - sMoved) >= Math.abs(L2D - sMoved) ? 0 : L2D;
              const span = sMoved - sRef;
              if (Math.abs(span) > 1e-6) {
                // Least-squares line offsetTop = α·s + β over the ring, so the
                // far end keeps its current fitted height (0 for a flat face).
                let n = 0;
                let sumS = 0;
                let sumZ = 0;
                let sumSS = 0;
                let sumSZ = 0;
                for (const v of ring) {
                  const s = sById.get(v.id);
                  if (!Number.isFinite(s)) continue;
                  const z = v.offsetTop ?? 0;
                  n += 1;
                  sumS += s;
                  sumZ += z;
                  sumSS += s * s;
                  sumSZ += s * z;
                }
                const det = n * sumSS - sumS * sumS;
                let alpha = 0;
                let beta = 0;
                if (Math.abs(det) > 1e-9) {
                  alpha = (n * sumSZ - sumS * sumZ) / det;
                  beta = (sumZ - alpha * sumS) / n;
                }
                const zRef = alpha * sRef + beta;

                const tById = new Map();
                for (const v of ring) {
                  const s = sById.get(v.id);
                  if (!Number.isFinite(s)) continue;
                  tById.set(v.id, (s - sRef) / span);
                }

                rampSnapshotRef.current = snap;
                rampSnapshotOffsetTopByIdRef.current = new Map(
                  (snap.annotation.points || []).map((r) => [
                    r.id,
                    r.offsetTop ?? 0,
                  ])
                );
                rampLayoutRef.current = { tById, insertedPoints: [] };
                rampIsoZRef.current = zRef;
                rampMovedBaseZRef.current = slopeSetup.currentEdgeZ ?? 0;
                rampMeterByPxRef.current = mbpx;
                guideLineSpanPxRef.current = span;
                guideLineModeRef.current = true;
                rampAppliesRef.current = true;
                setSlopeModeApplies(true);
                // Initial slope %: 100·|m|/√(1+m²), m = Δz / horizontalRun.
                const horiz = span * mbpx;
                const m0 =
                  ((rampMovedBaseZRef.current || 0) - zRef) / horiz;
                if (Number.isFinite(m0)) {
                  setSlopePctValue(
                    String(
                      roundForDisplay(
                        (100 * m0) / Math.sqrt(1 + m0 * m0)
                      )
                    )
                  );
                }
              }
            }
          }
        }
      } catch (e) {
        guideLineModeRef.current = false;
        rampAppliesRef.current = false;
      }

      // Ramp mode: POLYGON edge move + ≥1 isoHeight segment ⇒ reshape the
      // whole face as a constant-slope ramp between the moved edge and the
      // iso edge (the contour line that stays at constant height). Fallback
      // only — skipped when a guideLine already drives the ramp.
      if (!guideLineModeRef.current) {
      rampAppliesRef.current = false;
      rampLayoutRef.current = null;
      rampSnapshotRef.current = null;
      try {
        const snap = movedSnapshotRef.current;
        const isoIdxList = ann.isoHeightSegmentsIdx || [];
        if (
          ann.type === "POLYGON" &&
          subSelectionTarget?.kind === "EDGE" &&
          isoIdxList.length > 0 &&
          slopeSetup &&
          Array.isArray(slopeSetup.resolved) &&
          slopeSetup.resolved.length >= 4
        ) {
          // Stripped ring in pixel coords + offsetTop, annotation.points order.
          const ring = slopeSetup.resolved;
          const N = ring.length;
          const idToRingIdx = new Map(ring.map((p, i) => [p.id, i]));

          const movedIds = (subSelectionTarget.pointIds || []).filter(Boolean);
          let movedSegIdx = -1;
          if (movedIds.length === 2) {
            for (let i = 0; i < N; i++) {
              const a = ring[i].id;
              const b = ring[(i + 1) % N].id;
              if (
                (a === movedIds[0] && b === movedIds[1]) ||
                (a === movedIds[1] && b === movedIds[0])
              ) {
                movedSegIdx = i;
                break;
              }
            }
          }
          // Map the first raw iso segment into stripped-ring space via its
          // start point id (robust to sliding-ref stripping).
          const rawIsoIdx = isoIdxList[0];
          const rawIsoStartId = ann.points?.[rawIsoIdx]?.id;
          const isoSegIdx =
            rawIsoStartId != null && idToRingIdx.has(rawIsoStartId)
              ? idToRingIdx.get(rawIsoStartId)
              : -1;

          if (movedSegIdx >= 0 && isoSegIdx >= 0) {
            const chains = getRampRailChains({ ring, isoSegIdx, movedSegIdx });
            const arcPointIds = new Set(
              (snap.annotation.points || [])
                .filter((r) => r?.type === "circle")
                .map((r) => r.id)
            );
            const layout = chains
              ? buildRampLayout({
                  ring,
                  chains,
                  idFactory: () => nanoid(),
                  arcPointIds,
                })
              : null;
            if (chains && layout) {
              const offsetTopById = new Map(
                ring.map((p) => [p.id, p.offsetTop ?? 0])
              );
              const zIso =
                ((offsetTopById.get(chains.isoIds[0]) ?? 0) +
                  (offsetTopById.get(chains.isoIds[1]) ?? 0)) /
                2;

              const origRefById = new Map(
                (snap.annotation.points || []).map((r) => [r.id, r])
              );
              const augPoints = layout.augmentedRing.map((v) => {
                const orig = origRefById.get(v.id);
                if (orig) return { ...orig };
                return { id: v.id, offsetTop: 0, offsetBottom: 0 };
              });
              const imgW = snap.baseMapForRender.imageWidth || 1;
              const imgH = snap.baseMapForRender.imageHeight || 1;
              const augPointsById = new Map(snap.pointsById);
              for (const ip of layout.insertedPoints) {
                augPointsById.set(ip.id, { x: ip.x / imgW, y: ip.y / imgH });
              }

              rampSnapshotRef.current = {
                ...snap,
                annotation: { ...snap.annotation, points: augPoints },
                pointsById: augPointsById,
              };
              rampSnapshotOffsetTopByIdRef.current = new Map(
                augPoints.map((r) => [r.id, r.offsetTop ?? 0])
              );
              rampLayoutRef.current = layout;
              rampIsoZRef.current = zIso;
              rampMovedBaseZRef.current = slopeSetup.currentEdgeZ ?? 0;
              rampMeterByPxRef.current = slopeSetup.meterByPx ?? 0;
              const ia = ring[idToRingIdx.get(chains.isoIds[0])];
              const ib = ring[idToRingIdx.get(chains.isoIds[1])];
              const ma = ring[idToRingIdx.get(chains.movedIds[0])];
              const mb = ring[idToRingIdx.get(chains.movedIds[1])];
              rampIsoPointsPxRef.current = [
                { x: ia.x, y: ia.y },
                { x: ib.x, y: ib.y },
              ];
              rampMovedMidPxRef.current = {
                x: (ma.x + mb.x) / 2,
                y: (ma.y + mb.y) / 2,
              };
              rampAppliesRef.current = true;
              setSlopeModeApplies(true);
              const L0 = rampSlopeLengthM();
              if (L0) {
                setSlopePctValue(
                  String(
                    roundForDisplay(
                      (100 *
                        ((rampMovedBaseZRef.current || 0) -
                          (rampIsoZRef.current || 0))) /
                        L0
                    )
                  )
                );
              }
            }
          }
        }
      } catch (e) {
        rampAppliesRef.current = false;
      }
      }

      // Build the initial (delta=0) transient now that the snapshot is
      // loaded. The visibility swap + parent slot were set up synchronously
      // above. Mode: SHARED_ONLY in sub-selection, WHOLE in whole-face.
      const subPointIds = subTargetPointIdsRef.current;
      const slot = movedTransientRef.current;
      if (
        slot &&
        slot.parent &&
        !slot.transientMesh &&
        movedSnapshotRef.current
      ) {
        // Apply any delta the user has already accumulated during the async
        // setup window so the very first transient mirrors the gizmo position.
        const movedTransient = buildTransientFaceMesh(
          computeMovedTransientArgs(latestDeltaRef.current || 0)
        );
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

      // Build the moved POLYGON's per-corner z + per-corner shift coefficient
      // (k_C): k_C * dn = the z change at corner C produced by the live drag
      // delta dn. Two kinds of corners are handled:
      //   - RAW corners: k_C = 1 if the corner is in subPointIds (sub-mode)
      //     or if we're in whole-mode (offsetZ shifts uniformly), else 0.
      //   - SLIDING corners (e.g. user-marked inflections on the polygon):
      //     k_C is derived by linearly fitting a "unit-shift" plane through
      //     the raw corners (subPointIds = 1, others = 0; or all = 1 in
      //     whole-mode) and evaluating it at the sliding corner's xy. This
      //     lets walls connected at a sliding corner follow the polygon's
      //     plane both during the live drag and at commit.
      //
      // Coefficients live in `polygonShiftCoeffByPointId` and apply to every
      // shared corner — raw or sliding — of every connected POLYLINE.
      const isMovedPolygonForPreview = ann.type === "POLYGON";
      const movedAnnTopZByPointId = new Map();
      const polygonShiftCoeffByPointId = new Map();
      // Only needed to drive connected-annotation propagation — skip the
      // (async) precompute entirely while connected handling is disabled.
      if (connectedAnnotations.length > 0 && isMovedPolygonForPreview) {
        const mh = ann.height ?? 0;
        const mz = ann.offsetZ ?? 0;
        // 1. Raw corner z + simple k for raw corners. Also collect raw
        //    pixel-space points for the plane fits below.
        const baseRender = movedSnapshotRef.current?.baseMapForRender;
        const imgW = baseRender?.imageWidth || 1;
        const imgH = baseRender?.imageHeight || 1;
        const mbpx = baseRender?.meterByPx || null;
        const isWholeMode = !subPointIds || subPointIds.size === 0;
        const rawPxPoints = [];
        const rawUnitPxPoints = [];
        for (const ref of ann.points || []) {
          if (!ref?.id) continue;
          if (ref.isSliding) continue;
          const z = mz + mh + (ref.offsetBottom ?? 0) + (ref.offsetTop ?? 0);
          movedAnnTopZByPointId.set(ref.id, z);
          const inSub = !isWholeMode && subPointIds.has(ref.id);
          const k = isWholeMode ? 1 : inSub ? 1 : 0;
          polygonShiftCoeffByPointId.set(ref.id, k);
          // Pull xy in NORMALIZED units from the snapshot's pointsById.
          const norm = movedSnapshotRef.current?.pointsById?.get(ref.id);
          if (norm) {
            rawPxPoints.push({
              x: norm.x * imgW,
              y: norm.y * imgH,
              offsetTop: ref.offsetTop ?? 0,
            });
            rawUnitPxPoints.push({
              x: norm.x * imgW,
              y: norm.y * imgH,
              offsetTop: k,
            });
          }
        }
        // 2. Plane fits for sliding-corner z + shift coefficient. We fit
        //    in METERS (meterByPx applied inside getPolygonZPlane) since
        //    getZAtXY expects pixel coords and applies meterByPx itself.
        let oldPlane = null;
        let unitPlane = null;
        if (mbpx && rawPxPoints.length >= 3) {
          oldPlane = getPolygonZPlane({ points: rawPxPoints, meterByPx: mbpx });
          unitPlane = getPolygonZPlane({
            points: rawUnitPxPoints,
            meterByPx: mbpx,
          });
        }
        // 3. Sliding corner z + k_C via plane interpolation. Their xy may
        //    not be in the (stripped) snapshot's pointsById, so we read
        //    db.points directly.
        const slidingRefs = (ann.points || []).filter((r) => r?.isSliding);
        if (slidingRefs.length > 0 && oldPlane && unitPlane && mbpx) {
          const slidingIds = slidingRefs.map((r) => r.id).filter(Boolean);
          const slidingPts = await db.points.bulkGet(slidingIds);
          if (cancelled) return;
          slidingRefs.forEach((ref, i) => {
            const pt = slidingPts[i];
            if (!pt) return;
            const xPx = pt.x * imgW;
            const yPx = pt.y * imgH;
            const planeZ = getZAtXY(oldPlane, xPx, yPx, mbpx);
            movedAnnTopZByPointId.set(ref.id, mz + mh + planeZ);
            polygonShiftCoeffByPointId.set(
              ref.id,
              getZAtXY(unitPlane, xPx, yPx, mbpx)
            );
          });
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
        // to neighbors (other shared corners stay put). For POLYGON-moved
        // cases the restriction is based on the per-corner polygon shift
        // coefficient instead: corners with a non-zero coefficient propagate
        // (this includes sub-targeted raw corners AND any sliding polygon
        // corner whose z follows the polygon plane).
        const ownIds = new Set(
          (other.points || []).map((p) => p.id).filter(Boolean)
        );
        const localShared = new Set();
        for (const id of sharedPointIds) {
          if (!ownIds.has(id)) continue;
          if (isMovedPolygonForPreview) {
            const k = polygonShiftCoeffByPointId.get(id);
            if (k == null || k === 0) continue;
          } else if (subPointIds.size > 0 && !subPointIds.has(id)) {
            continue;
          }
          localShared.add(id);
        }
        if (localShared.size === 0) continue;

        // POLYLINE connected to a moved POLYGON: classify each shared
        // corner so the preview AND commit shift the right per-vertex
        // offset (offsetBottom when wall is above, offsetTop when below).
        // Also build the per-corner shift map so transient + commit can use
        // the right z-delta at sliding corners.
        let fieldByPointId = null;
        let shiftCoeffByPointId = null;
        if (isMovedPolygonForPreview && other.type === "POLYLINE") {
          fieldByPointId = new Map();
          shiftCoeffByPointId = new Map();
          const oh = other.height ?? 0;
          const oz = other.offsetZ ?? 0;
          for (const ref of other.points || []) {
            if (!localShared.has(ref.id)) continue;
            const polygonZ = movedAnnTopZByPointId.get(ref.id);
            const which = classifyPolylineCornerVsPolygonZ({
              polygonZ,
              polylineOffsetZ: oz,
              polylineHeight: oh,
              polylineOffsetBottom: ref.offsetBottom,
              polylineOffsetTop: ref.offsetTop,
            });
            fieldByPointId.set(ref.id, which);
            shiftCoeffByPointId.set(
              ref.id,
              polygonShiftCoeffByPointId.get(ref.id) ?? 0
            );
          }
        }

        deepHide(originalMesh);
        const transient = buildTransientFaceMesh({
          snapshot,
          sharedIds: localShared,
          deltaLocal: { x: 0, y: 0, z: 0 },
          mode: "SHARED_ONLY",
          fieldByPointId,
          shiftByPointId: null,
        });
        if (transient) {
          parent.add(transient);
        }
        connectedMap.set(other.id, {
          originalMesh,
          parent,
          snapshot,
          sharedIds: localShared,
          fieldByPointId,
          shiftCoeffByPointId,
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
      setFieldValue(String(roundForDisplay(baseOffsetRef.current + dn)));
      scheduleTransientRegen();
      recomputeVerticalSnap();
    };
    const unsub = tcm.subscribe(update);

    // Mouse drives the helper: recompute on every move (TransformControls
    // still emits pointermove on the canvas during a gizmo drag).
    const snapDom = editor?.sceneManager?.renderer?.domElement;
    const onSnapPointerMove = (e) => {
      const r = snapDom?.getBoundingClientRect?.();
      if (!r) return;
      mouseClientRef.current = {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      };
      recomputeVerticalSnap();
    };
    snapDom?.addEventListener("pointermove", onSnapPointerMove);

    // On release: if a point is filled, snap the offset field + ghost to its
    // exact elevation. The user still confirms with the ✓ button (handleApply
    // re-derives the delta from fieldValue and branches offsetZ vs offsetTop).
    tcm.setDragEndCallback(() => {
      const snap = filledSnapRef.current;
      const initPos = initialPosRef.current;
      const axis = faceNormalRef.current;
      if (!snap || !initPos || !axis) return;
      // dn must align the SAME reference recompute used: the base plane
      // (whole-face) or the moving segment centroid = gizmo init (segment).
      const subIds = subTargetPointIdsRef.current;
      const isSub = !!(subIds && subIds.size > 0);
      const dnSnapped =
        !isSub && baseRefLevelRef.current != null
          ? snap.vLevel - baseRefLevelRef.current
          : snap.vLevel - initPos.dot(axis);
      latestDeltaRef.current = dnSnapped;
      dispatch(setMoveDeltaZ(dnSnapped));
      setFieldValue(
        String(roundForDisplay((baseOffsetRef.current || 0) + dnSnapped))
      );
      scheduleTransientRegen();
    });

    // If AnnotationsManager recreates an annotation mid-drag (loadAnnotations
    // re-fires from useAutoLoadAnnotationsInThreedEditor on any
    // useAnnotationsV2 recompute), the freshly-rebuilt object is visible by
    // default — overlaying our transient. Subscribe so we re-hide the moved
    // annotation as soon as it reappears, and bump the transient regen so
    // the deformation is reapplied to the new geometry.
    const unsubReady = annotationsManager.subscribeAnnotationReady?.((id) => {
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
          movedTransientRef.current.parent =
            liveAnno.parent || movedTransientRef.current.parent;
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

      // Restore the moved mesh visibility — it was hidden in favor of a
      // transient in both modes. Position is also reset defensively (it is
      // no longer mutated during the drag, so this is a no-op for
      // geometry-baked annotation objects).
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

      snapDom?.removeEventListener("pointermove", onSnapPointerMove);
      tcm.setDragEndCallback(null);
      candidateVertsRef.current = [];
      filledSnapRef.current = null;
      baseRefLevelRef.current = null;
      mouseClientRef.current = null;
      setSnapMarkers([]);

      targetRef.current = null;
      initialPosRef.current = null;
      faceNormalRef.current = null;
      baseMapInvRotRef.current = null;
      movedMeshRef.current = null;
      movedMeshInitialLocalPosRef.current = null;
      baseOffsetRef.current = 0;
      movedSnapshotRef.current = null;
      sharedPointIdsRef.current = new Set();
      connectedRef.current = new Map();
      subTargetPointIdsRef.current = new Set();
      slopePointsSnapshotRef.current = null;
      slopeEdgePointIdsRef.current = null;
      slopeCurrentEdgeZRef.current = 0;
      slopeMeterByPxRef.current = 0;
      rampAppliesRef.current = false;
      rampLayoutRef.current = null;
      rampSnapshotRef.current = null;
      rampSnapshotOffsetTopByIdRef.current = null;
      rampIsoZRef.current = 0;
      rampMovedBaseZRef.current = 0;
      rampIsoPointsPxRef.current = null;
      rampMovedMidPxRef.current = null;
      rampMeterByPxRef.current = 0;
      guideLineModeRef.current = false;
      guideLineSpanPxRef.current = 0;
      setSlopeModeApplies(false);
      setSlopePctValue("");
    };
  }, [active, selectedAnnotationId, dispatch, subTargetKey]);

  useEffect(() => {
    setFieldValue(String(roundForDisplay(baseOffsetRef.current + deltaZ)));
  }, [deltaZ]);

  // Keep the slope-% display in sync with the live Δz. Recomputes the implied
  // slope by overlaying `deltaZ` on the entry snapshot's moved-edge vertices.
  useEffect(() => {
    // Ramp mode: slope is referenced to the iso line, not the all-vertices
    // centroid used by getPolygonEdgeSlopePct.
    if (guideLineModeRef.current) {
      // slope% = 100·m/√(1+m²), m = Δz / horizontal run along the guideLine.
      const horiz = (guideLineSpanPxRef.current || 0) * (rampMeterByPxRef.current || 0);
      if (Math.abs(horiz) > 1e-9) {
        const zMoved = (rampMovedBaseZRef.current || 0) + (deltaZ || 0);
        const m = (zMoved - (rampIsoZRef.current || 0)) / horiz;
        setSlopePctValue(
          String(roundForDisplay((100 * m) / Math.sqrt(1 + m * m)))
        );
      }
      return;
    }
    if (rampAppliesRef.current) {
      const L = rampSlopeLengthM();
      if (L) {
        const zMoved = (rampMovedBaseZRef.current || 0) + (deltaZ || 0);
        setSlopePctValue(
          String(
            roundForDisplay((100 * (zMoved - (rampIsoZRef.current || 0))) / L)
          )
        );
      }
      return;
    }
    if (!slopeModeApplies) return;
    const snapshot = slopePointsSnapshotRef.current;
    const edgeIds = slopeEdgePointIdsRef.current;
    const meterByPx = slopeMeterByPxRef.current;
    const baseZ = slopeCurrentEdgeZRef.current;
    if (!snapshot || !edgeIds || !meterByPx) return;
    const edgeIdSet = new Set(edgeIds);
    const projected = snapshot.map((p) =>
      edgeIdSet.has(p.id) ? { ...p, offsetTop: baseZ + (deltaZ || 0) } : p
    );
    const pct = getPolygonEdgeSlopePct({
      points: projected,
      edgePointIds: edgeIds,
      meterByPx,
    });
    if (pct == null) return;
    setSlopePctValue(String(roundForDisplay(pct)));
  }, [deltaZ, slopeModeApplies]);

  // Horizontal distance (meters) from the moved-edge midpoint to the infinite
  // iso line — the run of the ramp used for the iso-referenced slope %.
  function rampSlopeLengthM() {
    const iso = rampIsoPointsPxRef.current;
    const mid = rampMovedMidPxRef.current;
    const mbpx = rampMeterByPxRef.current;
    if (!iso || !mid || !(mbpx > 0)) return null;
    const [A, B] = iso;
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const len = Math.hypot(vx, vy);
    if (len < 1e-9) return null;
    const dPx = Math.abs((mid.x - A.x) * vy - (mid.y - A.y) * vx) / len;
    const L = dPx * mbpx;
    return Number.isFinite(L) && L > 1e-6 ? L : null;
  }

  // Args for buildTransientFaceMesh covering the moved annotation. In ramp
  // mode the whole face is rebuilt from the augmented snapshot with an
  // absolute per-vertex offsetTop (zero XY delta). Otherwise the historical
  // sub-selection / whole-face path is used unchanged.
  function computeMovedTransientArgs(dn) {
    if (
      rampAppliesRef.current &&
      rampSnapshotRef.current &&
      rampLayoutRef.current
    ) {
      const zMoved = (rampMovedBaseZRef.current || 0) + dn;
      const rampMap = rampOffsetTopByPointId({
        tById: rampLayoutRef.current.tById,
        zIso: rampIsoZRef.current || 0,
        zMoved,
      });
      const baseOff = rampSnapshotOffsetTopByIdRef.current || new Map();
      const shiftByPointId = new Map();
      for (const [id, z] of rampMap.entries()) {
        shiftByPointId.set(id, z - (baseOff.get(id) ?? 0));
      }
      return {
        snapshot: rampSnapshotRef.current,
        sharedIds: new Set(rampMap.keys()),
        deltaLocal: { x: 0, y: 0, z: 0 },
        mode: "SHARED_ONLY",
        shiftByPointId,
      };
    }
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
    const subPointIds = subTargetPointIdsRef.current;
    return {
      snapshot: movedSnapshotRef.current,
      sharedIds: subPointIds,
      deltaLocal,
      mode: subPointIds.size > 0 ? "SHARED_ONLY" : "WHOLE",
    };
  }

  // Vertical snap: a single magenta helper (same as the drawing snap) on the
  // existing vertex whose screen position is closest to the cursor. When the
  // cursor is within SNAP_PX of it ("inside"), the helper fills in and that
  // vertex's elevation (vLevel = projection on the drag axis) becomes the
  // snap target, applied on gizmo release. Uses only refs + the stable
  // setState setter, so it is safe to call from the effect's (stale) closure.
  function recomputeVerticalSnap() {
    const editor = getActiveThreedEditor();
    const camera = editor?.sceneManager?.camera;
    const dom = editor?.sceneManager?.renderer?.domElement;
    const n = faceNormalRef.current;
    const verts = candidateVertsRef.current;
    const mouse = mouseClientRef.current;
    if (!camera || !dom || !n || !verts.length || !mouse) {
      filledSnapRef.current = null;
      setSnapMarkers([]);
      return;
    }
    const rect = dom.getBoundingClientRect();

    // Closest existing vertex to the cursor in screen space.
    const tmp = new Vector3();
    let best = null;
    let bestDist2 = Infinity;
    for (const v of verts) {
      tmp.copy(v.position).project(camera);
      if (tmp.z < -1 || tmp.z > 1) continue;
      const sx = ((tmp.x + 1) / 2) * rect.width;
      const sy = ((1 - tmp.y) / 2) * rect.height;
      const dx = sx - mouse.x;
      const dy = sy - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) {
        bestDist2 = d2;
        best = { sx, sy, vLevel: v.position.dot(n) };
      }
    }
    if (!best) {
      filledSnapRef.current = null;
      setSnapMarkers([]);
      return;
    }

    const inside = bestDist2 <= SNAP_PX * SNAP_PX;
    filledSnapRef.current = inside ? { vLevel: best.vLevel } : null;
    setSnapMarkers([{ sx: best.sx, sy: best.sy, filled: inside }]);
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
    // Regenerate the moved annotation transient too (BOTH modes) — the
    // original mesh is hidden, so the transient is the only visual.
    //   - sub-selection: SHARED_ONLY (only targeted vertices follow)
    //   - whole-face:     WHOLE (the whole shape follows the delta)
    if (movedTransient && movedSnapshotRef.current) {
      if (movedTransient.transientMesh && movedTransient.parent) {
        movedTransient.parent.remove(movedTransient.transientMesh);
        disposeMesh(movedTransient.transientMesh);
        movedTransient.transientMesh = null;
      }
      const freshMoved = buildTransientFaceMesh(computeMovedTransientArgs(dn));
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
      let shiftByPointId = null;
      if (entry.shiftCoeffByPointId) {
        shiftByPointId = new Map();
        for (const [id, k] of entry.shiftCoeffByPointId.entries()) {
          shiftByPointId.set(id, k * dn);
        }
      }
      const fresh = buildTransientFaceMesh({
        snapshot: entry.snapshot,
        sharedIds: entry.sharedIds,
        deltaLocal,
        mode: "SHARED_ONLY",
        fieldByPointId: entry.fieldByPointId,
        shiftByPointId,
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
    // The field holds the ABSOLUTE target offset; the move delta is the
    // difference from the offset the annotation started with.
    const dn = Number(fieldValue) - (baseOffsetRef.current || 0);
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

    const sharedIds = sharedPointIdsRef.current;
    const connectedMap = connectedRef.current;
    const subPointIds = subTargetPointIdsRef.current;
    const isSubMode = subPointIds && subPointIds.size > 0;

    await db.transaction("rw", db.points, db.annotations, async () => {
      // Ramp mode: rewrite the whole face as a constant-slope ramp. Inserted
      // points are persisted, every ramp vertex gets its plane offsetTop, and
      // the segment-index arrays are remapped (insertion renumbers segments).
      if (
        rampAppliesRef.current &&
        rampLayoutRef.current &&
        rampSnapshotRef.current
      ) {
        const layout = rampLayoutRef.current;
        const zMoved = (rampMovedBaseZRef.current || 0) + dn;
        const rampMap = rampOffsetTopByPointId({
          tById: layout.tById,
          zIso: rampIsoZRef.current || 0,
          zMoved,
        });

        // No inserted geometry (rectangle / arc-preserving ramp): only
        // persist offsetTop on the existing points. Keep the points array
        // order and the segment-index arrays untouched so arcs and hidden
        // segments stay intact — the 3D shape adapts from the offsets alone.
        if (!layout.insertedPoints || layout.insertedPoints.length === 0) {
          const newPoints = (ann.points || []).map((ref) =>
            rampMap.has(ref.id) && !ref.isSliding
              ? { ...ref, offsetTop: roundForDisplay(rampMap.get(ref.id)) }
              : ref
          );
          await db.annotations.update(selectedAnnotationId, {
            points: newPoints,
          });
          return;
        }

        const imgW = rampSnapshotRef.current.baseMapForRender.imageWidth || 1;
        const imgH = rampSnapshotRef.current.baseMapForRender.imageHeight || 1;
        for (const ip of layout.insertedPoints) {
          await db.points.add({
            id: ip.id,
            x: ip.x / imgW,
            y: ip.y / imgH,
            projectId: ann.projectId,
            baseMapId: ann.baseMapId,
            listingId: ann.listingId,
          });
        }
        const newRefs = rampSnapshotRef.current.annotation.points.map(
          (ref) => ({
            ...ref,
            offsetTop: roundForDisplay(
              rampMap.get(ref.id) ?? ref.offsetTop ?? 0
            ),
          })
        );
        const augIdxById = new Map(newRefs.map((r, i) => [r.id, i]));
        const snapPoints = movedSnapshotRef.current?.annotation?.points || [];
        const newHidden = (
          movedSnapshotRef.current?.annotation?.hiddenSegmentsIdx || []
        )
          .map((s) => augIdxById.get(snapPoints[s]?.id))
          .filter((v) => Number.isInteger(v));
        const rawPoints = ann.points || [];
        const newIso = (ann.isoHeightSegmentsIdx || [])
          .map((s) => augIdxById.get(rawPoints[s]?.id))
          .filter((v) => Number.isInteger(v));
        const newExtEdge = (ann.isExtEdgeSegmentsIdx || [])
          .map((s) => augIdxById.get(rawPoints[s]?.id))
          .filter((v) => Number.isInteger(v));
        await db.annotations.update(selectedAnnotationId, {
          points: newRefs,
          hiddenSegmentsIdx: newHidden,
          isoHeightSegmentsIdx: newIso,
          isExtEdgeSegmentsIdx: newExtEdge,
        });
        return;
      }

      // Note: the moved annotation's sliding refs are KEPT — they are used
      // to identify shared corners with connected polylines (the walls
      // attached at a sliding corner must follow the polygon plane there).
      // The polygon's 3D mesh ignores sliding refs (createAnnotationObject3D
      // strips them), but the data model retains them for propagation.

      const ownPointIds = (ann.points || []).map((p) => p.id).filter(Boolean);
      const ownPointIdSet = new Set(ownPointIds);

      if (isSubMode) {
        // Sub-selection mode: vertical-only delta on the targeted RAW
        // vertices only (subPointIds are picked by the user on the rendered
        // mesh, which excludes sliding refs — so they are necessarily raw).
        const newOwnPoints = (ann.points || []).map((ref) => {
          if (subPointIds.has(ref.id) && !ref.isSliding) {
            return {
              ...ref,
              offsetTop: roundForDisplay((ref.offsetTop ?? 0) + dz),
            };
          }
          return ref;
        });
        ann.points = newOwnPoints;
        await db.annotations.update(selectedAnnotationId, {
          points: newOwnPoints,
        });
      } else {
        // 1. Shared db.points get their (x, y) shifted in baseMap-local —
        //    both the moved annotation and every connected annotation see
        //    it. Sliding refs are part of ownPointIds (they reference real
        //    db.points), so their xy follows the whole-mode translation too.
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
        ann.offsetZ = nextOffsetZ;
        await db.annotations.update(selectedAnnotationId, {
          offsetZ: nextOffsetZ,
        });
      }

      const isMovedPolygon = ann.type === "POLYGON";

      // 3. For each connected annotation: shift the appropriate per-vertex
      //    offset on every shared corner using the SAME per-corner shift
      //    coefficient that the live drag used (entry.shiftCoeffByPointId).
      //
      //    POLYGON-moved + POLYLINE-connected:
      //      - entry.fieldByPointId tells which field (offsetBottom /
      //        offsetTop) gets shifted at each shared corner;
      //      - entry.shiftCoeffByPointId gives k_C so the actual shift is
      //        k_C * dz (walls connected at a sliding polygon corner follow
      //        the polygon plane there);
      //      - "null" classification means the wall straddles the polygon
      //        level — skip.
      //    Other type combinations fall back to the historical "offsetTop +=
      //    dz on subPointIds" behaviour.
      for (const [otherId, entry] of connectedMap.entries()) {
        const otherRaw = await db.annotations.get(otherId);
        if (!otherRaw) continue;
        // Strip auto-managed sliding refs (e.g. inflection points from a
        // previous slope move) from this connected annotation before
        // applying shifts. Each commit re-derives them from the raw
        // underlying geometry.
        const otherStripped = stripSlidingFromAnnotation(otherRaw);
        for (const id of otherStripped.strippedIds) {
          await db.points.delete(id);
        }
        const other = {
          ...otherRaw,
          points: otherStripped.points,
          hiddenSegmentsIdx: otherStripped.hiddenSegmentsIdx,
        };
        const useAboveBelowLogic = isMovedPolygon && other.type === "POLYLINE";
        const otherHeight = other.height ?? 0;
        const otherOffsetZ = other.offsetZ ?? 0;
        let touched = false;
        const newPoints = (other.points || []).map((ref) => {
          const shouldPropagate =
            ownPointIdSet.has(ref.id) &&
            entry.sharedIds.has(ref.id) &&
            (sharedIds.size === 0 || sharedIds.has(ref.id)) &&
            (useAboveBelowLogic || !isSubMode || subPointIds.has(ref.id));
          if (!shouldPropagate) return ref;

          if (useAboveBelowLogic) {
            const which = entry.fieldByPointId?.get(ref.id) ?? null;
            const k = entry.shiftCoeffByPointId?.get(ref.id) ?? 0;
            const localDz = k * dz;
            if (which === "BOTTOM" && Math.abs(localDz) > 1e-9) {
              touched = true;
              return {
                ...ref,
                offsetBottom: roundForDisplay(
                  (ref.offsetBottom ?? 0) + localDz
                ),
              };
            }
            if (which === "TOP" && Math.abs(localDz) > 1e-9) {
              touched = true;
              return {
                ...ref,
                offsetTop: roundForDisplay((ref.offsetTop ?? 0) + localDz),
              };
            }
            return ref;
          }

          touched = true;
          return {
            ...ref,
            offsetTop: roundForDisplay((ref.offsetTop ?? 0) + dz),
          };
        });
        if (!touched) {
          // Even when no shift was applied this turn, persist the stripped
          // state so any previously-auto-added sliding refs are gone.
          if (otherStripped.strippedIds.length > 0) {
            await db.annotations.update(otherId, {
              points: other.points,
              hiddenSegmentsIdx: other.hiddenSegmentsIdx,
            });
          }
          continue;
        }

        // For connected POLYLINE walls only: if the new offsetBottom values
        // pushed any segment into a "negative span" state (wall top below
        // wall bottom), split the polyline at the inflection point and mark
        // the now-invisible portion as hidden via hiddenSegmentsIdx. New
        // intersection vertices are persisted in db.points and tagged
        // `isSliding: true` on the refs so subsequent commits know they are
        // auto-managed.
        if (useAboveBelowLogic) {
          const closeLine = !!other.closeLine;
          const ids = newPoints.map((r) => r.id).filter(Boolean);
          const fetched = await db.points.bulkGet(ids);
          const pointsById = new Map();
          fetched.forEach((p, idx) => {
            if (p) pointsById.set(ids[idx], { x: p.x, y: p.y });
          });
          const split = splitPolylineAtSpanInversions({
            refs: newPoints,
            height: otherHeight,
            closeLine,
            existingHiddenIdx: other.hiddenSegmentsIdx || [],
            pointsById,
            newPointFactory: (x, y) => ({
              id: nanoid(),
              x,
              y,
              projectId: other.projectId,
              baseMapId: other.baseMapId,
              listingId: other.listingId,
            }),
          });
          for (const pt of split.pointsToAdd) {
            await db.points.add(pt);
            // Also remember its (x, y) for the polygon-integration step.
            pointsById.set(pt.id, { x: pt.x, y: pt.y });
          }
          await db.annotations.update(otherId, {
            points: split.refs,
            hiddenSegmentsIdx: split.hiddenSegmentsIdx,
          });
        } else {
          await db.annotations.update(otherId, {
            points: newPoints,
            hiddenSegmentsIdx: other.hiddenSegmentsIdx,
          });
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

  function applyDeltaLive(v) {
    dispatch(setMoveDeltaZ(v));
    latestDeltaRef.current = v;
    const t = targetRef.current;
    const init = initialPosRef.current;
    const n = faceNormalRef.current;
    if (t && init && n) {
      t.position.copy(init).add(n.clone().multiplyScalar(v));
    }
    scheduleTransientRegen();
  }

  function handleFieldChange(e) {
    setFieldValue(e.target.value);
    const total = Number(e.target.value);
    if (Number.isFinite(total)) {
      applyDeltaLive(total - (baseOffsetRef.current || 0));
    }
  }

  function handleSlopeChange(e) {
    setSlopePctValue(e.target.value);
    const target = Number(e.target.value);
    if (!Number.isFinite(target)) return;
    if (guideLineModeRef.current) {
      const r = target / 100;
      if (Math.abs(r) >= 1) return; // slope% asymptote (vertical)
      const horiz =
        (guideLineSpanPxRef.current || 0) * (rampMeterByPxRef.current || 0);
      if (Math.abs(horiz) < 1e-9) return;
      const m = r / Math.sqrt(1 - r * r);
      const zMoved = (rampIsoZRef.current || 0) + m * horiz;
      const dz = zMoved - (rampMovedBaseZRef.current || 0);
      if (!Number.isFinite(dz)) return;
      setFieldValue(String(roundForDisplay((baseOffsetRef.current || 0) + dz)));
      applyDeltaLive(dz);
      return;
    }
    if (rampAppliesRef.current) {
      const L = rampSlopeLengthM();
      if (L == null) return;
      const zMoved = (rampIsoZRef.current || 0) + (target / 100) * L;
      const dz = zMoved - (rampMovedBaseZRef.current || 0);
      if (!Number.isFinite(dz)) return;
      setFieldValue(String(roundForDisplay((baseOffsetRef.current || 0) + dz)));
      applyDeltaLive(dz);
      return;
    }
    const dz = deltaZForTargetSlope({
      points: slopePointsSnapshotRef.current,
      edgePointIds: slopeEdgePointIdsRef.current,
      meterByPx: slopeMeterByPxRef.current,
      targetSlopePct: target,
      currentEdgeZ: slopeCurrentEdgeZRef.current,
    });
    if (dz == null || !Number.isFinite(dz)) return;
    setFieldValue(String(roundForDisplay((baseOffsetRef.current || 0) + dz)));
    applyDeltaLive(dz);
  }

  if (!active) return null;

  return (
    <>
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {snapMarkers.map((m, i) => (
          <circle
            key={i}
            cx={m.sx}
            cy={m.sy}
            r={SNAP_CIRCLE_RADIUS_PX}
            stroke={SNAP_COLOR}
            strokeWidth={SNAP_CIRCLE_STROKE_PX}
            fill={m.filled ? SNAP_COLOR : "none"}
          />
        ))}
      </svg>
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
          width: "max-content",
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
          <Box sx={{ fontSize: 12, color: "text.secondary" }}>Offset (m)</Box>
          <TextField
            size="small"
            value={fieldValue}
            onChange={handleFieldChange}
            type="number"
            sx={{ width: 110 }}
            inputProps={{ step: 0.01 }}
          />
          {slopeModeApplies && (
            <>
              <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                Pente (%)
              </Box>
              <TextField
                size="small"
                value={slopePctValue}
                onChange={handleSlopeChange}
                type="number"
                sx={{ width: 100 }}
                inputProps={{ step: 0.1 }}
              />
            </>
          )}
          <IconButton size="small" color="primary" onClick={handleApply}>
            <CheckIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleCancel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>
    </>
  );
}
