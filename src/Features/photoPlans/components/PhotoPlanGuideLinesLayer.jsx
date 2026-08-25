import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { triggerPhotoPlansUpdate } from "../photoPlansSlice";

import db from "App/db/db";

import VanishingLinesLayer from "./VanishingLinesLayer";

import usePhotoPlans from "../hooks/usePhotoPlans";
import { defaultVanishingLines } from "../utils/calibrationUiConstants";

// World-space layer of the MAIN 2D editor (quick-flatten flow): draggable
// vanishing guide lines over a photo baseMap, bound to its whole-photo plan
// (calibrationInputs.uSegments/vSegments — same storage the Élévation panel
// seeds from). Self-contained dragging: pointer capture + getScreenCTM, so
// no InteractionLayer wiring is needed; stopPropagation keeps the editor's
// pan/draw/selection out of the gesture.
export default function PhotoPlanGuideLinesLayer({ baseMap, basePose }) {
  const dispatch = useDispatch();

  const showGuides = useSelector((s) => s.photoPlans.showGuideLinesInMap);
  const { value: photoPlans = [] } = usePhotoPlans({
    baseMapId: baseMap?.isPhoto && showGuides ? baseMap.id : null,
  });
  const fullPlan = photoPlans.find((p) => !p.annotationId) ?? null;

  // Draft lines during a drag; null = mirror the persisted record.
  const [draft, setDraft] = useState(null);
  const gRef = useRef(null);
  const dragRef = useRef(null); // { family, segmentId, end }

  const imageSize = baseMap?.getImageSize?.();

  const planLines = fullPlan
    ? {
        u: fullPlan.calibrationInputs?.uSegments ?? defaultVanishingLines().u,
        v: fullPlan.calibrationInputs?.vSegments ?? defaultVanishingLines().v,
      }
    : null;
  const lines = draft ?? planLines;

  // Drop the draft when the plan changes or the persisted record catches up
  // (updatedAt bumps right after the pointer-up write).
  useEffect(() => {
    setDraft(null);
  }, [fullPlan?.id, fullPlan?.updatedAt]);

  if (
    !baseMap?.isPhoto ||
    !showGuides ||
    !fullPlan ||
    !lines ||
    !imageSize?.width ||
    !imageSize?.height
  ) {
    return null;
  }

  // handlers — pointer-captured endpoint drag, coords via the group's CTM
  // (includes camera + basePose, so local space = photo pixels).

  const toLocal = (e) => {
    const ctm = gRef.current?.getScreenCTM?.();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      ctm.inverse()
    );
    return { x: pt.x / imageSize.width, y: pt.y / imageSize.height };
  };

  const handlePointerDown = (e) => {
    const handle = e.target?.closest?.('[data-interaction="fuite-endpoint"]');
    if (!handle) return;
    const family = handle.getAttribute("data-family");
    const segmentId = handle.getAttribute("data-seg-id");
    const end = handle.getAttribute("data-end");
    if (!family || !segmentId || !end) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { family, segmentId, end };
    gRef.current?.setPointerCapture?.(e.pointerId);
    setDraft(planLines);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    const point = toLocal(e);
    if (!point) return;
    setDraft((prev) => {
      const base = prev ?? planLines;
      return {
        ...base,
        [drag.family]: base[drag.family].map((seg) =>
          seg.id === drag.segmentId ? { ...seg, [drag.end]: point } : seg
        ),
      };
    });
  };

  const handlePointerUp = async (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.stopPropagation();
    dragRef.current = null;
    gRef.current?.releasePointerCapture?.(e.pointerId);
    setDraft((finalDraft) => {
      if (finalDraft) {
        db.photoPlans
          .update(fullPlan.id, {
            calibrationInputs: {
              ...(fullPlan.calibrationInputs ?? {}),
              uSegments: finalDraft.u,
              vSegments: finalDraft.v,
            },
          })
          .then(() => dispatch(triggerPhotoPlansUpdate()));
      }
      return finalDraft; // kept until the liveQuery re-emits the record
    });
  };

  return (
    <g
      ref={gRef}
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={(e) => {
        // The editor's pan/draw listens on mousedown too.
        if (e.target?.closest?.('[data-interaction="fuite-endpoint"]')) {
          e.stopPropagation();
        }
      }}
    >
      <VanishingLinesLayer
        vanishingLines={lines}
        width={imageSize.width}
        height={imageSize.height}
        containerK={basePose.k}
      />
    </g>
  );
}
