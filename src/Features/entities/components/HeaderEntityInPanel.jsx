import { useSelector, useDispatch } from "react-redux";

import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";
import {
  setSelectedEntityId,
  setIsEditingEntity,
  setEditedEntity,
} from "../entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setTempMarkerProps } from "Features/markers/markersSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useEntity from "../hooks/useEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, lighten, Paper, Typography } from "@mui/material";
import IconButtonClose from "Features/layout/components/IconButtonClose";

import IconButtonMoreEntity from "./IconButtonMoreEntity";

import theme from "Styles/theme";

export default function HeaderEntityInPanel({ showCloseButton = true }) {
  const dispatch = useDispatch();

  // data

  const isMobile = useIsMobile();
  const entity = useEntity();
  const { value: listing } = useSelectedListing();

  console.log("debug_0915 entity", entity, listing);

  //const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);
  const openPanelListItem = true;

  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  // helper - label

  const newS = listing?.entityModel?.strings?.labelNew;

  // helpers

  const label = entity?.id ? entity?.[listing?.entityModel?.labelKey] : newS;


  let bgcolor = listing?.color ?? theme.palette.primary.main;
  if (!entity.id) bgcolor = lighten(bgcolor, 0.8);

  const textColor = theme.palette.getContrastText(bgcolor);

  // handlers

  function handleClose() {
    console.log("close");
    dispatch(setSelectedNode(null));
    dispatch(setSelectedItem(null));
    dispatch(setSelectedEntityId(null));
    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));
    dispatch(setOpenedPanel("LISTING"));
  }

  return (
    <Box sx={{ width: 1, p: 1 }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor,
          color: textColor,
          display: "flex",
          alignItems: "center",
          px: 1,
          py: 0.5,
          borderRadius: 2,
          justifyContent: "space-between",
          width: 1,
        }}
      >
        <IconButtonClose onClose={handleClose} sx={{ color: "inherit", visibility: showCloseButton ? "visible" : "hidden" }} />
        <Typography
          sx={{ fontWeight: isMobile ? "normal" : "bold" }}
          variant={isMobile ? "body2" : "body1"}
        >
          {label}
        </Typography>
        {entity?.id ? (
          <IconButtonMoreEntity entity={entity} sx={{ color: "inherit" }} />
        ) : (
          <Box sx={{ width: 24 }} />
        )}
      </Paper>
    </Box>
  );
}
