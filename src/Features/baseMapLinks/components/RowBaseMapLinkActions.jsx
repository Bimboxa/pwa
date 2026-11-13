import { IconButton, Tooltip } from "@mui/material";
import {
  ArrowForward as ArrowForwardIcon,
  SwapHoriz as ReverseIcon,
} from "@mui/icons-material";

import ToolbarAnnotationActions from "Features/annotations/components/ToolbarAnnotationActions";
import IconCreateBaseMap from "Features/icons/IconCreateBaseMap";

// Actions row of the section mark edit toolbar (ToolbarEditBaseMapLink), the
// counterpart of the « Actions » row of ToolbarEditAnnotation (same shared
// row component: extra actions on the left, two-click Supprimer on the
// right).
//
// Extra actions: « Inverser le sens » (the observer side — written on the
// source mark, also from its clone) · go to the other end of the link (the
// vertical base map the mark is located on / the plan of a located mark) ·
// « + fond de plan » on a source mark (creates / poses its vertical base map
// from the 3D editor).
const actionSx = (accentColor) => ({
  color: accentColor,
  "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
});

export default function RowBaseMapLinkActions({ actions, accentColor }) {
  // strings

  const reverseS = "Inverser le sens (côté observateur)";
  const createBaseMapS = "+ fond de plan (coupe)";
  const goToS = actions.isClone
    ? "Voir le plan"
    : "Voir le fond de plan de coupe";

  // helpers

  const counterpartName = actions.counterpart?.name;
  const goToTitle = counterpartName ? `${goToS} — ${counterpartName}` : goToS;

  // render

  const extraActions = (
    <>
      <Tooltip title={reverseS}>
        <IconButton
          size="small"
          onClick={actions.reverse}
          sx={actionSx(accentColor)}
        >
          <ReverseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {actions.canCreateBaseMap && (
        <Tooltip title={createBaseMapS}>
          <IconButton
            size="small"
            onClick={actions.createBaseMap}
            sx={actionSx(accentColor)}
          >
            <IconCreateBaseMap fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {actions.counterpart && (
        <Tooltip title={goToTitle}>
          <IconButton
            size="small"
            onClick={actions.goToCounterpart}
            sx={actionSx(accentColor)}
          >
            <ArrowForwardIcon
              fontSize="small"
              sx={{ transform: actions.isClone ? "rotate(180deg)" : "none" }}
            />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <ToolbarAnnotationActions
      accentColor={accentColor}
      hideClone
      hideResize
      onDelete={actions.deleteLink}
      extraActions={extraActions}
    />
  );
}
