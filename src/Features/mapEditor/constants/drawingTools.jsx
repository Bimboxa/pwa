import {
  Mouse,
  Rectangle,
  RadioButtonUnchecked,
  WaterDrop,
  MyLocation as Target,
  Brush,
  Insights as Smart,
  Create,
} from "@mui/icons-material";

import IconPolylineClick from "Features/icons/IconPolylineClick";
import IconPolygonClick from "Features/icons/IconPolygonClick";
import IconPolylineRectangle from "Features/icons/IconPolylineRectangle";
import IconPolygonRectangle from "Features/icons/IconPolygonRectangle";
import IconPolylineCircle from "Features/icons/IconPolylineCircle";
import IconPolygonCircle from "Features/icons/IconPolygonCircle";
import IconCutSegment from "Features/icons/IconCutSegment";
import IconSplitPolygon from "Features/icons/IconSplitPolygon";
import IconSplitPolyline from "Features/icons/IconSplitPolyline";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import IconStrip from "Features/icons/IconStrip";
import IconDetectSimilarPolylines from "Features/icons/IconDetectSimilarPolylines";

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
    label: "Couper surfaces",
    Icon: IconSplitPolygon,
    annotationType: "SPLIT",
    behavior: "CLICK",
  },
  // CUT_SEGMENT tool (Retirer segment)
  {
    key: "CUT_SEGMENT",
    label: "Retirer segment",
    Icon: IconCutSegment,
    annotationType: "CUT_SEGMENT",
    behavior: "CUT_SEGMENT",
  },
  // SPLIT_POLYLINE_CLICK tool (Couper au point — single click)
  {
    key: "SPLIT_POLYLINE_CLICK",
    label: "Couper au point",
    Icon: IconSplitPolylineClick,
    annotationType: "SPLIT_POLYLINE_CLICK",
    behavior: "SPLIT_POLYLINE_CLICK",
  },
  // SPLIT_POLYLINE tool (Couper polyligne — two clicks)
  {
    key: "SPLIT_POLYLINE",
    label: "Couper polyligne",
    Icon: IconSplitPolyline,
    annotationType: "SPLIT_POLYLINE",
    behavior: "SPLIT_POLYLINE",
  },
  // TECHNICAL_RETURN tool (Retour technique 1m)
  {
    key: "TECHNICAL_RETURN",
    label: "Retour technique 1m",
    Icon: IconTechnicalReturn,
    annotationType: "TECHNICAL_RETURN",
    behavior: "TECHNICAL_RETURN",
  },
  // STRIP tool (Bande)
  {
    key: "STRIP",
    label: "Bande",
    Icon: IconStrip,
    annotationType: "STRIP",
    behavior: "STRIP",
  },
  // DETECT_SIMILAR_POLYLINES tool (Auto-detect lines)
  {
    key: "DETECT_SIMILAR_POLYLINES",
    label: "Détection auto.",
    Icon: IconDetectSimilarPolylines,
    annotationType: "POLYLINE",
    behavior: "DETECT_SIMILAR_POLYLINES",
  },
  // COMPLETE_ANNOTATION tool (Prolonger)
  {
    key: "COMPLETE_ANNOTATION",
    label: "Prolonger",
    Icon: Create,
    annotationType: "COMPLETE_ANNOTATION",
    behavior: "CLICK",
  },
];

export const DRAWING_TOOLS_BY_TYPE = {
  CUT: ["CUT_RECTANGLE", "CUT_CLICK", "CUT_CIRCLE"],
  SPLIT_LINE: ["SPLIT_POLYLINE_CLICK", "CUT_SEGMENT", "SPLIT_POLYLINE"],
  SPLIT_SURFACE: ["SPLIT_CLICK"],
  TECHNICAL_RETURN: ["TECHNICAL_RETURN"],
  COMPLETE_ANNOTATION: ["COMPLETE_ANNOTATION"],
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
  return keys.map((k) => DRAWING_TOOLS.find((t) => t.key === k)).filter(Boolean);
}

export default DRAWING_TOOLS;
