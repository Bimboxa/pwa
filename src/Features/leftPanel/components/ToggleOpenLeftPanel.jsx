import { useSelector, useDispatch } from "react-redux";

import { setOpenLeftPanel } from "../leftPanelSlice";

import { ToggleButton } from "@mui/material";
import { Menu } from "@mui/icons-material";

export default function ToggleOpenLeftPanel() {
  const dispatch = useDispatch();
  // data

  const openLeftPanel = useSelector((s) => s.leftPanel.openLeftPanel);

  // handlers

  function handleClick() {
    dispatch(setOpenLeftPanel(!openLeftPanel));
  }

  return (
    <ToggleButton onChange={handleClick} selected={openLeftPanel} value="check">
      <Menu />
    </ToggleButton>
  );
}
