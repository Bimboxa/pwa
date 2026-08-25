import { useSelector } from "react-redux";

import PopperSubtractHelper from "Features/mapEditor/components/PopperSubtractHelper";
import { selectSubtractPickAnnotationId } from "Features/mapEditor/utils/subtractPickMode";

// ---------------------------------------------------------------------------
// FloatingHelpersDessin — floating subtract helper of the Dessin module while
// the DOCKED left panel replaces PopperMapListings (which used to render it
// through its early-return chain). Only mounted when the panel is docked: in
// drawer mode the popper shows as before and keeps its own chain; when
// docked, the paste and drawing helpers render inside the panel
// (SectionPanelPasteHelper / SectionPanelDrawingHelper).
// ---------------------------------------------------------------------------

export default function FloatingHelpersDessin() {
  const subtractPickAnnotationId = useSelector(selectSubtractPickAnnotationId);

  if (subtractPickAnnotationId) return <PopperSubtractHelper />;
  return null;
}
