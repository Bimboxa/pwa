import {useSelector, useDispatch} from "react-redux";

import {setViewModeInMobile} from "../layoutSlice";

import {BottomNavigation, BottomNavigationAction, Paper} from "@mui/material";
import {ListAlt as List, Map} from "@mui/icons-material";

export default function BottomBarMobile() {
  const dispatch = useDispatch();

  // strings

  const mapLabel = "Plan";
  const listLabel = "Liste";

  // data

  const viewModeInMobile = useSelector(
    (state) => state.layout.viewModeInMobile
  );

  // handlers

  function handleChange(event, newValue) {
    dispatch(setViewModeInMobile(newValue));
  }

  return (
    <Paper sx={{pb: 2}}>
      <BottomNavigation
        value={viewModeInMobile}
        onChange={handleChange}
        showLabels
      >
        <BottomNavigationAction
          label={listLabel}
          value="LIST"
          icon={<List />}
        />
        <BottomNavigationAction label={mapLabel} value="MAP" icon={<Map />} />
      </BottomNavigation>
    </Paper>
  );
}
