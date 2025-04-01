import {useState} from "react";
import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";

import {Button, Box, Typography} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelSelectorMap from "./PanelSelectorMap";

export default function ButtonSelectorMap() {
  // strings

  const seeMaps = "Ouvrir un plan";
  const selectS = "Sélectionnez un fond de plan";

  // state

  const [open, setOpen] = useState(false);

  // data

  const loadedMainMap = useLoadedMainMap();

  // helper

  const buttonLabel = loadedMainMap ? loadedMainMap.name : seeMaps;

  // handlers

  function handleClick() {
    setOpen(true);
  }

  return (
    <Box>
      <Button onClick={handleClick} endIcon={<Down />}>
        <Box
          sx={{display: "flex", flexDirection: "column", alignItems: "start"}}
        >
          <Typography variant="body2">{buttonLabel}</Typography>
        </Box>
      </Button>
      <DialogGeneric open={open} onClose={() => setOpen(false)} title={selectS}>
        <PanelSelectorMap />
      </DialogGeneric>
    </Box>
  );
}
