import {
  Mouse,
  Rectangle,
  RadioButtonUnchecked,
  WaterDrop,
  MyLocation as Target,
  Brush,
  Insights as Smart,
  ViewDay,
} from "@mui/icons-material";

import IconPolylineClick from "Features/icons/IconPolylineClick";
import IconPolygonClick from "Features/icons/IconPolygonClick";
import IconPolylineRectangle from "Features/icons/IconPolylineRectangle";
import IconPolygonRectangle from "Features/icons/IconPolygonRectangle";
import IconPolylineCircle from "Features/icons/IconPolylineCircle";
import IconPolygonCircle from "Features/icons/IconPolygonCircle";
import IconSegmentSplit from "Features/icons/IconSegmentSplit";

import { getToolsForShape } from "Features/annotations/constants/drawingShapeConfig";

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
    key: "POLYLINE_CIRCLE",
    label: "Cercle (ligne)",
    Icon: IconPolylineCircle,
    annotationType: "POLYLINE",
    behavior: "CIRCLE",
  },
  {
    key: "POLYGON_CIRCLE",
    label: "Cercle (surface)",
    Icon: IconPolygonCircle,
    annotationType: "POLYGON",
    behavior: "CIRCLE",
  },
  {
    key: "CIRCLE",
    label: "Cercle",
    Icon: RadioButtonUnchecked,
    annotationType: null,
    behavior: "CIRCLE",
  },
  {
    key: "SURFACE_DROP",
    label: "Remplissage",
    Icon: WaterDrop,
    annotationType: "POLYGON",
    behavior: "SURFACE_DROP",
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
  // CUT tools (Ouverture)
  {
    key: "CUT_CLICK",
    label: "Ligne",
    Icon: IconPolylineClick,
    annotationType: "CUT",
    behavior: "CLICK",
  },
  {
    key: "CUT_RECTANGLE",
    label: "Rectangle",
    Icon: IconPolylineRectangle,
    annotationType: "CUT",
    behavior: "RECTANGLE",
  },
  {
    key: "CUT_CIRCLE",
    label: "Cercle",
    Icon: IconPolylineCircle,
    annotationType: "CUT",
    behavior: "CIRCLE",
  },
  // SPLIT tools (Diviser)
  {
    key: "SPLIT_CLICK",
    label: "Ligne",
    Icon: IconPolylineClick,
    annotationType: "SPLIT",
    behavior: "CLICK",
  },
  // SEGMENT_SPLIT tools (Retour technique)
  {
    key: "SEGMENT_SPLIT_CLICK",
    label: "Retour technique",
    Icon: IconSegmentSplit,
    annotationType: "SEGMENT_SPLIT",
    behavior: "SEGMENT_SPLIT",
  },
  // STRIP tool (Bande)
  {
    key: "STRIP",
    label: "Bande",
    Icon: ViewDay,
    annotationType: "STRIP",
    behavior: "STRIP",
  },
];

export const DRAWING_TOOLS_BY_TYPE = {
  CUT: ["CUT_CLICK", "CUT_RECTANGLE", "CUT_CIRCLE"],
  SPLIT: ["SPLIT_CLICK"],
  SEGMENT_SPLIT: ["SEGMENT_SPLIT_CLICK"],
};

export function getDrawingToolsByShape(drawingShape) {
  const keys = getToolsForShape(drawingShape);
  return DRAWING_TOOLS.filter((tool) => keys.includes(tool.key));
}

export function getDrawingToolByKey(key) {
  return DRAWING_TOOLS.find((tool) => tool.key === key) ?? null;
}

export function getDrawingToolsByType(type) {
  const keys = DRAWING_TOOLS_BY_TYPE[type] ?? [];
  return DRAWING_TOOLS.filter((tool) => keys.includes(tool.key));
}

export default DRAWING_TOOLS;
