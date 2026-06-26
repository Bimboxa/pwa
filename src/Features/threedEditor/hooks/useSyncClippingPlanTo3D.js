import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setClippingPlan } from "Features/mapEditor/mapEditorSlice";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getClippingPlaneFromSegment from "Features/threedEditor/utils/getClippingPlaneFromSegment";
import getSegmentFromClippingPlane from "Features/threedEditor/utils/getSegmentFromClippingPlane";

// signature of a {pointA,pointB,sign} so we can tell whether a redux value and a
// plane already represent the same cut (used to break the 2D⇄3D feedback loop).
function sigOf(plan) {
  if (!plan?.pointA || !plan?.pointB) return null;
  const r = (v) => (typeof v === "number" ? v.toFixed(4) : "?");
  return `${r(plan.pointA.x)},${r(plan.pointA.y)},${r(plan.pointB.x)},${r(
    plan.pointB.y
  )},${plan.sign ?? 1}`;
}

// Two-way sync between the 2D-defined clipping plane (mapEditor.clippingPlan) and
// the 3D ClippingManager:
//   - 2D → 3D: dragging the segment / clicking the direction arrow orients the
//     cut plane.
//   - 3D → 2D: moving/rotating/flipping the plane in the 3D view updates the 2D
//     segment (clipped to the image bounds), so it's correct when going back to
//     the map editor.
//
// Loop guards: `lastSigRef` holds the cut last synced in EITHER direction; the
// forward effect skips re-applying a value that came FROM 3D (so it never fights
// the gizmo), and `applyingForwardRef` suppresses the 3D→2D callback during a
// forward apply (so 2D endpoints aren't echoed back as border-clipped ones).
export default function useSyncClippingPlanTo3D({
  threedEditorRef,
  rendererIsReady,
}) {
  const dispatch = useDispatch();
  const enabled = useSelector((s) => s.mapEditor.clippingPlanEnabled);
  const clippingPlan = useSelector((s) => s.mapEditor.clippingPlan);
  const baseMap = useMainBaseMap();

  const wasEnabledRef = useRef(false);
  const lastSigRef = useRef(null);
  const applyingForwardRef = useRef(false);

  // 2D → 3D
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const cm = editor.sceneManager?.clippingManager;
    if (!cm) return;

    if (!enabled) {
      wasEnabledRef.current = false;
      return; // disable handled by the clippingPlane.enabled effect
    }

    if (!wasEnabledRef.current) {
      cm.ensureCreated();
      wasEnabledRef.current = true;
    }

    if (
      baseMap &&
      clippingPlan?.pointA &&
      clippingPlan?.pointB &&
      (!clippingPlan.baseMapId || clippingPlan.baseMapId === baseMap.id)
    ) {
      const sig = sigOf(clippingPlan);
      // Skip if this value was just produced FROM the 3D side (avoids fighting
      // the gizmo and re-clipping the segment we already mirrored).
      if (sig && sig !== lastSigRef.current) {
        const res = getClippingPlaneFromSegment({
          baseMap,
          pointA: clippingPlan.pointA,
          pointB: clippingPlan.pointB,
          sign: clippingPlan.sign ?? 1,
        });
        if (res) {
          lastSigRef.current = sig;
          applyingForwardRef.current = true;
          cm.setFromWorldNormalAndPoint(res.normal, res.point);
          applyingForwardRef.current = false;
        }
      }
    }

    cm.setEnabled(true);
  }, [enabled, clippingPlan, baseMap, rendererIsReady, threedEditorRef]);

  // 3D → 2D
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const cm = editor.sceneManager?.clippingManager;
    if (!cm?.subscribe || !enabled) return;

    const unsub = cm.subscribe(() => {
      if (applyingForwardRef.current) return; // our own forward apply
      if (!baseMap) return;
      const seg = getSegmentFromClippingPlane({ baseMap, plane: cm.plane });
      if (!seg) return;
      const sig = sigOf(seg);
      if (!sig || sig === lastSigRef.current) return; // nothing new
      lastSigRef.current = sig;
      dispatch(
        setClippingPlan({
          pointA: seg.pointA,
          pointB: seg.pointB,
          sign: seg.sign,
          baseMapId: baseMap.id,
        })
      );
    });

    return unsub;
  }, [enabled, baseMap, rendererIsReady, threedEditorRef, dispatch]);
}
