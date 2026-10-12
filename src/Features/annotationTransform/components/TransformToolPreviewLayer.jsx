import { useEffect, useRef } from "react";

import TransientAnnotationLayer from "Features/mapEditorGeneric/components/TransientAnnotationLayer";

import {
  getTransformCopyCount,
  resetTransformSession,
  useTransformSession,
} from "../services/transformSessionStore";
import { getPivotBbox } from "../utils/getTransformPointUpdates";
import { formatUserAngle } from "../utils/rotateAngle";

const GUIDE_COLOR = "#e65100";
const REFERENCE_COLOR = "#757575";

// ---------------------------------------------------------------------------
// TransformToolPreviewLayer — live preview of the 2D « Déplacer » / « Tourner »
// tools, mounted in InteractionLayer's overlay (screen space; the content is
// drawn in the base map's pixel frame through `basePose`). Reads the tool's
// session store itself, so a cursor move re-renders this layer only.
//
// The carried annotations are redrawn at their transformed pose (the stored
// ones stay in place underneath, as the "before" ghost) with the guides:
// MOVE = grabbed point → cursor; ROTATE = pivot, reference axis, current
// axis and the angle. « Copie multiple » (MOVE with a typed count): one
// redraw per copy at i × the vector, a tick on each landing point and the
// « ×N » label — the originals stay visible in place.
// ---------------------------------------------------------------------------

export default function TransformToolPreviewLayer({
  annotations,
  basePose,
  baseMapMeterByPx,
}) {
  // data

  const session = useTransformSession();

  // The annotations came back from the db after a commit: the preview has
  // done its job (a fallback timer in useAnnotationTransformTool covers a
  // write that changes nothing).
  const committingRef = useRef(session.committing);
  committingRef.current = session.committing;
  useEffect(() => {
    if (committingRef.current) resetTransformSession();
  }, [annotations]);

  // helpers

  const { kind, anchor, reference, cursor, angleDeg } = session;
  if (!kind || !anchor || !basePose) return null;

  const carried = (annotations ?? []).filter((a) =>
    session.carriedAnnotationIds.includes(a.id)
  );

  const isRotate = kind === "ROTATE";
  const rotating = isRotate && Boolean(reference);
  const deltaPos = isRotate
    ? { x: angleDeg, y: 0 }
    : {
        x: (cursor?.x ?? anchor.x) - anchor.x,
        y: (cursor?.y ?? anchor.y) - anchor.y,
      };
  const partType = isRotate ? "ROTATE" : null;
  const wrapperBbox = isRotate ? getPivotBbox(anchor) : undefined;
  const showCarried = !isRotate || rotating;
  const copyCount = isRotate ? 0 : getTransformCopyCount(session);
  // Poses to draw: one per copy, or the single moved / turned pose.
  const poses =
    copyCount > 0
      ? Array.from({ length: copyCount }, (_, idx) => ({
          index: idx + 1,
          deltaPos: { x: deltaPos.x * (idx + 1), y: deltaPos.y * (idx + 1) },
        }))
      : [{ index: 0, deltaPos }];
  const lastPose = poses[poses.length - 1];

  // Screen-constant sizes in the scaled group.
  const k = basePose.k || 1;
  const px = (n) => n / k;

  // ROTATE: the current axis has the reference axis' length, turned by the
  // current angle.
  let currentEnd = null;
  let labelPos = null;
  if (rotating) {
    const rx = reference.x - anchor.x;
    const ry = reference.y - anchor.y;
    const rad = (angleDeg * Math.PI) / 180;
    currentEnd = {
      x: anchor.x + rx * Math.cos(rad) - ry * Math.sin(rad),
      y: anchor.y + rx * Math.sin(rad) + ry * Math.cos(rad),
    };
    labelPos = { x: currentEnd.x + px(10), y: currentEnd.y - px(10) };
  }

  // render

  return (
    <g
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${k})`}
      style={{ pointerEvents: "none" }}
    >
      {showCarried &&
        poses.map((pose) =>
          carried.map((annotation) => (
            <TransientAnnotationLayer
              key={`${annotation.id}::${pose.index}`}
              annotation={annotation}
              deltaPos={pose.deltaPos}
              partType={partType}
              wrapperBbox={wrapperBbox}
              basePose={basePose}
              baseMapMeterByPx={baseMapMeterByPx}
            />
          ))
        )}

      {!isRotate && cursor && (
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={anchor.x + lastPose.deltaPos.x}
          y2={anchor.y + lastPose.deltaPos.y}
          stroke={REFERENCE_COLOR}
          strokeWidth={px(1)}
          strokeDasharray={`${px(4)} ${px(4)}`}
        />
      )}

      {copyCount > 0 &&
        poses.map((pose) => (
          <circle
            key={pose.index}
            cx={anchor.x + pose.deltaPos.x}
            cy={anchor.y + pose.deltaPos.y}
            r={px(3)}
            fill="white"
            stroke={GUIDE_COLOR}
            strokeWidth={px(1.5)}
          />
        ))}

      {copyCount > 0 && cursor && (
        <text
          x={cursor.x + px(10)}
          y={cursor.y - px(10)}
          fontSize={px(13)}
          fontWeight={600}
          fill={GUIDE_COLOR}
          stroke="white"
          strokeWidth={px(3)}
          paintOrder="stroke"
        >
          {`×${copyCount}`}
        </text>
      )}

      {isRotate && !rotating && cursor && (
        <line
          x1={anchor.x}
          y1={anchor.y}
          x2={cursor.x}
          y2={cursor.y}
          stroke={REFERENCE_COLOR}
          strokeWidth={px(1)}
          strokeDasharray={`${px(4)} ${px(4)}`}
        />
      )}

      {rotating && (
        <>
          <line
            x1={anchor.x}
            y1={anchor.y}
            x2={reference.x}
            y2={reference.y}
            stroke={REFERENCE_COLOR}
            strokeWidth={px(1)}
            strokeDasharray={`${px(4)} ${px(4)}`}
          />
          <line
            x1={anchor.x}
            y1={anchor.y}
            x2={currentEnd.x}
            y2={currentEnd.y}
            stroke={GUIDE_COLOR}
            strokeWidth={px(1.5)}
            strokeDasharray={`${px(4)} ${px(4)}`}
          />
          <text
            x={labelPos.x}
            y={labelPos.y}
            fontSize={px(13)}
            fontWeight={600}
            fill={GUIDE_COLOR}
            stroke="white"
            strokeWidth={px(3)}
            paintOrder="stroke"
          >
            {formatUserAngle(angleDeg)}
          </text>
        </>
      )}

      <circle
        cx={anchor.x}
        cy={anchor.y}
        r={px(4)}
        fill={isRotate ? GUIDE_COLOR : "white"}
        stroke={GUIDE_COLOR}
        strokeWidth={px(1.5)}
      />
    </g>
  );
}
