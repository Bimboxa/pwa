import {
  Adjust,
  Draw,
  Height,
  OpenWith,
  RotateRight,
  StopCircle,
} from "@mui/icons-material";
import IconCutLine from "Features/icons/IconCutLine";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconJoinAnnotations from "Features/icons/IconJoinAnnotations";
import IconSplitPolygon from "Features/icons/IconSplitPolygon";
import IconCutSurface from "Features/icons/IconCutSurface";
import IconIsolateSegment from "Features/icons/IconIsolateSegment";

// TODO: clean up the code behind the drawing tools removed from this UI list
// (SPLIT_SURFACE "Couper des surfaces", TECHNICAL_RETURN "Retour 1m",
// ADD_INNER_POINT "Ajouter un point", LOCALIZED_REPAIR "Réparation localisée",
// COMPLETE_ANNOTATION "Prolonger").
// Once confirmed unused elsewhere, drop their interaction handlers / drawing
// modes / hooks and the REPAIR_MODES / SectionRepairModes wiring.
//
// isTemplatelessDraw: "Dessin" row — draws an annotation with no template nor
// listing (RowTemplatelessDraw / useTemplatelessDrawHotkey), not a tool group.
//
// editor: the only editor of the Dessin module the row is offered in ("2D":
// the plan, "3D": its 3D editor) — no editor: both. getToolItemsForEditor.
//
// isRevolutionAxis: "Axe de révolution" row — draws a revolution axis on a
// plan / drops one on a vertical base map (RowRevolutionAxisTool); in the 3D
// editor it draws the axis on a horizontal base map plane. The axis belongs
// to the base map + the scope, not to a listing. Its hotkey (A — 2D plan base
// maps and the 3D editor) is useRevolutionAxisHotkey.
//
// threedTool: in the 3D editor the row arms a threedEditor mode (Extruder /
// Déplacer / Tourner / Isoler une face — RowThreedTool,
// selectActiveThreedTool) instead of a DRAWING_TOOLS group. In 2D,
// "Déplacer" / "Tourner" are regular tool groups
// (Features/annotationTransform) and "Isoler un segment" (same letter S as
// "Isoler une face") is the ISOLATE_SEGMENT group (Features/isolateSegment).
const TOOL_ITEMS = [
  {
    type: "DRAW",
    label: "Dessin",
    Icon: Draw,
    shortcut: "D",
    isTemplatelessDraw: true,
  },
  { type: "CUT", label: "Ouverture", Icon: StopCircle, shortcut: "O" },
  {
    type: "SPLIT_LINE",
    label: "Retirer un segment",
    Icon: IconCutLine,
    shortcut: "X",
    editor: "2D",
  },
  {
    type: "SPLIT_POLYLINE_CLICK",
    label: "Couper un segment",
    Icon: IconSplitPolylineClick,
    shortcut: "C",
    editor: "2D",
  },
  {
    type: "ISOLATE_SEGMENT",
    label: "Isoler un segment",
    Icon: IconIsolateSegment,
    shortcut: "S",
    editor: "2D",
  },
  {
    type: "SURFACE_CUT",
    label: "Couper une surface",
    Icon: IconCutSurface,
    shortcut: "F",
    editor: "2D",
  },
  {
    type: "JOIN_ANNOTATIONS",
    label: "Joindre",
    Icon: IconJoinAnnotations,
    shortcut: "J",
    editor: "2D",
  },
  {
    type: "REVOLUTION_AXIS",
    label: "Axe de révolution",
    Icon: Adjust,
    shortcut: "A",
    // Both editors: on the plan (2D) and on a horizontal base map plane of
    // the 3D editor (RevolutionAxisDraftOverlayThreed, two clicks too).
    isRevolutionAxis: true,
  },
  {
    type: "FACE_CUT",
    label: "Coupe face",
    Icon: IconSplitPolygon,
    shortcut: "C",
    editor: "3D",
  },
  {
    type: "ISOLATE_FACE",
    label: "Isoler une face",
    Icon: IconIsolateSegment,
    shortcut: "S",
    editor: "3D",
    threedTool: "ISOLATE_FACE",
  },
  {
    type: "EXTRUDE",
    label: "Extruder",
    Icon: Height,
    shortcut: "E",
    editor: "3D",
    threedTool: "EXTRUDE",
  },
  {
    type: "MOVE_ANNOTATION",
    label: "Déplacer",
    Icon: OpenWith,
    shortcut: "M",
    threedTool: "MOVE_ANNOTATION",
  },
  {
    type: "ROTATE_ANNOTATION",
    label: "Tourner",
    Icon: RotateRight,
    shortcut: "R",
    threedTool: "ROTATE_ANNOTATION",
  },
];

export function getToolItemsForEditor({ isThreedEditor }) {
  const editor = isThreedEditor ? "3D" : "2D";
  return TOOL_ITEMS.filter((item) => !item.editor || item.editor === editor);
}

export default TOOL_ITEMS;
