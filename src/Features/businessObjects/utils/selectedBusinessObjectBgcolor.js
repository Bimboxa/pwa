import { alpha } from "@mui/material/styles";

// Background of the surfaces tied to the ACTIVE / selected business object:
// the tree row and the PopperMapListings header titled with the object. A
// light tint of the secondary (listing accent) color, a bit stronger on
// hover — never the grey `action.selected` of the default MUI selection.
export default function selectedBusinessObjectBgcolor(theme, { hover } = {}) {
  return alpha(theme.palette.secondary.main, hover ? 0.14 : 0.08);
}
