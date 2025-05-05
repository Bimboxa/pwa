import {useSelector, useDispatch} from "react-redux";
import {setSelectedMode} from "../relsZoneEntitySlice";

import {IconButton} from "@mui/material";
import {SwitchLeft as Switch} from "@mui/icons-material";

export default function SelectorMode() {
  const dispatch = useDispatch();

  const selectedMode = useSelector(
    (state) => state.relsZoneEntity.selectedMode
  );

  function handleClick() {
    if (selectedMode === "BY_ZONE") {
      dispatch(setSelectedMode("BY_ENTITY"));
    } else {
      dispatch(setSelectedMode("BY_ZONE"));
    }
  }
  return (
    <IconButton onClick={handleClick}>
      <Switch />
    </IconButton>
  );
}
