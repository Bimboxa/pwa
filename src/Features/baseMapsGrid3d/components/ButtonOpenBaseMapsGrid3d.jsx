import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsGridModeActive } from "Features/threedEditor/threedEditorSlice";

import useCloseBaseMapsGrid3d from "../hooks/useCloseBaseMapsGrid3d";

import { GridView } from "@mui/icons-material";

import ButtonBaseMapsGrid from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

import { BASE_MAPS_GRID_HOTKEY } from "Features/baseMapsGrid/hooks/useOpenBaseMapsGridHotkey";
import selectCanOpenBaseMapsGrid3d from "../utils/selectCanOpenBaseMapsGrid3d";

// Bottom bar button of the 3D editors (SectionBaseMapsBottomBarControls):
// lays the base maps flat like the sheets of the 2D grid, and sends them
// back to their real poses (useCloseBaseMapsGrid3d).
export default function ButtonOpenBaseMapsGrid3d() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Tous les fonds de plan";

  // data

  const active = useSelector((s) => s.threedEditor.baseMapsGridMode.active);
  const canOpen = useSelector(selectCanOpenBaseMapsGrid3d);
  const closeGrid = useCloseBaseMapsGrid3d();

  // handlers

  function handleClick() {
    if (active) closeGrid();
    else dispatch(setBaseMapsGridModeActive(true));
  }

  // render

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<GridView />}
      active={active}
      disabled={!active && !canOpen}
      shortcut={BASE_MAPS_GRID_HOTKEY}
      shortcutPlacement="top"
      onClick={handleClick}
    />
  );
}
