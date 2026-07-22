import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setPovFramingActive, setPovViewFreeze } from "../povSlice";

// Arms the POV capture frame (mask + rect + legend + save bar), either on an
// existing view (pov) or on a new one (pov = null → "Créer une vue").
export default function useEnterPovFraming() {
  const dispatch = useDispatch();

  const rightPanelIsOpen = useSelector((s) =>
    Boolean(s.rightPanel.selectedMenuItemKey)
  );

  return function enterFraming(pov = null) {
    // Arming the frame always shows the LIVE content: a freeze left by a
    // previously applied view must not leak into the view being framed
    // ("Appliquer la vue" re-freezes right after, via restorePov).
    dispatch(setPovViewFreeze(null));
    dispatch(setSelectedItem(pov ? { id: pov.id, type: "POV" } : null));
    // Only switch an ALREADY open right panel to the POV properties — the
    // frame ignores the panel, but opening it uninvited would be intrusive.
    if (rightPanelIsOpen)
      dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    dispatch(setPovFramingActive(true));
  };
}
