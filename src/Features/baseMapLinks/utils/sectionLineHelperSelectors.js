import { selectIsSectionBaseMapPlacementActive } from "../sectionBaseMapPlacementSlice";
import { selectIsBaseMapLinkDrawThreedActive } from "./baseMapLinkDrawThreedSelectors";

// The drawing helper must show for the section mark tools of the 3D editor
// even where the regular helper chain is off (the Fonds de plan module keeps
// its listings popper as a legend in 3D): the mark being drawn in 3D, and
// the « + fond de plan » placement (Fonds de plan and Dessin modules).
export function selectIsSectionLineThreedHelperActive(s) {
  return (
    selectIsSectionBaseMapPlacementActive(s) ||
    selectIsBaseMapLinkDrawThreedActive(s)
  );
}
