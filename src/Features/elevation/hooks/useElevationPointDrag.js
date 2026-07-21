import { useRef, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";
import commitElevationOffsetsService from "Features/elevation/services/commitElevationOffsetsService";
import moveIsoHeightLineService from "Features/elevation/services/moveIsoHeightLineService";
import moveProfileVertexService from "Features/elevation/services/moveProfileVertexService";

// Drag of an elevation handle:
//   - vertex TOP/BOTTOM handle: vertical only (X fixed by the plan geometry),
//   - isoHeightLine handle: BOTH axes — Y edits the line height, X translates
//     the line in the PLAN along the projection axis,
//   - profile extremity handle: vertical only, batch-commits the same
//     offsetTop to every ring vertex sharing that projected x.
// Reuses the viewport's screenToWorld to map the cursor into the editor's SVG
// world space, then commits on mouse up.
//
// Conversion (see useElevationProfile): worldY = -(z_m) * (1 / meterByPx)
//   => z_m = -worldY * meterByPx
//   TOP:    offsetTop    = z_m - height - offsetZ
//   BOTTOM: offsetBottom = z_m - offsetZ
//   ISO:    line.height  = z_m - height - offsetZ  (same math as TOP)
// Profile x → plan: rawX = sign * ((p − origin)·u)  =>  a profile ∆x maps to
// the plan translation sign·∆x·(ux, uy) — see buildElevationProfile's basis.
export default function useElevationPointDrag({
  viewportRef,
  meterByPx,
  height,
  offsetZ,
  annotationId,
  basis = null,
}) {
  const dispatch = useDispatch();

  // { pointIndex, edge } | { isoIndex, startWorld } | { extremityPointIndexes }
  const dragRef = useRef(null);
  // { pointIndex, edge, worldY } | { isoIndex, worldY, worldDx } |
  // { extremityPointIndexes, worldY }
  const [dragPreview, setDragPreview] = useState(null);

  const worldYToValue = useCallback(
    (worldY, edge) => {
      const zM = -worldY * meterByPx;
      if (edge === "TOP") return zM - height - offsetZ;
      return zM - offsetZ;
    },
    [meterByPx, height, offsetZ]
  );

  // Magnetic snap of the dragged position within ~SNAP_PX screen pixels onto:
  //   - `snapTargets`  (world POINTS): snaps both axes (guide trait extremities),
  //   - `snapLinesX`   (world X values): vertical lines — snaps X only, height
  //                    stays free (the median axis).
  // Point snaps win over line snaps when both are in range.
  const SNAP_PX = 12;
  const applySnap = useCallback(
    (worldPos, drag) => {
      const hasPoints = drag?.snapTargets?.length > 0;
      const hasLines = drag?.snapLinesX?.length > 0;
      if ((!hasPoints && !hasLines) || !viewportRef.current) return worldPos;
      const a = viewportRef.current.screenToWorld(0, 0);
      const b = viewportRef.current.screenToWorld(SNAP_PX, 0);
      const thresholdWorld = Math.abs(b.x - a.x) || 0;
      if (!(thresholdWorld > 0)) return worldPos;
      let bestPoint = null;
      if (hasPoints) {
        for (const t of drag.snapTargets) {
          const d = Math.hypot(worldPos.x - t.x, worldPos.y - t.y);
          if (d <= thresholdWorld && (!bestPoint || d < bestPoint.d))
            bestPoint = { t, d };
        }
      }
      if (bestPoint) return { x: bestPoint.t.x, y: bestPoint.t.y };
      if (hasLines) {
        let bestLine = null;
        for (const lx of drag.snapLinesX) {
          const d = Math.abs(worldPos.x - lx);
          if (d <= thresholdWorld && (!bestLine || d < bestLine.d))
            bestLine = { lx, d };
        }
        if (bestLine) return { x: bestLine.lx, y: worldPos.y };
      }
      return worldPos;
    },
    [viewportRef]
  );

  const handleWindowMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || !viewportRef.current) return;
      if (Math.abs(e.clientY - drag.startClientY) > 3) drag.moved = true;
      if (Math.abs(e.clientX - drag.startClientX) > 3) drag.moved = true;
      const worldPos = applySnap(
        viewportRef.current.screenToWorld(e.clientX, e.clientY),
        drag
      );
      if (drag.isoIndex != null) {
        setDragPreview({
          isoIndex: drag.isoIndex,
          worldY: worldPos.y,
          worldDx: worldPos.x - drag.startWorld.x,
        });
      } else if (drag.profileVertexIndex != null) {
        setDragPreview({
          profileIndex: drag.profileIndex,
          profileVertexIndex: drag.profileVertexIndex,
          worldY: worldPos.y,
          worldX: worldPos.x,
          sMin: drag.sMin,
          sMax: drag.sMax,
        });
      } else if (drag.extremityPointIndexes) {
        setDragPreview({
          extremityPointIndexes: drag.extremityPointIndexes,
          worldY: worldPos.y,
        });
      } else {
        setDragPreview({
          pointIndex: drag.pointIndex,
          edge: drag.edge,
          worldY: worldPos.y,
        });
      }
    },
    [viewportRef, applySnap]
  );

  const handleWindowUp = useCallback(
    (e) => {
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("mouseup", handleWindowUp);

      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (!drag || !drag.moved || !viewportRef.current) return;

      const worldPos = applySnap(
        viewportRef.current.screenToWorld(e.clientX, e.clientY),
        drag
      );
      if (drag.isoIndex != null) {
        // Height from Y; plan translation from the profile ∆x via the basis.
        const worldDx = worldPos.x - drag.startWorld.x;
        const sign = basis?.sign ?? 1;
        const ux = basis?.ux ?? 0;
        const uy = basis?.uy ?? 0;
        moveIsoHeightLineService({
          annotationId,
          index: drag.isoIndex,
          height: worldYToValue(worldPos.y, "TOP"),
          planDelta: {
            dx: sign * worldDx * ux,
            dy: sign * worldDx * uy,
          },
          dispatch,
        });
        return;
      }
      if (drag.profileVertexIndex != null) {
        // Profile section vertex: FREE 2-axis drag — Y edits the height, X
        // slides the vertex along the profile path in plan (curvilinear s,
        // bounded by the caller; endpoints may extrapolate). The section z
        // reference is per-caller: POLYGON shells include the annotation
        // height (drag.sectionHeight = height), POLYLINE extrusions do not
        // (drag.sectionHeight = 0).
        let planPos = null;
        if (
          typeof drag.planAt === "function" &&
          Number.isFinite(drag.sMin) &&
          Number.isFinite(drag.sMax)
        ) {
          const s = Math.max(drag.sMin, Math.min(drag.sMax, worldPos.x));
          planPos = drag.planAt(s);
        }
        const zM = -worldPos.y * meterByPx;
        moveProfileVertexService({
          annotationId,
          profileIndex: drag.profileIndex,
          vertexIndex: drag.profileVertexIndex,
          height: zM - (drag.sectionHeight ?? height) - offsetZ,
          planPos,
          dispatch,
        });
        return;
      }
      if (drag.extremityPointIndexes) {
        commitElevationOffsetsService({
          annotationId,
          pointIndexes: drag.extremityPointIndexes,
          edge: "TOP",
          value: worldYToValue(worldPos.y, "TOP"),
          dispatch,
        });
        return;
      }
      const value = worldYToValue(worldPos.y, drag.edge);
      commitElevationOffsetService({
        annotationId,
        pointIndex: drag.pointIndex,
        edge: drag.edge,
        value,
        dispatch,
      });
    },
    [
      handleWindowMove,
      viewportRef,
      worldYToValue,
      applySnap,
      meterByPx,
      height,
      offsetZ,
      annotationId,
      basis,
      dispatch,
    ]
  );

  const startDrag = useCallback(
    (e, dragState) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        ...dragState,
        startClientY: e.clientY,
        startClientX: e.clientX,
        moved: false,
      };
      window.addEventListener("mousemove", handleWindowMove);
      window.addEventListener("mouseup", handleWindowUp);
    },
    [handleWindowMove, handleWindowUp]
  );

  const startHandleDrag = useCallback(
    (e, pointIndex, edge) => startDrag(e, { pointIndex, edge }),
    [startDrag]
  );

  // Iso handle: the whole line moves (height + position along the axis).
  const startIsoHandleDrag = useCallback(
    (e, isoIndex) => {
      if (!viewportRef.current) return;
      startDrag(e, {
        isoIndex,
        startWorld: viewportRef.current.screenToWorld(e.clientX, e.clientY),
      });
    },
    [startDrag, viewportRef]
  );

  // Profile extremity: several ring vertices share the projected x — one
  // vertical handle drives them all.
  const startExtremityDrag = useCallback(
    (e, pointIndexes) => startDrag(e, { extremityPointIndexes: pointIndexes }),
    [startDrag]
  );

  // Shell / extrusion profile section vertex: free 2-axis drag — Y edits the
  // inline height, X slides along the profile path in plan. `sMin`/`sMax`
  // bound the slide, `planAt(s)` maps abscissa → plan position (may
  // extrapolate for endpoints), `sectionHeight` sets the z reference,
  // `snapTargets` are magnetic world POINTS (guide trait extremities) and
  // `snapLinesX` magnetic vertical lines (the median axis).
  const startProfileVertexDrag = useCallback(
    (
      e,
      {
        profileIndex,
        vertexIndex,
        sMin,
        sMax,
        planAt,
        sectionHeight,
        snapTargets,
        snapLinesX,
      }
    ) =>
      startDrag(e, {
        profileIndex,
        profileVertexIndex: vertexIndex,
        sMin,
        sMax,
        planAt,
        sectionHeight,
        snapTargets,
        snapLinesX,
      }),
    [startDrag]
  );

  return {
    startHandleDrag,
    startIsoHandleDrag,
    startExtremityDrag,
    startProfileVertexDrag,
    dragPreview,
  };
}
