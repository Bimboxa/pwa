import { useState } from "react";

import {
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Contrast as HalfViewIcon,
  DonutLarge as PartialIcon,
  Flip as FlipIcon,
  Lens as TotalIcon,
} from "@mui/icons-material";

import ToolbarAnnotationActions from "Features/annotations/components/ToolbarAnnotationActions";

import useCreateRevolutionAxisBaseMap from "../hooks/useCreateRevolutionAxisBaseMap";
import useRevolutionAxisActions from "../hooks/useRevolutionAxisActions";
import useRevolutionAxisLinkedBaseMaps from "../hooks/useRevolutionAxisLinkedBaseMaps";

// Actions row of the plan REVOLUTION_AXIS edit toolbar, the axis counterpart
// of the « Actions » row of ToolbarEditAnnotation (same shared row component:
// extra actions on the left, two-click Supprimer with the ⌫ badge on the
// right).
//
// Extra actions: invert the half-revolutions · partial / total revolution ·
// 3D half-view · coupe base map (creates the A3 page + poses the axis when
// none is linked yet, navigates otherwise — menu when several).
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
  const createS =
    "Créer le fond de plan de coupe (A3 à l'échelle) et y poser l'axe";
  const goToS = "Voir le fond de plan des profils";
  const linkedS = "Fonds de plan liés";

  // data

  const actions = useRevolutionAxisActions(axis);
  const { linkedBaseMaps, goTo } = useRevolutionAxisLinkedBaseMaps(axis);
  const { createForAxis, creating } = useCreateRevolutionAxisBaseMap();

  // state

  const [linkMenuAnchor, setLinkMenuAnchor] = useState(null);

  // helpers

  const hasLinked = linkedBaseMaps.length > 0;

  // handlers

  function handleBaseMapClick(e) {
    if (creating) return;
    if (!hasLinked) {
      createForAxis(axis);
      return;
    }
    if (linkedBaseMaps.length === 1) {
      goTo(linkedBaseMaps[0].id);
      return;
    }
    setLinkMenuAnchor(e.currentTarget);
  }

  function handleGoTo(baseMapId) {
    setLinkMenuAnchor(null);
    goTo(baseMapId);
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

      <Tooltip title={hasLinked ? goToS : createS}>
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
              <AddIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {/* Several linked base maps: pick the one to show */}
      <Menu
        anchorEl={linkMenuAnchor}
        open={Boolean(linkMenuAnchor)}
        onClose={() => setLinkMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <MenuItem disabled dense sx={{ opacity: "1 !important" }}>
          <ListItemText
            primaryTypographyProps={{
              variant: "caption",
              color: "text.secondary",
            }}
          >
            {linkedS}
          </ListItemText>
        </MenuItem>
        {linkedBaseMaps.map((bm) => (
          <MenuItem key={bm.id} dense onClick={() => handleGoTo(bm.id)}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {bm.name}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
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
