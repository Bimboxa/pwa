import { StopCircle } from "@mui/icons-material";
import IconCutLine from "Features/icons/IconCutLine";
import IconSplitPolylineClick from "Features/icons/IconSplitPolylineClick";

// TODO: clean up the code behind the drawing tools removed from this UI list
// (SPLIT_SURFACE "Couper des surfaces", TECHNICAL_RETURN "Retour 1m",
// ADD_INNER_POINT "Ajouter un point", LOCALIZED_REPAIR "Réparation localisée",
// COMPLETE_ANNOTATION "Prolonger").
// Once confirmed unused elsewhere, drop their interaction handlers / drawing
// modes / hooks and the REPAIR_MODES / SectionRepairModes wiring.
const TOOL_ITEMS = [
  { type: "CUT", label: "Ouverture", Icon: StopCircle, shortcut: "O" },
  {
    type: "SPLIT_LINE",
    label: "Retirer un segment",
    Icon: IconCutLine,
    shortcut: "X",
  },
  {
    type: "SPLIT_POLYLINE_CLICK",
    label: "Couper un segment",
    Icon: IconSplitPolylineClick,
    shortcut: "C",
  },
];

export default TOOL_ITEMS;
