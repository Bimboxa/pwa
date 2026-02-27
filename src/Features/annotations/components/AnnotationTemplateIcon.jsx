import { useMemo } from "react";

import { Box } from "@mui/material";

export default function AnnotationTemplateIcon({ template, size = 20 }) {
  // helpers

  const shape = template.drawingShape ?? template.type;
  const color =
    template.drawingColor ??
    template.fillColor ??
    template.strokeColor ??
    "#999";
  const fillType = template.drawingFillType ?? template.fillType;

  // helpers - resolve shape category

  let shapeType = "circle";
  if (
    shape === "POLYLINE_2D" ||
    shape === "POLYLINE" ||
    shape === "STRIP"
  ) {
    shapeType = "polyline";
  } else if (
    shape === "SURFACE_2D" ||
    shape === "POLYGON" ||
    shape === "RECTANGLE"
  ) {
    shapeType = "rectangle";
  }

  // helpers - hatching

  const isHatching = fillType === "HATCHING" || fillType === "HATCHING_LEFT";
  const hatchingAngle = fillType === "HATCHING_LEFT" ? -45 : 45;

  const patternId = useMemo(() => {
    if (!isHatching) return null;
    return `hatching-${Math.random().toString(36).slice(2, 8)}`;
  }, [isHatching]);

  // render

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 20 20">
        {isHatching && (
          <defs>
            <pattern
              id={patternId}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${hatchingAngle})`}
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="4"
                stroke={color}
                strokeWidth="1.5"
              />
            </pattern>
          </defs>
        )}

        {shapeType === "circle" && (
          <circle cx="10" cy="10" r="7" fill={color} />
        )}
        {shapeType === "polyline" && (
          <line
            x1="2"
            y1="10"
            x2="18"
            y2="10"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        )}
        {shapeType === "rectangle" && !isHatching && (
          <rect x="2" y="3" width="16" height="14" rx="2" fill={color} />
        )}
        {shapeType === "rectangle" && isHatching && (
          <>
            <rect
              x="2"
              y="3"
              width="16"
              height="14"
              rx="2"
              fill={`url(#${patternId})`}
            />
            <rect
              x="2"
              y="3"
              width="16"
              height="14"
              rx="2"
              fill="none"
              stroke={color}
              strokeWidth="1"
            />
          </>
        )}
      </svg>
    </Box>
  );
}
