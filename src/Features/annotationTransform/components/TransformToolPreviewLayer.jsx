import { useEffect, useRef } from "react";

import TransientAnnotationLayer from "Features/mapEditorGeneric/components/TransientAnnotationLayer";

import {
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
// axis and the angle.
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
        carried.map((annotation) => (
          <TransientAnnotationLayer
            key={annotation.id}
            annotation={annotation}
            deltaPos={deltaPos}
            partType={partType}
            wrapperBbox={wrapperBbox}
            basePose={basePose}
            baseMapMeterByPx={baseMapMeterByPx}
          />
        ))}

      {!isRotate && cursor && (
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
