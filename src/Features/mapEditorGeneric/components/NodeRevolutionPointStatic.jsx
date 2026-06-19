import React, { useMemo } from "react";
import { darken } from "@mui/material/styles";

// Plan-view revolution axis marker: a cross inside a circle of fixed 24px
// radius, invariant to map zoom (FIXED_IN_SCREEN). It positions a REVOLUTION
// axis in the horizontal plane so the matching elevation arc revolves around it.
const RADIUS_PX = 24;
const CROSS_PX = 18;
const DEFAULT_COLOR = "#9c27b0";

export default function NodeRevolutionPointStatic({
  annotation,
  annotationOverride, // transient drag override
  selected,
  hovered,
  dragged,
  containerK = 1,
}) {
  const mergedAnnotation = { ...annotation, ...annotationOverride };

  const { id, listingId, fillColor } = mergedAnnotation;

  // Robust position handling (drag puts x/y at root, DB stores point.x/point.y).
  const currentX = mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0;
  const currentY = mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0;

  // Zoom-invariant scale: keeps the marker at a constant screen size whatever
  // the current map zoom (mirrors NodeMarkerStatic's FIXED_IN_SCREEN variant).
  const scaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const color = useMemo(() => {
    const base = fillColor || DEFAULT_COLOR;
    if (hovered || selected) {
      try {
        return darken(base, 0.2);
      } catch {
        return base;
      }
    }
    return base;
  }, [fillColor, hovered, selected]);

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "REVOLUTION_POINT",
    "data-interaction": "draggable",
  };

  return (
    <g
      transform={`translate(${currentX}, ${currentY})`}
      style={{
        cursor: dragged ? "grabbing" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      <g style={{ transform: scaleTransform }}>
        {/* Outer circle */}
        <circle
          cx={0}
          cy={0}
          r={RADIUS_PX}
          fill="transparent"
          stroke={color}
          strokeWidth={selected ? 3 : 2}
          vectorEffect="non-scaling-stroke"
        />
        {/* Cross */}
        <line
          x1={-CROSS_PX}
          y1={0}
          x2={CROSS_PX}
          y2={0}
          stroke={color}
          strokeWidth={selected ? 3 : 2}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={0}
          y1={-CROSS_PX}
          x2={0}
          y2={CROSS_PX}
          stroke={color}
          strokeWidth={selected ? 3 : 2}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </g>
  );
}
