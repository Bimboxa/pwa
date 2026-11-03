import { useState } from "react";

import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import {
  ArrowForward as ArrowForwardIcon,
  Contrast as HalfViewIcon,
  DonutLarge as PartialIcon,
  Flip as FlipIcon,
  Lens as TotalIcon,
} from "@mui/icons-material";

import ToolbarAnnotationActions from "Features/annotations/components/ToolbarAnnotationActions";
import IconCreateBaseMap from "Features/icons/IconCreateBaseMap";
import MenuRevolutionAxisBaseMaps from "./MenuRevolutionAxisBaseMaps";

import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import useCreateRevolutionAxisBaseMap from "../hooks/useCreateRevolutionAxisBaseMap";
import useRevolutionAxisActions from "../hooks/useRevolutionAxisActions";
import useRevolutionAxisLinkedBaseMaps from "../hooks/useRevolutionAxisLinkedBaseMaps";

// Actions row of the plan REVOLUTION_AXIS edit toolbar, the axis counterpart
// of the « Actions » row of ToolbarEditAnnotation (same shared row component:
// extra actions on the left, two-click Supprimer with the ⌫ badge on the
// right).
//
// Extra actions: invert the half-revolutions · partial / total revolution ·
// 3D half-view · coupe base map — same icon and menu as the axis row of
// PopperMapListings (MenuRevolutionAxisBaseMaps): when no base map is linked
// yet, the menu links an existing vertical base map or creates the A3 page
// + poses the axis; one linked base map navigates to it; several open the
// menu with the linked ones on top.
const toggleSx = (accentColor, active) => ({
  color: active ? accentColor : "text.disabled",
  bgcolor: active ? accentColor + "18" : "transparent",
  "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
});

export default function RowRevolutionAxisActions({ axis, accentColor }) {
  // strings

  const invertS = "Inverser les demi-révolutions";
  const partialS = "Révolution partielle";
  const totalS = "Révolution totale";
  const halfViewOnS = "Demi-vue 3D (coupe) : activée";
  const halfViewOffS = "Demi-vue 3D (coupe) : désactivée";
  const linkS = "Lier un fond de plan pour dessiner les profils";
  const goToS = "Voir le fond de plan des profils";

  // data

  const actions = useRevolutionAxisActions(axis);
  const { linkedBaseMaps, goTo } = useRevolutionAxisLinkedBaseMaps(axis);
  const { groups: verticalBaseMapGroups } = useVerticalBaseMapsByListing();
  const { createForAxis, creating } = useCreateRevolutionAxisBaseMap();

  // state

  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null);

  // helpers

  const hasLinked = linkedBaseMaps.length > 0;

  // handlers

  // Same decision as the axis row of PopperMapListings: one linked base map
  // navigates straight to it, none / several open the menu.
  function handleBaseMapClick(e) {
    if (creating) return;
    if (linkedBaseMaps.length === 1) {
      goTo(linkedBaseMaps[0].id);
      return;
    }
    setLinkMenuAnchor(e.currentTarget);
  }

  // render

  const extraActions = (
    <>
      <Tooltip title={invertS}>
        <IconButton
          size="small"
          onClick={actions.toggleInvertHalf}
          sx={toggleSx(accentColor, Boolean(axis?.invertHalf))}
        >
          <FlipIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={actions.isPartial ? totalS : partialS}>
        <IconButton
          size="small"
          onClick={actions.togglePartial}
          sx={toggleSx(accentColor, actions.isPartial)}
        >
          {actions.isPartial ? (
            <PartialIcon fontSize="small" />
          ) : (
            <TotalIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      <Tooltip title={actions.isHalfView ? halfViewOnS : halfViewOffS}>
        <IconButton
          size="small"
          onClick={actions.toggleHalfView}
          sx={toggleSx(accentColor, actions.isHalfView)}
        >
          <HalfViewIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip title={hasLinked ? goToS : linkS}>
        <span>
          <IconButton
            size="small"
            onClick={handleBaseMapClick}
            disabled={creating}
            sx={toggleSx(accentColor, hasLinked)}
          >
            {creating ? (
              <CircularProgress size={18} thickness={5} />
            ) : hasLinked ? (
              <ArrowForwardIcon fontSize="small" />
            ) : (
              <IconCreateBaseMap fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {/* Linked base maps / link or create a base map (shared with the axis
          row of PopperMapListings) */}
      <MenuRevolutionAxisBaseMaps
        anchorEl={linkMenuAnchor}
        open={Boolean(linkMenuAnchor)}
        onClose={() => setLinkMenuAnchor(null)}
        axis={axis}
        linkedBaseMaps={linkedBaseMaps}
        verticalBaseMapGroups={verticalBaseMapGroups}
        creating={creating}
        onCreate={createForAxis}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      />
    </>
  );

  return (
    <ToolbarAnnotationActions
      accentColor={accentColor}
      hideClone
      hideResize
      onDelete={actions.deleteAxis}
      extraActions={extraActions}
    />
  );
}
