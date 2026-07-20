import {
  Mouse,
  Rectangle,
  RadioButtonUnchecked,
  WaterDrop,
  MyLocation as Target,
  Brush,
  Insights as Smart,
  Create,
  AddLocationAlt as AddInnerPoint,
  Straighten,
  Timeline as GuideLineIcon,
  NorthEast as RampIcon,
  AutoFixHigh as LocalizedRepairIcon,
  Height as RevolutionAxisIcon,
  Adjust as RevolutionPointIcon,
} from "@mui/icons-material";

import IconPolylineClick from "Features/icons/IconPolylineClick";
import IconPolylineSegment from "Features/icons/IconPolylineSegment";
import IconStripSegment from "Features/icons/IconStripSegment";
import IconPolygonClick from "Features/icons/IconPolygonClick";
import IconPolylineRectangle from "Features/icons/IconPolylineRectangle";
import IconPolygonRectangle from "Features/icons/IconPolygonRectangle";
import IconPolylineCircle from "Features/icons/IconPolylineCircle";
import IconPolygonCircle from "Features/icons/IconPolygonCircle";
import IconPolylineCircleRadius from "Features/icons/IconPolylineCircleRadius";
import IconPolygonCircleRadius from "Features/icons/IconPolygonCircleRadius";
import IconPolylineArc from "Features/icons/IconPolylineArc";
import IconCutSegment from "Features/icons/IconCutSegment";
import IconSplitPolygon from "Features/icons/IconSplitPolygon";
import IconSplitPolyline from "Features/icons/IconSplitPolyline";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import IconStrip from "Features/icons/IconStrip";

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
    key: "POLYLINE_SEGMENT",
    label: "Segment (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "POLYLINE",
    behavior: "SEGMENT",
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
    key: "POLYLINE_CIRCLE_RADIUS",
    label: "Cercle centre/rayon (ligne)",
    Icon: IconPolylineCircleRadius,
    annotationType: "POLYLINE",
    behavior: "CIRCLE_RADIUS",
  },
  {
    key: "POLYLINE_ARC",
    label: "Arc de cercle (ligne)",
    Icon: IconPolylineArc,
    annotationType: "POLYLINE",
    behavior: "ARC",
  },
  {
    key: "POLYGON_CIRCLE",
    label: "Cercle (surface)",
    Icon: IconPolygonCircle,
    annotationType: "POLYGON",
    behavior: "CIRCLE",
  },
  {
    key: "POLYGON_CIRCLE_RADIUS",
    label: "Cercle centre/rayon (surface)",
    Icon: IconPolygonCircleRadius,
    annotationType: "POLYGON",
    behavior: "CIRCLE_RADIUS",
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
    label: "Polyligne fermée",
    Icon: IconPolygonClick,
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
  // CUT-from-centerline tools (Ouverture). They draw exactly like a normal
  // POLYLINE / STRIP (so they reuse the existing interaction modes via
  // `drawingMode`) and keep their real annotation `type` during drawing; the
  // `isOpening` flag makes the commit polygonize the drawn centerline into a
  // band contour and apply it as the opening polygon.
  {
    key: "CUT_POLYLINE",
    label: "Polyligne",
    Icon: IconPolylineClick,
    annotationType: "POLYLINE",
    behavior: "CLICK",
    drawingMode: "POLYLINE_CLICK",
    isOpening: true,
  },
  {
    key: "CUT_POLYLINE_SEGMENT",
    label: "Polyligne (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "POLYLINE",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
    isOpening: true,
  },
  {
    key: "CUT_STRIP",
    label: "Bande",
    Icon: IconStrip,
    annotationType: "STRIP",
    behavior: "STRIP",
    drawingMode: "STRIP",
    isOpening: true,
  },
  {
    key: "CUT_STRIP_SEGMENT",
    label: "Bande (2 clics)",
    Icon: IconStripSegment,
    annotationType: "STRIP",
    behavior: "SEGMENT",
    drawingMode: "STRIP_SEGMENT",
    isOpening: true,
  },
  // OPENING_SEGMENT tool — template-driven opening placement. The preview is a
  // fixed-length segment (template width in meters) with one endpoint under
  // the mouse; near a host POLYLINE/POLYGON edge it glues along the wall, away
  // from any host it places freely (R rotates by 45°, S swaps the held
  // endpoint). One click commits in both cases.
  {
    key: "OPENING_SEGMENT",
    label: "Ouverture (1 clic)",
    Icon: IconPolylineSegment,
    annotationType: "POLYLINE",
    behavior: "OPENING_SEGMENT",
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
  // SPLIT_POLYLINE_CLICK tool (Couper un segment — single click)
  {
    key: "SPLIT_POLYLINE_CLICK",
    label: "Couper un segment",
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
  // STRIP_SEGMENT tool (Bande — auto-commit on the 2nd click)
  {
    key: "STRIP_SEGMENT",
    label: "Bande (2 clics)",
    Icon: IconStripSegment,
    annotationType: "STRIP",
    behavior: "SEGMENT",
  },
  // Note: the former STRIP_DETECTION, SEGMENT_DETECTION and
  // DETECT_SIMILAR_POLYLINES tools have been
  // merged into STRIP and POLYLINE_CLICK respectively — activation is now
  // driven by the unified smart-detect switch (CardSmartDetect).
  // COMPLETE_ANNOTATION tool (Prolonger)
  {
    key: "COMPLETE_ANNOTATION",
    label: "Prolonger",
    Icon: Create,
    annotationType: "COMPLETE_ANNOTATION",
    behavior: "CLICK",
  },
  // ADD_INNER_POINT tool — drop a Steiner point inside a polygon (used to
  // deform the slanted top face in 3D via offsetBottom / offsetTop).
  {
    key: "ADD_INNER_POINT",
    label: "Ajouter un point",
    Icon: AddInnerPoint,
    annotationType: "ADD_INNER_POINT",
    behavior: "CLICK",
  },
  {
    key: "COTE_TWO_CLICK",
    label: "Cote (2 clics)",
    Icon: Straighten,
    annotationType: "COTE",
    behavior: "TWO_CLICK",
  },
  // ADD_GUIDE_LINE tool — draw a guideLine polyline on the selected
  // annotation (the ramp gradient axis + slope arrow). Multi-click, finish
  // with Enter, cancel with Escape.
  {
    key: "ADD_GUIDE_LINE",
    label: "Ajouter une ligne guide",
    Icon: GuideLineIcon,
    annotationType: "GUIDE_LINE",
    behavior: "CLICK",
  },
  // RAMP tool (Rampe) — draw a median line, commit a centered band POLYGON
  // whose slope is derived from a delta-H value. The drawn line is stored as a
  // guideLine on the polygon so the slope renders in 2D and ramps in 3D.
  // Kept last so it shows at the end of the POLYGON tool list.
  {
    key: "RAMP",
    label: "Rampe",
    Icon: RampIcon,
    annotationType: "POLYGON",
    behavior: "RAMP",
  },
  // LOCALIZED_REPAIR tool — draw a selection rectangle (2 clicks) over a noisy
  // L/T junction or zone; the algo proposes a repair (flashing green) committed
  // with Space. See Features/localizedRepair.
  {
    key: "LOCALIZED_REPAIR",
    label: "Réparation localisée",
    Icon: LocalizedRepairIcon,
    annotationType: "LOCALIZED_REPAIR",
    behavior: "LOCALIZED_REPAIR",
  },
  // REVOLUTION axis helpers — draw the geometry that defines a REVOLUTION
  // shape3D. The elevation-view axis is a straight 2-click line (reuses the
  // POLYLINE_SEGMENT interaction); the plan-view axis is a single-click point
  // (reuses the ONE_CLICK interaction). They keep their own annotation `type`
  // through the commit (see useHandleCommitDrawing) and are NOT openings.
  {
    key: "REVOLUTION_AXIS_LINE",
    label: "Axe (vue élévation)",
    Icon: RevolutionAxisIcon,
    annotationType: "REVOLUTION_AXIS",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
  },
  {
    key: "REVOLUTION_POINT_MARK",
    label: "Axe (vue en plan)",
    Icon: RevolutionPointIcon,
    annotationType: "REVOLUTION_POINT",
    behavior: "ONE_CLICK",
    drawingMode: "ONE_CLICK",
  },
];

export const DRAWING_TOOLS_BY_TYPE = {
  CUT: [
    "CUT_CLICK",
    "CUT_RECTANGLE",
    "CUT_CIRCLE",
    "CUT_POLYLINE",
    "CUT_POLYLINE_SEGMENT",
    "CUT_STRIP",
    "CUT_STRIP_SEGMENT",
  ],
  SPLIT_LINE: ["CUT_SEGMENT"],
  SPLIT_POLYLINE_CLICK: ["SPLIT_POLYLINE_CLICK"],
  SPLIT_SURFACE: ["SPLIT_CLICK"],
  TECHNICAL_RETURN: ["TECHNICAL_RETURN"],
  COMPLETE_ANNOTATION: ["COMPLETE_ANNOTATION"],
  ADD_INNER_POINT: ["ADD_INNER_POINT"],
  GUIDE_LINE: ["ADD_GUIDE_LINE"],
  LOCALIZED_REPAIR: ["LOCALIZED_REPAIR"],
  REVOLUTION: ["REVOLUTION_AXIS_LINE", "REVOLUTION_POINT_MARK"],
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
  return keys
    .map((k) => DRAWING_TOOLS.find((t) => t.key === k))
    .filter(Boolean);
}

export function getDrawingToolTypeByKey(key) {
  return (
    Object.keys(DRAWING_TOOLS_BY_TYPE).find((type) =>
      DRAWING_TOOLS_BY_TYPE[type].includes(key)
    ) ?? null
  );
}

export default DRAWING_TOOLS;
