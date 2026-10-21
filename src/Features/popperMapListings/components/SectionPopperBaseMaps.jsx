import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsPanelExpanded } from "../popperMapListingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Tooltip, Typography } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Tune from "@mui/icons-material/Tune";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonToggleDetached from "./IconButtonToggleDetached";

import bandButtonSx from "../utils/bandButtonSx";

// ---------------------------------------------------------------------------
// SectionPopperBaseMaps — "Fonds de plan" block of the Dessin popper, right
// under the header and above the listings block (BandActiveListing):
// 1. the "Fonds de plan" header: the properties button (Tune → the base maps
//    properties of the right panel, PanelPropertiesBaseMapsList), the detach
//    / attach icon of the list (PopperBaseMapsList) and the expand / collapse
//    button of the base maps panel — collapsed by default;
// 2. the base maps list (SectionBaseMapsList, the very panel the former
//    "Fonds de plan" tab of the header toggle showed), capped in height so a
//    long list never pushes the listings and templates out of sight.
// Replaces the "Fonds de plan" side of the header toggle in the poppers
// that show the listings block; the legend poppers keep their tab. While
// the list is detached only the header remains (title + attach icon) — the
// re-attach entry point from the popper itself.
// The expanded state lives in redux (popperMapListings.baseMapsPanelExpanded)
// so it survives the popper remount between the 2D and 3D editors.
// ---------------------------------------------------------------------------

const PANEL_MAX_HEIGHT = 240;

export default function SectionPopperBaseMaps({
  // Counts narrowed like the legend (SCOPE module), null elsewhere.
  countByBaseMapIdOverride,
  // Properties button — not in the read-only legends.
  showProperties = true,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan";
  const propertiesS = "Propriétés des fonds de plan";
  const expandS = "Déplier les fonds de plan";
  const collapseS = "Replier les fonds de plan";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const expanded = useSelector(
    (s) => s.popperMapListings.baseMapsPanelExpanded
  );
  const detached = useSelector((s) => s.popperMapListings.baseMapsListDetached);

  // helpers

  const showPanel = expanded && !detached;

  // handlers

  const handleToggleExpanded = () => {
    if (detached) return;
    dispatch(setBaseMapsPanelExpanded(!expanded));
  };

  const handleOpenProperties = (e) => {
    e.stopPropagation();
    dispatch(
      setSelectedItem({ id: selectedScopeId, type: "POPPER_BASE_MAPS" })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // render

  return (
    <Box>
      {/* "Fonds de plan" header: title, then the properties button, the
          detach / attach icon and the expand / collapse button. */}
      <Box
        onClick={handleToggleExpanded}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 1,
          py: 0.5,
          cursor: detached ? "default" : "pointer",
          userSelect: "none",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          // Same tinted block as the "Listes d'annotations" header.
          bgcolor: "background.default",
          "&:hover": { bgcolor: detached ? undefined : "action.hover" },
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

        {showProperties && (
          <Tooltip title={propertiesS} arrow placement="top">
            <Box
              component="button"
              onClick={handleOpenProperties}
              sx={bandButtonSx}
            >
              <Tune sx={{ fontSize: 16 }} />
            </Box>
          </Tooltip>
        )}

        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
        >
          <IconButtonToggleDetached />
        </Box>

        {!detached && (
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
        )}
      </Box>

      {/* Base maps panel, under the header. */}
      {showPanel && (
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
          />
        </Box>
      )}
    </Box>
  );
}
