import { useSelector } from "react-redux";

import PopperPasteHelper from "Features/mapEditor/components/PopperPasteHelper";
import PopperSubtractHelper from "Features/mapEditor/components/PopperSubtractHelper";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

// ---------------------------------------------------------------------------
// FloatingHelpersDessin — floating paste / subtract helpers of the Dessin
// module while the DOCKED left panel replaces PopperMapListings (which used
// to render them through its early-return chain). Only mounted when the panel
// is docked: in drawer mode the popper shows as before and keeps its own
// chain (incl. the drawing helper); when docked, the drawing helper renders
// inside the panel (SectionPanelDrawingHelper).
// ---------------------------------------------------------------------------

export default function FloatingHelpersDessin() {
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const subtractPickAnnotationId = useSelector(selectSubtractPickAnnotationId);

  if (pasteClipboard) return <PopperPasteHelper />;
  if (subtractPickAnnotationId) return <PopperSubtractHelper />;
  return null;
}
