import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";

import {Paper} from "@mui/material";
import ButtonPopper from "Features/layout/components/ButtonPopper";

export default function SelectorMapInMapEditor() {
  // string

  const selectS = "+ fond de plan";
  // data

  const loadedMainMap = useLoadedMainMap();

  // helper

  const buttonLabel = loadedMainMap ? loadedMainMap.name : selectS;
  return (
    <Paper
      sx={{
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        bgcolor: (theme) => theme.palette.button.dark,
      }}
    >
      <ButtonPopper buttonLabel={buttonLabel} sx={{color: "white"}}>
        <div>TODO: list of maps</div>
      </ButtonPopper>
    </Paper>
  );
}
