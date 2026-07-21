import { useRef, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import commitElevationOffsetService from "Features/elevation/services/commitElevationOffsetService";
import commitElevationOffsetsService from "Features/elevation/services/commitElevationOffsetsService";
import moveIsoHeightLineService from "Features/elevation/services/moveIsoHeightLineService";

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

  const handleWindowMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag || !viewportRef.current) return;
      if (Math.abs(e.clientY - drag.startClientY) > 3) drag.moved = true;
      if (Math.abs(e.clientX - drag.startClientX) > 3) drag.moved = true;
      const worldPos = viewportRef.current.screenToWorld(e.clientX, e.clientY);
      if (drag.isoIndex != null) {
        setDragPreview({
          isoIndex: drag.isoIndex,
          worldY: worldPos.y,
          worldDx: worldPos.x - drag.startWorld.x,
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
    [viewportRef]
  );

  const handleWindowUp = useCallback(
    (e) => {
      window.removeEventListener("mousemove", handleWindowMove);
      window.removeEventListener("mouseup", handleWindowUp);

      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (!drag || !drag.moved || !viewportRef.current) return;

      const worldPos = viewportRef.current.screenToWorld(e.clientX, e.clientY);
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
    (e, pointIndexes) =>
      startDrag(e, { extremityPointIndexes: pointIndexes }),
    [startDrag]
  );

  return { startHandleDrag, startIsoHandleDrag, startExtremityDrag, dragPreview };
}
