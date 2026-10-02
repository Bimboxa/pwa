import { Draw, StopCircle } from "@mui/icons-material";
import IconCutLine from "Features/icons/IconCutLine";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";
import IconJoinAnnotations from "Features/icons/IconJoinAnnotations";
import IconSplitPolygon from "Features/icons/IconSplitPolygon";
import IconCutSurface from "Features/icons/IconCutSurface";

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
    type: "FACE_CUT",
    label: "Coupe face",
    Icon: IconSplitPolygon,
    shortcut: "C",
    editor: "3D",
  },
];

export function getToolItemsForEditor({ isThreedEditor }) {
  const editor = isThreedEditor ? "3D" : "2D";
  return TOOL_ITEMS.filter((item) => !item.editor || item.editor === editor);
}

export default TOOL_ITEMS;
