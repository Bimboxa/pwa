import { SvgIcon } from "@mui/material";

const DRAWING_SHAPES = [
  {
    key: "POINT_2D",
    label: "Point",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7" fill="currentColor" />
      </SvgIcon>
    ),
  },
  {
    key: "POLYLINE_2D",
    label: "Line",
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
    key: "SURFACE_2D",
    label: "Surface",
    icon: (
      <SvgIcon fontSize="small" viewBox="0 0 20 20">
        <rect x="2" y="3" width="16" height="14" rx="2" fill="currentColor" />
      </SvgIcon>
    ),
  },
];

export function resolveShapeCategory(shape) {
  if (
    shape === "POLYLINE_2D" ||
    shape === "POLYLINE" ||
    shape === "STRIP"
  ) {
    return "polyline";
  }
  if (
    shape === "SURFACE_2D" ||
    shape === "POLYGON" ||
    shape === "RECTANGLE"
  ) {
    return "rectangle";
  }
  return "circle";
}

export default DRAWING_SHAPES;
