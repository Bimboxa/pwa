import {
  Mouse,
  Rectangle,
  RadioButtonUnchecked,
  WaterDrop,
  MyLocation as Target,
  Brush,
  Insights as Smart,
} from "@mui/icons-material";

import IconPolylineClick from "Features/icons/IconPolylineClick";
import IconPolygonClick from "Features/icons/IconPolygonClick";
import IconPolylineRectangle from "Features/icons/IconPolylineRectangle";
import IconPolygonRectangle from "Features/icons/IconPolygonRectangle";

const DRAWING_TOOLS = [
  {
    key: "ONE_CLICK",
    label: "1 Clic",
    Icon: Target,
    annotationType: null, // determined by annotationTemplate
    behavior: "ONE_CLICK",
  },
  {
    key: "POLYLINE_CLICK",
    label: "Polyligne clic",
    Icon: IconPolylineClick,
    annotationType: "POLYLINE",
    behavior: "CLICK",
  },
  {
    key: "POLYGON_CLICK",
    label: "Polygone clic",
    Icon: IconPolygonClick,
    annotationType: "POLYGON",
    behavior: "CLICK",
  },
  {
    key: "CLICK",
    label: "Clic",
    Icon: Mouse,
    annotationType: null,
    behavior: "CLICK",
  },
  {
    key: "POLYLINE_RECTANGLE",
    label: "Rectangle (ligne)",
    Icon: IconPolylineRectangle,
    annotationType: "POLYLINE",
    behavior: "RECTANGLE",
  },
  {
    key: "POLYGON_RECTANGLE",
    label: "Rectangle (surface)",
    Icon: IconPolygonRectangle,
    annotationType: "POLYGON",
    behavior: "RECTANGLE",
  },
  {
    key: "RECTANGLE",
    label: "Rectangle",
    Icon: Rectangle,
    annotationType: null,
    behavior: "RECTANGLE",
  },
  {
    key: "CIRCLE",
    label: "Cercle",
    Icon: RadioButtonUnchecked,
    annotationType: null,
    behavior: "CIRCLE",
  },
  {
    key: "DROP_FILL",
    label: "Remplissage",
    Icon: WaterDrop,
    annotationType: null,
    behavior: "DROP_FILL",
  },
  {
    key: "BRUSH",
    label: "Brush",
    Icon: Brush,
    annotationType: null,
    behavior: "BRUSH",
  },
  {
    key: "SMART_DETECT",
    label: "Détection automatique",
    Icon: Smart,
    annotationType: null,
    behavior: "SMART_DETECT",
  },
];

export const DRAWING_TOOLS_BY_SHAPE = {
  POINT_2D: ["ONE_CLICK"],
  POLYLINE_2D: ["POLYLINE_CLICK", "POLYLINE_RECTANGLE", "CIRCLE"],
  SURFACE_2D: ["POLYGON_CLICK", "POLYGON_RECTANGLE", "CIRCLE", "DROP_FILL"],
};

export function getDrawingToolsByShape(drawingShape) {
  const keys = DRAWING_TOOLS_BY_SHAPE[drawingShape] ?? [];
  return DRAWING_TOOLS.filter((tool) => keys.includes(tool.key));
}

export function getDrawingToolByKey(key) {
  return DRAWING_TOOLS.find((tool) => tool.key === key) ?? null;
}

export default DRAWING_TOOLS;
