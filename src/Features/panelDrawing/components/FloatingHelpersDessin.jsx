import { useSelector } from "react-redux";

import PopperPasteHelper from "Features/mapEditor/components/PopperPasteHelper";
import PopperSubtractHelper from "Features/mapEditor/components/PopperSubtractHelper";
import PopperDrawingHelper from "Features/mapEditor/components/PopperDrawingHelper";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

// ---------------------------------------------------------------------------
// FloatingHelpersDessin — floating helpers of the Dessin module, replacing the
// early-return chain of PopperMapListings now that the popper is hidden there
// (the left panel took over the listings, see PanelDrawing):
// - paste / subtract stay floating (transient canvas-anchored modes);
// - the drawing helper floats only in drawer (non-docked) mode — the docked
//   panel renders SectionPanelDrawingHelper itself, and the drawer panel is
//   off-screen while the mouse is on the canvas.
// ---------------------------------------------------------------------------

export default function FloatingHelpersDessin() {
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const subtractPickAnnotationId = useSelector(selectSubtractPickAnnotationId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  if (pasteClipboard) return <PopperPasteHelper />;
  if (subtractPickAnnotationId) return <PopperSubtractHelper />;
  if (enabledDrawingMode && !leftPanelDocked) return <PopperDrawingHelper />;
  return null;
}
