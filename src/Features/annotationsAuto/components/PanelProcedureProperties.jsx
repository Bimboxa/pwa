import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  clearSelection,
  selectSelectedItems,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionsProcedureProperties from "./SectionsProcedureProperties";

/**
 * Right-panel properties of an automated procedure (selection item of type
 * PROCEDURE, see getProcedureSelectedItem): the shared procedure sections
 * (SectionsProcedureProperties — description, source / created templates,
 * parameters, launch buttons). Linked to a listing, the back arrow selects
 * that listing.
 */
export default function PanelProcedureProperties() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Procédure auto";
  const backS = "Retour";

  // data

  const selectedItem = useSelector(selectSelectedItems)[0];
  const procedureKey = selectedItem?.procedureKey;
  const listingId = selectedItem?.listingId ?? null;

  const appConfig = useAppConfig();
  const procedure = (appConfig?.automatedAnnotationsProcedures ?? []).find(
    (p) => p.key === procedureKey
  );

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const getSourceAnnotationIds = useListingProcedureSourceIds({
    listingId,
    baseMapId,
    enabled: Boolean(procedure && listingId),
  });

  // helpers

  const sourceAnnotationIds = procedure
    ? getSourceAnnotationIds(procedure)
    : [];

  // handlers

  function handleBack() {
    if (listingId) {
      dispatch(setSelectedItem({ id: listingId, type: "LISTING" }));
    } else {
      dispatch(clearSelection());
    }
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  if (!procedure) return null;

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <Tooltip title={backS}>
          <IconButton size="small" onClick={handleBack}>
            <ArrowBack fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ ml: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            {captionS}
          </Typography>
          <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
            {procedure.label}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        <SectionsProcedureProperties
          procedure={procedure}
          listingId={listingId}
          baseMapId={baseMapId}
          sourceAnnotationIds={sourceAnnotationIds}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
