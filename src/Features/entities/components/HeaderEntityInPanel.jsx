import { useSelector, useDispatch } from "react-redux";

import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";
import { setSelectedEntityId } from "../entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setTempMarkerProps } from "Features/markers/markersSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useEntity from "../hooks/useEntity";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Paper, Typography } from "@mui/material";
import IconButtonClose from "Features/layout/components/IconButtonClose";

import IconButtonMoreEntity from "./IconButtonMoreEntity";

import theme from "Styles/theme";

export default function HeaderEntityInPanel() {
  const dispatch = useDispatch();

  // data

  const isMobile = useIsMobile();
  const entity = useEntity();
  const { value: listing } = useSelectedListing({ withEntityModel: true });

  console.log("debug_0915 entity", entity);

  //const openPanelListItem = useSelector((s) => s.listPanel.openPanelListItem);
  const openPanelListItem = true;

  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  // helper - label

  const newS = listing?.entityModel?.strings?.labelNew;

  // helpers

  const label = entity?.id ? entity?.[listing?.entityModel?.labelKey] : newS;
  const bgcolor = entity?.id
    ? listing?.color ?? theme.palette.primary.main
    : "white";
  const textColor = entity?.id
    ? theme.palette.getContrastText(bgcolor)
    : "inherit";

  // handlers

  function handleClose() {
    console.log("close");
    dispatch(setSelectedEntityId(null));
    dispatch(setTempMarkerProps(null));
    dispatch(setOpenedPanel("LISTING"));
  }

  return (
    <Box sx={{ width: 1, p: 1 }}>
      <Paper
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
        <IconButtonClose onClose={handleClose} sx={{ color: "inherit" }} />
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
