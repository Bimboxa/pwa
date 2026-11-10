import { useMemo } from "react";

import getCotePageScale from "Features/annotations/utils/getCotePageScale";

import {
  HEIGHT_CUT_PART_TYPE,
  HEIGHT_CUT_SIDE_BOTTOM,
  HEIGHT_FACE_PART_TYPE,
  formatHeightCutDelta,
} from "../constants/heightCutConstants";
import { isClosedTrace } from "../utils/computeHeightFaces";

const LABEL_FONT_SIZE_PT = 14;
const LABEL_HALO_PT = 3;
const LINE_COLOR = "#000";
const SELECTED_COLOR = "#2196f3";
const HIT_STROKE_WIDTH_PX = 10;
// Raised faces are shaded darker, lowered ones lighter.
const RAISED_TINT = { fill: "#000", opacity: 0.18 };
const LOWERED_TINT = { fill: "#fff", opacity: 0.3 };

// Height cuts of a POLYGON in the 2D editor (child of NodePolylineStatic).
//
// layer "INK": what belongs to the drawing — the tint of the raised / lowered
// faces, the lines between faces (dashed when the step is on the bottom side)
// and the delta label, sized in page points like the slope text (fixed
// relative to the print zone).
// layer "HIT": the click targets of the SELECTED annotation — one per face
// (`{id}::HEIGHT_FACE::{key}`) and one per open trace
// (`{id}::HEIGHT_CUT::{traceId}`), with the hover / selection feedback.
//
// faces: computeHeightFaces output (pixels); traces: resolved heightCuts.
export default function NodeHeightCutsStatic({
  layer,
  annotation,
  faces,
  traces,
  selectedPartId,
  hoveredPartId,
  onHoverPart,
  getPartCursor,
}) {
  // data

  const annotationId = annotation?.id;
  const pageScale = getCotePageScale(annotation);

  const { solidD, dashedD, neutralD } = useMemo(
    () => buildEdgePaths(faces),
    [faces]
  );

  // helpers

  const getFacePartId = (face) =>
    `${annotationId}::${HEIGHT_FACE_PART_TYPE}::${face.key}`;
  const getTracePartId = (trace) =>
    `${annotationId}::${HEIGHT_CUT_PART_TYPE}::${trace.id}`;

  // render

  if (!faces?.length) return null;

  if (layer === "HIT") {
    return (
      <g>
        {faces.map((face) => {
          const partId = getFacePartId(face);
          const isSelected = selectedPartId === partId;
          const isHovered = hoveredPartId === partId;
          return (
            <path
              key={partId}
              d={getFacePathD(face)}
              fillRule="evenodd"
              fill={SELECTED_COLOR}
              fillOpacity={isSelected ? 0.3 : isHovered ? 0.15 : 0}
              stroke="none"
              style={{ cursor: getPartCursor?.(partId) ?? "pointer" }}
              data-part-id={partId}
              data-part-type={HEIGHT_FACE_PART_TYPE}
              data-node-id={annotationId}
              onMouseEnter={(e) => {
                e.stopPropagation();
                onHoverPart?.(partId);
              }}
              onMouseLeave={() => onHoverPart?.(null)}
            />
          );
        })}
        {(traces || [])
          .filter((trace) => !isClosedTrace(trace))
          .map((trace) => {
            const partId = getTracePartId(trace);
            const isSelected = selectedPartId === partId;
            const isHovered = hoveredPartId === partId;
            const pointsStr = trace.points
              .map((p) => `${p.x},${p.y}`)
              .join(" ");
            return (
              <g
                key={partId}
                style={{ cursor: getPartCursor?.(partId) ?? "pointer" }}
                data-part-id={partId}
                data-part-type={HEIGHT_CUT_PART_TYPE}
                data-node-id={annotationId}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  onHoverPart?.(partId);
                }}
                onMouseLeave={() => onHoverPart?.(null)}
              >
                <polyline
                  points={pointsStr}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT_STROKE_WIDTH_PX}
                  vectorEffect="non-scaling-stroke"
                />
                {(isSelected || isHovered) && (
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke={SELECTED_COLOR}
                    strokeWidth={3}
                    strokeOpacity={isSelected ? 1 : 0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: "none" }}
                  />
                )}
              </g>
            );
          })}
      </g>
    );
  }

  return (
    <g style={{ pointerEvents: "none" }}>
      {faces
        .filter((face) => face.delta !== 0)
        .map((face) => {
          const tint = face.delta > 0 ? RAISED_TINT : LOWERED_TINT;
          return (
            <path
              key={`tint-${face.key}`}
              d={getFacePathD(face)}
              fillRule="evenodd"
              fill={tint.fill}
              fillOpacity={tint.opacity}
              stroke="none"
            />
          );
        })}
      {neutralD && (
        <path
          d={neutralD}
          fill="none"
          stroke={LINE_COLOR}
          strokeOpacity={0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {solidD && (
        <path
          d={solidD}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {dashedD && (
        <path
          d={dashedD}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {faces
        .filter((face) => face.delta !== 0 && face.labelPoint)
        .map((face) => (
          <g
            key={`label-${face.key}`}
            transform={`translate(${face.labelPoint.x}, ${face.labelPoint.y})`}
          >
            <g transform={`scale(${pageScale})`}>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={LABEL_FONT_SIZE_PT}
                fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                fill={LINE_COLOR}
                style={{
                  userSelect: "none",
                  paintOrder: "stroke",
                  stroke: "white",
                  strokeWidth: LABEL_HALO_PT,
                  strokeLinejoin: "round",
                }}
              >
                {formatHeightCutDelta(face.delta)}
              </text>
            </g>
          </g>
        ))}
    </g>
  );
}

function ringD(ring) {
  if (!ring?.length) return "";
  return `M ${ring.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
}

function getFacePathD(face) {
  return [face.points, ...(face.holes || [])].map(ringD).join(" ");
}

// Lines between faces: an edge shared by two faces is drawn once — solid
// when one of them steps on the top side, dashed when the step is on the
// bottom side only, light when both are at the main level (a trace whose
// faces have no delta yet). Border edges belong to the polygon's own stroke.
function buildEdgePaths(faces) {
  const edges = new Map();
  const key = (p) => `${Math.round(p.x * 100)}_${Math.round(p.y * 100)}`;
  for (const face of faces || []) {
    for (const ring of [face.points, ...(face.holes || [])]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const ka = key(a);
        const kb = key(b);
        if (ka === kb) continue;
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const entry = edges.get(k) ?? { a, b, faces: [] };
        entry.faces.push(face);
        edges.set(k, entry);
      }
    }
  }
  let solidD = "";
  let dashedD = "";
  let neutralD = "";
  for (const { a, b, faces: edgeFaces } of edges.values()) {
    if (edgeFaces.length < 2) continue;
    const d = `M ${a.x} ${a.y} L ${b.x} ${b.y} `;
    const stepped = edgeFaces.filter((face) => face.delta !== 0);
    if (!stepped.length) neutralD += d;
    else if (stepped.every((face) => face.side === HEIGHT_CUT_SIDE_BOTTOM))
      dashedD += d;
    else solidD += d;
  }
  return { solidD, dashedD, neutralD };
}
