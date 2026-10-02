import { useDispatch } from "react-redux";

import { setHollowOutDialogAnnotationId } from "Features/mapEditor/mapEditorSlice";

import ToolbarToolButton from "./ToolbarToolButton";
import { useToolbarTools } from "./ToolbarToolsContext";
import IconHollowOut from "./IconHollowOut";

// "Evider": carve the selected POLYGON by the footprints of the visible
// annotations — opens the carve dialog (DialogHollowOutAnnotation), like the
// "E" keyboard shortcut (InteractionLayer).
// Toolbar-row fallback only: in the 2D editor the action has its own button in
// the quick-action row above the annotation (OverlayButtonHollowOutAnnotation),
// so it is left out of the "Plus d'outils" menu next to it.
export default function IconButtonHollowOutAnnotation({
  annotation,
  accentColor,
}) {
  const dispatch = useDispatch();
  const isMenu = useToolbarTools()?.variant === "menu";

  if (isMenu) return null;

  return (
    <ToolbarToolButton
      icon={<IconHollowOut fontSize="small" />}
      label="Evider (découper par les annotations visibles) — E"
      onClick={() => dispatch(setHollowOutDialogAnnotationId(annotation?.id))}
      accentColor={accentColor}
    />
  );
}
