import { useEffect, useRef } from "react";

import TransientAnnotationLayer from "Features/mapEditorGeneric/components/TransientAnnotationLayer";

import {
  getTransformCopyCount,
  getTransformMoveLength,
  resetTransformSession,
  useTransformSession,
} from "../services/transformSessionStore";
import { formatMoveBadge, formatRotateBadge } from "../utils/copyBuffer";
import { getPivotBbox } from "../utils/getTransformPointUpdates";
import {
  formatUserAngle,
  parseAngleBufferToPixelDeg,
} from "../utils/rotateAngle";

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
// axis and the angle. « Copie multiple » (typed count): one redraw per copy
// at i × the vector (MOVE, a tick on each landing point) or i × the angle
// (ROTATE, a thin guide per copy) and the « ×N » label — the originals stay
// visible in place.
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
  const copyCount = showCarried ? getTransformCopyCount(session) : 0;
  // Poses to draw: one per copy, or the single moved / turned pose.
  const poses =
    copyCount > 0
      ? Array.from({ length: copyCount }, (_, idx) => ({
          index: idx + 1,
          deltaPos: { x: deltaPos.x * (idx + 1), y: deltaPos.y * (idx + 1) },
        }))
      : [{ index: 0, deltaPos }];
  const lastPose = poses[poses.length - 1];
  // Cursor label of a move: the travelled distance (typed or live) and the
  // copy count.
  const moveLengthM =
    !isRotate && baseMapMeterByPx > 0
      ? Math.hypot(deltaPos.x, deltaPos.y) * baseMapMeterByPx
      : null;
  const moveLabel = isRotate
    ? null
    : formatMoveBadge({ lengthM: moveLengthM ?? undefined, count: copyCount });
  const moveLabelLocked = getTransformMoveLength(session) != null;
  const rotateLabelLocked =
    isRotate && parseAngleBufferToPixelDeg(session.angleBuffer) != null;

  // Screen-constant sizes in the scaled group.
  const k = basePose.k || 1;
  const px = (n) => n / k;

  // ROTATE: the current axis has the reference axis' length, turned by the
  // current angle (the 1st copy's); the other copies get a thinner guide at
  // i × the angle.
  const axisEndAt = (deg) => {
    const rx = reference.x - anchor.x;
    const ry = reference.y - anchor.y;
    const rad = (deg * Math.PI) / 180;
    return {
      x: anchor.x + rx * Math.cos(rad) - ry * Math.sin(rad),
      y: anchor.y + rx * Math.sin(rad) + ry * Math.cos(rad),
    };
  };
  let currentEnd = null;
  let labelPos = null;
  let copyAxisEnds = [];
  if (rotating) {
    currentEnd = axisEndAt(angleDeg);
    labelPos = { x: currentEnd.x + px(10), y: currentEnd.y - px(10) };
    copyAxisEnds = poses
      .filter((pose) => pose.index > 1)
      .map((pose) => ({ index: pose.index, end: axisEndAt(pose.deltaPos.x) }));
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

      {!isRotate &&
        copyCount > 0 &&
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

      {moveLabel && cursor && (
        <text
          x={cursor.x + px(10)}
          y={cursor.y - px(10)}
          fontSize={px(13)}
          fontWeight={moveLabelLocked ? 700 : 600}
          fill={GUIDE_COLOR}
          stroke="white"
          strokeWidth={px(3)}
          paintOrder="stroke"
        >
          {moveLabel}
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
          {copyAxisEnds.map(({ index, end }) => (
            <line
              key={index}
              x1={anchor.x}
              y1={anchor.y}
              x2={end.x}
              y2={end.y}
              stroke={GUIDE_COLOR}
              strokeWidth={px(1)}
              strokeDasharray={`${px(2)} ${px(4)}`}
            />
          ))}
          <text
            x={labelPos.x}
            y={labelPos.y}
            fontSize={px(13)}
            fontWeight={rotateLabelLocked ? 700 : 600}
            fill={GUIDE_COLOR}
            stroke="white"
            strokeWidth={px(3)}
            paintOrder="stroke"
          >
            {formatRotateBadge({
              angleLabel: formatUserAngle(angleDeg),
              count: copyCount,
            })}
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
