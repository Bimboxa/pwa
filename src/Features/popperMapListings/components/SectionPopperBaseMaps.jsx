import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setAutoBaseMapVisibility,
  setBaseMapsPanelExpanded,
} from "../popperMapListingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Checkbox,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Tune from "@mui/icons-material/Tune";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonToggleDetached from "./IconButtonToggleDetached";

import bandButtonSx from "../utils/bandButtonSx";

// ---------------------------------------------------------------------------
// SectionPopperBaseMaps — "Fonds de plan" block of the Dessin popper, right
// under the header and above the listings block (BandActiveListing):
// 1. the "Fonds de plan" header: a "..." options menu ("Visibilité auto" —
//    moved here from the bottom of the list — and the base maps properties
//    of the right panel, PanelPropertiesBaseMapsList), the detach icon of
//    the list (PopperBaseMapsList) and the expand / collapse button of the
//    base maps panel — collapsed by default;
// 2. the base maps list (SectionBaseMapsList, the very panel the former
//    "Fonds de plan" tab of the header toggle showed), capped in height so a
//    long list never pushes the listings and templates out of sight.
// Replaces the "Fonds de plan" side of the header toggle in the poppers
// that show the listings block; the legend poppers keep their tab. While
// the list is detached the section is gone altogether (re-attach from the
// detached popper's footer, which also expands the section).
// The expanded state lives in redux (popperMapListings.baseMapsPanelExpanded)
// so it survives the popper remount between the 2D and 3D editors.
// ---------------------------------------------------------------------------

const PANEL_MAX_HEIGHT = 240;

export default function SectionPopperBaseMaps({
  // Counts narrowed like the legend (SCOPE module), null elsewhere.
  countByBaseMapIdOverride,
  // "Propriétés" menu item — not in the read-only legends.
  showProperties = true,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan";
  const optionsS = "Options des fonds de plan";
  const propertiesS = "Propriétés";
  const autoVisibilityS = "Visibilité auto";
  const autoVisibilityTooltipS =
    "Au changement de fond de plan : masque l'image et les annotations des autres fonds de plan.";
  const expandS = "Déplier les fonds de plan";
  const collapseS = "Replier les fonds de plan";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const expanded = useSelector(
    (s) => s.popperMapListings.baseMapsPanelExpanded
  );
  const detached = useSelector((s) => s.popperMapListings.baseMapsListDetached);
  const autoVisibility = useSelector(
    (s) => s.popperMapListings.autoBaseMapVisibility
  );

  // state

  const [optionsMenuAnchor, setOptionsMenuAnchor] = useState(null);

  // handlers

  const handleToggleExpanded = () => {
    dispatch(setBaseMapsPanelExpanded(!expanded));
  };

  const handleToggleAutoVisibility = () => {
    dispatch(setAutoBaseMapVisibility(!autoVisibility));
  };

  const handleOpenProperties = () => {
    setOptionsMenuAnchor(null);
    dispatch(
      setSelectedItem({ id: selectedScopeId, type: "POPPER_BASE_MAPS" })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // render

  // Detached: the list lives in PopperBaseMapsList, nothing to show here.
  if (detached) return null;

  return (
    <Box>
      {/* "Fonds de plan" header: title, then the "..." options menu, the
          detach icon and the expand / collapse button. */}
      <Box
        onClick={handleToggleExpanded}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 1,
          py: 0.5,
          cursor: "pointer",
          userSelect: "none",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          // Same tinted block as the "Listes d'annotations" header.
          bgcolor: "background.default",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            color: "panel.textMuted",
          }}
        >
          {titleS}
        </Typography>

        <Tooltip title={optionsS} arrow placement="top">
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              setOptionsMenuAnchor(e.currentTarget);
            }}
            sx={{
              ...bandButtonSx,
              bgcolor: optionsMenuAnchor ? "action.selected" : "action.hover",
            }}
          >
            <MoreHoriz sx={{ fontSize: 18 }} />
          </Box>
        </Tooltip>

        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
        >
          <IconButtonToggleDetached />
        </Box>

        <Tooltip title={expanded ? collapseS : expandS} arrow placement="top">
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpanded();
            }}
            sx={bandButtonSx}
          >
            {expanded ? (
              <ExpandLess sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 18 }} />
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Options menu: "Visibilité auto" (selecting a base map hides the
          image / annotations of every other one — useHideOtherBaseMaps)
          and the base maps properties of the right panel. */}
      <Menu
        anchorEl={optionsMenuAnchor}
        open={Boolean(optionsMenuAnchor)}
        onClose={() => setOptionsMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
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
        <Tooltip
          title={autoVisibilityTooltipS}
          arrow
          placement="left"
          enterDelay={400}
        >
          <MenuItem dense onClick={handleToggleAutoVisibility}>
            <Checkbox
              size="small"
              color="secondary"
              checked={Boolean(autoVisibility)}
              disableRipple
              sx={{ p: 0, mr: 1 }}
            />
            <ListItemText
              primary={autoVisibilityS}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        </Tooltip>

        {showProperties && <Divider />}
        {showProperties && (
          <MenuItem dense onClick={handleOpenProperties}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <Tune sx={{ fontSize: 18 }} />
            </ListItemIcon>
            <ListItemText
              primary={propertiesS}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Base maps panel, under the header. "Visibilité auto" is in the
          menu above, not at the bottom of the list. */}
      {expanded && (
        <Box
          sx={{
            maxHeight: PANEL_MAX_HEIGHT,
            overflow: "auto",
            borderBottom: "1px solid",
            borderColor: "panel.border",
            bgcolor: "background.default",
          }}
        >
          <SectionBaseMapsList
            countByBaseMapIdOverride={countByBaseMapIdOverride}
            hideAutoVisibility
          />
        </Box>
      )}
    </Box>
  );
}
