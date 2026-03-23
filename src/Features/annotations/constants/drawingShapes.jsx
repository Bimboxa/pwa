import { SvgIcon } from "@mui/material";
import { getShapeCategory } from "./drawingShapeConfig";

const DRAWING_SHAPES = [
  {
    key: "MARKER",
    label: "Repère",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <path
          d="M10 2C6.7 2 4 4.7 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6zm0 8.5c-1.4 0-2.5-1.1-2.5-2.5S8.6 5.5 10 5.5s2.5 1.1 2.5 2.5S11.4 10.5 10 10.5z"
          fill="currentColor"
        />
      </SvgIcon>
    ),
  },
  {
    key: "POINT",
    label: "Point",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="currentColor" />
      </SvgIcon>
    ),
  },
  {
    key: "LABEL",
    label: "Étiquette",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <rect
          x="2"
          y="5"
          width="16"
          height="10"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text
          x="10"
          y="13"
          textAnchor="middle"
          fontSize="8"
          fill="currentColor"
        >
          Ab
        </text>
      </SvgIcon>
    ),
  },
  {
    key: "POLYLINE",
    label: "Ligne",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <line
          x1="2"
          y1="10"
          x2="18"
          y2="10"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </SvgIcon>
    ),
  },
  {
    key: "POLYGON",
    label: "Surface",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <rect
          x="2"
          y="3"
          width="16"
          height="14"
          rx="2"
          fill="currentColor"
        />
      </SvgIcon>
    ),
  },
];

export function resolveShapeCategory(shape) {
  // Delegate to config for known shapes, handle legacy values
  const category = getShapeCategory(shape);
  if (category) return category;

  // Legacy fallbacks
  if (shape === "POLYLINE_2D" || shape === "STRIP") return "polyline";
  if (shape === "SURFACE_2D" || shape === "RECTANGLE") return "rectangle";
  if (shape === "POINT_2D") return "circle";

  return "circle";
}

export default DRAWING_SHAPES;
