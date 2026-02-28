import { useMemo } from "react";

import { Box } from "@mui/material";

import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";

export default function AnnotationTemplateIcon({ template, size = 20 }) {
  // helpers

  const shape = template.drawingShape ?? template.type;
  const shapeType = resolveShapeCategory(shape);
  const color =
    shapeType === "polyline"
      ? (template.strokeColor ?? template.fillColor ?? "#999")
      : (template.fillColor ?? template.strokeColor ?? "#999");
  const opacity =
    shapeType === "polyline"
      ? (template.strokeOpacity ?? 1)
      : (template.fillOpacity ?? 1);
  const fillType = template.fillType;

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
          <circle cx="10" cy="10" r="7" fill={color} opacity={opacity} />
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
            opacity={opacity}
          />
        )}
        {shapeType === "rectangle" && !isHatching && (
          <rect x="2" y="3" width="16" height="14" rx="2" fill={color} opacity={opacity} />
        )}
        {shapeType === "rectangle" && isHatching && (
          <g opacity={opacity}>
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
          </g>
        )}
      </svg>
    </Box>
  );
}
