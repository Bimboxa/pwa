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
  SsidChart as IsoHeightLineIcon,
  ShowChart as ProfileLineIcon,
  NorthEast as RampIcon,
  AutoFixHigh as LocalizedRepairIcon,
  Adjust as RevolutionPlacementIcon,
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
import IconIsolateSegment from "Features/icons/IconIsolateSegment";
import IconSplitPolygon from "Features/icons/IconSplitPolygon";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import RotateRightIcon from "@mui/icons-material/RotateRight";

import IconSplitPolyline from "Features/icons/IconSplitPolyline";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconJoinAnnotations from "Features/icons/IconJoinAnnotations";
import IconTechnicalReturn from "Features/icons/IconTechnicalReturn";
import IconStrip from "Features/icons/IconStrip";

import { getToolsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { MESH_BRUSH_TOOL_KEY } from "Features/meshPaint/constants/meshPaintConstants";

import filterDrawingToolsForEditor from "../utils/filterDrawingToolsForEditor";

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
  // ISOLATE_SEGMENT tool (Isoler un segment — Features/isolateSegment): a
  // click on a segment cuts the polyline / strip at both of its ends. Same
  // pointer / hit-testing behavior as CUT_SEGMENT (segment-select mode).
  {
    key: "ISOLATE_SEGMENT",
    label: "Isoler un segment",
    Icon: IconIsolateSegment,
    annotationType: "ISOLATE_SEGMENT",
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
  // FACE_CUT tools (Coupe face — 3D editor): the path drawn on a face cuts
  // it in two (threedFaceCut).
  {
    key: "FACE_CUT_SEGMENT",
    label: "Segment (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "FACE_CUT",
    behavior: "SEGMENT",
  },
  {
    key: "FACE_CUT_POLYLINE",
    label: "Polyligne clic",
    Icon: IconPolylineClick,
    annotationType: "FACE_CUT",
    behavior: "CLICK",
  },
  // SURFACE_CUT tools (Couper une surface — 2D editor): the trace cuts the
  // surfaces it runs across into one annotation per piece (surfaceCut). They
  // draw like a POLYLINE segment / polyline (interaction borrowed through
  // `drawingMode`) while the draft keeps the SURFACE_CUT type.
  {
    key: "SURFACE_CUT_SEGMENT",
    label: "Segment (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "SURFACE_CUT",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
  },
  {
    key: "SURFACE_CUT_POLYLINE",
    label: "Polyligne clic",
    Icon: IconPolylineClick,
    annotationType: "SURFACE_CUT",
    behavior: "CLICK",
    drawingMode: "POLYLINE_CLICK",
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
  // RULER tools — a dimension chain draws exactly like a POLYLINE, so they
  // delegate the interaction to the POLYLINE modes via `drawingMode` while
  // keeping their own annotation type through the commit (same pattern as
  // REVOLUTION_AXIS_PLAN below).
  {
    key: "RULER_CLICK",
    label: "Règle (clics)",
    Icon: IconPolylineClick,
    annotationType: "RULER",
    behavior: "CLICK",
    drawingMode: "POLYLINE_CLICK",
  },
  {
    key: "RULER_SEGMENT",
    label: "Règle (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "RULER",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
  },
  // LINEAR_LAYOUT tool — a calepinage band draws as a plain 2-point segment
  // (the bottom edge of the band), so it delegates the interaction to the
  // POLYLINE_SEGMENT mode while keeping its own annotation type through the
  // commit (same pattern as RULER_SEGMENT above).
  {
    key: "LINEAR_LAYOUT_SEGMENT",
    label: "Calepinage (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "LINEAR_LAYOUT",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
  },
  // BASE_MAP_LINK tool — a section mark is a plain 2-point segment, so it
  // borrows the POLYLINE_SEGMENT interaction while keeping its own type
  // through the commit (same pattern as LINEAR_LAYOUT_SEGMENT above).
  {
    key: "BASE_MAP_LINK_SEGMENT",
    label: "Coupe (2 clics)",
    Icon: IconPolylineSegment,
    annotationType: "BASE_MAP_LINK",
    behavior: "SEGMENT",
    drawingMode: "POLYLINE_SEGMENT",
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
  // ADD_ISO_HEIGHT_LINE tool — draw an isoHeightLine (constant-height contour
  // line) on the selected POLYGON. Multi-click, finish with Enter, cancel with
  // Escape.
  {
    key: "ADD_ISO_HEIGHT_LINE",
    label: "Ajouter une courbe de niveau",
    Icon: IsoHeightLineIcon,
    annotationType: "ISO_HEIGHT_LINE",
    behavior: "CLICK",
  },
  // ADD_PROFILE_LINE tool — draw a profile polyline (shell cross-section) on
  // the selected POLYGON. Multi-click, finish with Enter, cancel with Escape.
  // The vertical projection is then edited in the Élévation panel.
  {
    key: "ADD_PROFILE_LINE",
    label: "Ajouter un profil",
    Icon: ProfileLineIcon,
    annotationType: "PROFILE_LINE",
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
  // JOIN_ANNOTATIONS tool (Joindre) — draw a selection rectangle (2 clicks)
  // around wall ends; they are extended / shortened along their own segment
  // so the walls connect (see useHandleJoinAnnotationsRect).
  {
    key: "JOIN_ANNOTATIONS",
    label: "Joindre",
    Icon: IconJoinAnnotations,
    annotationType: "JOIN_ANNOTATIONS",
    behavior: "JOIN_ANNOTATIONS",
  },
  // MOVE_ANNOTATION / ROTATE_ANNOTATION tools (Déplacer / Tourner) — click a
  // point of an annotation, then move / rotate it relative to that point
  // (Features/annotationTransform). The 3D editor has its own modes
  // (threedAnnotationMove).
  {
    key: "MOVE_ANNOTATION",
    label: "Déplacer",
    Icon: OpenWithIcon,
    annotationType: "MOVE_ANNOTATION",
    behavior: "MOVE_ANNOTATION",
  },
  {
    key: "ROTATE_ANNOTATION",
    label: "Tourner",
    Icon: RotateRightIcon,
    annotationType: "ROTATE_ANNOTATION",
    behavior: "ROTATE_ANNOTATION",
  },
  // CHAT_REPAIR (chat « Réparation ») — same 2-click selection rectangle; the
  // zone is stored in mapEditor.chatRepairZone and the mode exits at once. The
  // chat panel then sends the zone to the relay for a deterministic repair.
  {
    key: "CHAT_REPAIR",
    label: "Zone de réparation",
    Icon: IconJoinAnnotations,
    annotationType: "CHAT_REPAIR",
    behavior: "CHAT_REPAIR",
  },
  // REVOLUTION axis helpers — the geometry that defines a REVOLUTION shape3D.
  // Both tools are armed from the "Axe de révolution" drawing tool row and
  // the revolution axes section (Features/revolutionAxes — the drafts carry
  // no template, an axis belongs to its base map + scope): the axis is
  // authored on the PLAN with 2 clicks (centre → radius + orientation,
  // reusing the CIRCLE_RADIUS interaction but NOT its commit, which
  // polygonizes into a ring); on a VERTICAL base map an existing axis is
  // dropped with a single click, which re-poses that base map in 3D. Both
  // keep their own annotation `type` through the commit (see
  // useHandleCommitDrawing) and are NOT openings.
  {
    key: "REVOLUTION_AXIS_PLAN",
    label: "Cercle centre/rayon",
    Icon: IconPolylineCircleRadius,
    annotationType: "REVOLUTION_AXIS",
    behavior: "CIRCLE_RADIUS",
    drawingMode: "REVOLUTION_AXIS_PLAN",
  },
  {
    key: "REVOLUTION_AXIS_PLACE",
    label: "Position de l'axe",
    Icon: RevolutionPlacementIcon,
    annotationType: "REVOLUTION_AXIS_PLACEMENT",
    behavior: "ONE_CLICK",
    drawingMode: "REVOLUTION_AXIS_PLACEMENT",
  },
  // MESH_BRUSH tool (« Pinceau », Dessin module 3D editor only): a click on a
  // 3D annotation object paints the clicked facet side (Surface template) or
  // edge (Ligne template) with the armed template — db.meshPaints, see
  // Features/meshPaint. 3D-only (`editor`), so the editor-filtered lists
  // never offer it in 2D nor as a template's defaultTool; never offered to a
  // template-less draft (`requiresTemplate`). The draft keeps the template's
  // type (annotationType null). Distinct from the 2D "BRUSH" key, which the
  // hidden 2D InteractionLayer reacts to (raster mask → polygons). Kept last
  // so it shows at the end of the POLYGON / POLYLINE tool lists.
  {
    key: MESH_BRUSH_TOOL_KEY,
    label: "Pinceau",
    Icon: Brush,
    annotationType: null,
    behavior: "MESH_BRUSH",
    editor: "3D",
    requiresTemplate: true,
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
  ISOLATE_SEGMENT: ["ISOLATE_SEGMENT"],
  SPLIT_POLYLINE_CLICK: ["SPLIT_POLYLINE_CLICK"],
  FACE_CUT: ["FACE_CUT_SEGMENT", "FACE_CUT_POLYLINE"],
  SURFACE_CUT: ["SURFACE_CUT_SEGMENT", "SURFACE_CUT_POLYLINE"],
  SPLIT_SURFACE: ["SPLIT_CLICK"],
  TECHNICAL_RETURN: ["TECHNICAL_RETURN"],
  COMPLETE_ANNOTATION: ["COMPLETE_ANNOTATION"],
  ADD_INNER_POINT: ["ADD_INNER_POINT"],
  GUIDE_LINE: ["ADD_GUIDE_LINE"],
  ISO_HEIGHT_LINE: ["ADD_ISO_HEIGHT_LINE"],
  PROFILE_LINE: ["ADD_PROFILE_LINE"],
  LOCALIZED_REPAIR: ["LOCALIZED_REPAIR"],
  JOIN_ANNOTATIONS: ["JOIN_ANNOTATIONS"],
  MOVE_ANNOTATION: ["MOVE_ANNOTATION"],
  ROTATE_ANNOTATION: ["ROTATE_ANNOTATION"],
  CHAT_REPAIR: ["CHAT_REPAIR"],
};

// Tools of a drawing shape (DRAWING_TOOLS order), filtered for the editor
// that offers them (filterDrawingToolsForEditor): options.editor "2D"
// (default) | "3D" — see selectDrawingToolsEditor — and options.templateless
// (draft without annotation template).
export function getDrawingToolsByShape(
  drawingShape,
  { editor = "2D", templateless = false } = {}
) {
  const keys = getToolsForShape(drawingShape);
  return filterDrawingToolsForEditor(
    DRAWING_TOOLS.filter((tool) => keys.includes(tool.key)),
    { editor, templateless }
  );
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
