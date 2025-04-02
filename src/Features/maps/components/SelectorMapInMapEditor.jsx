// DEPRECATED

import useLoadedMainMap from "Features/mapEditor/hooks/useLoadedMainMap";

import {useDispatch} from "react-redux";

import {createMap, setSelectedMapId} from "Features/maps/mapsSlice";

import {Paper} from "@mui/material";
import ButtonPopper from "Features/layout/components/ButtonPopper";
import ListMapsFromGDrive from "Features/gapi/components/ListMapsFromGDrive";

export default function SelectorMapInMapEditor() {
  const dispatch = useDispatch();

  // string

  const selectS = "+ fond de plan";

  // data

  const loadedMainMap = useLoadedMainMap();

  // helper

  const buttonLabel = loadedMainMap ? loadedMainMap.name : selectS;

  // handler

  function handleClick(map) {
    console.log("SelectorMapInMapEditor handleClick", map);
    dispatch(createMap(map));
    dispatch(setSelectedMapId(map.id));
  }

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
        <Paper>
          <ListMapsFromGDrive onClick={handleClick} />
        </Paper>
      </ButtonPopper>
    </Paper>
  );
}
