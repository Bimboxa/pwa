import {useState} from "react";

import {useDispatch} from "react-redux";

import {setSelectedMapId} from "Features/maps/mapsSlice";

import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import {Button, Box, Typography} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelSelectorMap from "./PanelSelectorMap";
import DropboxChooserButton from "Features/dropbox/components/DropboxChooserButton";

export default function ButtonSelectorMap() {
  const dispatch = useDispatch();

  // strings

  const seeMaps = "Ouvrir un plan";
  const selectS = "Sélectionnez un fond de plan";

  // state

  const [open, setOpen] = useState(false);

  // data

  const loadedMainMap = useLoadedMainMap();
  const isMobile = useIsMobile();

  // helper

  const buttonLabel = loadedMainMap ? loadedMainMap.label : seeMaps;

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleMapSelectionChange(mapId) {
    dispatch(setSelectedMapId(mapId));
    setOpen(false);
  }

  return (
    <Box>
      <Button
        onClick={handleClick}
        endIcon={<Down />}
        variant="contained"
        size={isMobile ? "medium" : "small"}
        sx={{borderRadius: 2}}
      >
        <Box
          sx={{display: "flex", flexDirection: "column", alignItems: "start"}}
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
        <PanelSelectorMap
          selection={loadedMainMap?.id}
          onSelectionChange={handleMapSelectionChange}
        />
      </DialogGeneric>
    </Box>
  );
}
