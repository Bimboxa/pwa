import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";

import getProcedureParamsSummary from "../utils/getProcedureParamsSummary";
import getProcedureSelectedItem from "../utils/getProcedureSelectedItem";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { ExpandMore, MoreHoriz } from "@mui/icons-material";

import ProcedureActionButtons from "./ProcedureActionButtons";

/**
 * "Dessin auto" section of a listing, for the procedures linked to it
 * (`listing.procedureKeys`, edited in the listing properties), on 2 lines:
 *   1. active procedure name — properties button (opens
 *      PanelProcedureProperties in the right panel) — procedure selector
 *      (only when the listing links several procedures)
 *   2. recap of the current parameters — play / reset / refresh
 *
 * Sources of the run: useListingProcedureSourceIds.
 *
 * Renders nothing when the listing links no procedure.
 */
export default function SectionListingProcedures({ listingId, baseMapId, sx }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Dessin auto";
  const propertiesS = "Propriétés de la procédure";
  const selectS = "Choisir la procédure";

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const listing = useLiveQuery(
    () => (listingId ? db.listings.get(listingId) : null),
    [listingId]
  );

  const annotationsAutoState = useSelector((s) => s.annotationsAuto);

  // state

  const [activeKey, setActiveKey] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // helpers

  const linkedProcedures = (listing?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasProcedures = linkedProcedures.length > 0;
  const procedure =
    linkedProcedures.find((p) => p.key === activeKey) ?? linkedProcedures[0];
  const showSelector = linkedProcedures.length > 1;

  // data - sources of the active procedure

  const getSourceAnnotationIds = useListingProcedureSourceIds({
    listingId,
    baseMapId,
    enabled: hasProcedures,
  });

  // handlers

  function handleOpenProperties() {
    dispatch(
      setSelectedItem(
        getProcedureSelectedItem({ procedureKey: procedure.key, listingId })
      )
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleSelect(key) {
    setActiveKey(key);
    setMenuAnchorEl(null);
  }

  // render

  if (!hasProcedures) return null;

  const sourceAnnotationIds = getSourceAnnotationIds(procedure);
  const summary = getProcedureParamsSummary(procedure, annotationsAutoState);

  return (
    // white band around the tinted section
    <Box sx={{ bgcolor: "background.paper", px: 1, py: 0.75, ...sx }}>
      <Box
        sx={{
          bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {/* line 1: active procedure + properties + selector */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.5,
            pl: 1.25,
            pr: 0.5,
            py: 0.25,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              {captionS}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
              {procedure.label}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <Tooltip title={propertiesS}>
              <IconButton size="small" onClick={handleOpenProperties}>
                <MoreHoriz sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {showSelector && (
              <Tooltip title={selectS}>
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                >
                  <ExpandMore sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* line 2: parameters recap + actions */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.5,
            pl: 1.25,
            pr: 0.5,
            py: 0.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 0, lineHeight: 1.2 }}
          >
            {summary}
          </Typography>
          <Box sx={{ flexShrink: 0 }}>
            <ProcedureActionButtons
              // per-procedure instance: no running / dialog state carried
              // over when the active procedure changes
              key={procedure.key}
              procedureKey={procedure.key}
              baseMapId={baseMapId}
              sourceAnnotationIds={sourceAnnotationIds}
              disabled={sourceAnnotationIds.length === 0}
            />
          </Box>
        </Box>
      </Box>

      {showSelector && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {linkedProcedures.map((p) => (
            <MenuItem
              key={p.key}
              dense
              selected={p.key === procedure.key}
              onClick={() => handleSelect(p.key)}
            >
              {p.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
}
