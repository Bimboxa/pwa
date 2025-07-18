import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import useLoadedMainBaseMap from "Features/mapEditor/hooks/useLoadedMainBaseMap";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Button, Box, Typography } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelSelectorBaseMap from "./PanelSelectorBaseMap";

export default function ButtonSelectorBaseMapInMapEditor() {
  const dispatch = useDispatch();

  // strings

  const selectS = "Sélectionnez un fond de plan";

  // state

  const [open, setOpen] = useState(false);

  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();
  const isMobile = useIsMobile();

  // helper

  const buttonLabel = loadedMainBaseMap ? loadedMainBaseMap.label : selectS;

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleMapSelectionChange(mapId) {
    dispatch(setSelectedMainBaseMapId(mapId));
    setOpen(false);
  }

  return (
    <Box>
      <Button
        onClick={handleClick}
        endIcon={<Down />}
        variant="contained"
        size={isMobile ? "medium" : "small"}
        sx={{ borderRadius: 2 }}
      >
        <Box
          sx={{ display: "flex", flexDirection: "column", alignItems: "start" }}
        >
          <Typography variant="body2">{buttonLabel}</Typography>
        </Box>
      </Button>
      <DialogGeneric
        open={open}
        onClose={() => setOpen(false)}
        title={selectS}
        vh={70}
        vw={50}
      >
        <PanelSelectorBaseMap
          selection={loadedMainBaseMap?.id}
          onSelectionChange={handleMapSelectionChange}
        />
      </DialogGeneric>
    </Box>
  );
}
