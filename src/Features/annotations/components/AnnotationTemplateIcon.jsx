import { useMemo } from "react";

import { Box } from "@mui/material";

import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

export default function AnnotationTemplateIcon({ template, size = 20, spriteImage }) {
  // helpers

  const shape = resolveDrawingShape(template);
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

  // helpers - light color detection

  const isLightColor = useMemo(() => {
    if (!color) return false;
    const hex = color.replace("#", "");
    if (hex.length < 6) return false;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.85;
  }, [color]);

  // helpers - hatching

  const isHatching = fillType === "HATCHING" || fillType === "HATCHING_LEFT";
  const hatchingAngle = fillType === "HATCHING_LEFT" ? -45 : 45;

  const patternId = useMemo(() => {
    if (!isHatching) return null;
    return `hatching-${Math.random().toString(36).slice(2, 8)}`;
  }, [isHatching]);

  // helpers - sprite

  const hasSprite = shapeType === "circle" && spriteImage?.url && template.iconKey;
  const spriteOffset = useMemo(() => {
    if (!hasSprite) return null;
    const { iconKeys, columns, tile } = spriteImage;
    const index = iconKeys?.indexOf(template.iconKey);
    if (index == null || index < 0) return null;
    const col = index % columns;
    const row = Math.floor(index / columns);
    return { x: col * tile, y: row * tile, tile };
  }, [hasSprite, spriteImage, template.iconKey]);

  // render — IMAGE template: show image preview or image icon
  if (shape === "IMAGE") {
    const imgUrl = template.image?.imageUrlClient;
    if (imgUrl) {
      return (
        <Box
          sx={{
            width: size,
            height: size,
            flexShrink: 0,
            borderRadius: 0.5,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            component="img"
            src={imgUrl}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </Box>
      );
    }
    return (
      <Box sx={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="2" y="3" width="16" height="14" rx="2" fill="none" stroke="#999" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="2" fill="#999" />
          <polyline points="2,15 7,10 11,14 14,11 18,15" fill="none" stroke="#999" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </Box>
    );
  }

  // render — LABEL template: rectangle with text inside
  if (shape === "LABEL") {
    return (
      <Box sx={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size} height={size} viewBox="0 0 20 20">
          <rect x="1" y="4" width="18" height="12" rx="2" fill={color} opacity={opacity}
            stroke={isLightColor ? "#bbb" : "none"} strokeWidth={isLightColor ? 1 : 0} />
          <text x="10" y="13" textAnchor="middle" fontSize="7" fontWeight="bold" fill={isLightColor ? "#666" : "#fff"} fontFamily="sans-serif">Ab</text>
        </svg>
      </Box>
    );
  }

  if (hasSprite && spriteOffset) {
    const { url, columns, rows, tile } = spriteImage;
    const scale = (size - 8) / tile;
    const spriteW = columns * tile;
    const spriteH = rows * tile;
    return (
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          bgcolor: color,
          opacity,
        }}
      >
        <Box
          sx={{
            width: size,
            height: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box>
            <Box
              sx={{
                width: tile,
                height: tile,
                backgroundImage: `url(${url})`,
                backgroundPosition: `-${spriteOffset.x}px -${spriteOffset.y}px`,
                backgroundSize: `${spriteW}px ${spriteH}px`,
                backgroundRepeat: "no-repeat",
                transform: `scale(${scale})`,
                transformOrigin: "center",
              }}
            />
          </Box>
        </Box>
      </Box>
    );
  }

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
          <circle cx="10" cy="10" r="7" fill={color} opacity={opacity}
            stroke={isLightColor ? "#bbb" : "none"} strokeWidth={isLightColor ? 1 : 0} />
        )}
        {shapeType === "polyline" && isLightColor && (
          <line
            x1="2"
            y1="10"
            x2="18"
            y2="10"
            stroke="#bbb"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
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
          <rect x="2" y="3" width="16" height="14" rx="2" fill={color} opacity={opacity}
            stroke={isLightColor ? "#bbb" : "none"} strokeWidth={isLightColor ? 1 : 0} />
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
