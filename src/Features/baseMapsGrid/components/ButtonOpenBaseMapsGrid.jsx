import { useSelector } from "react-redux";

import { selectBaseMapsGridOpen } from "../baseMapsGridSlice";

import useOpenBaseMapsGrid from "../hooks/useOpenBaseMapsGrid";
import useOpenBaseMapsGridHotkey, {
  BASE_MAPS_GRID_HOTKEY,
} from "../hooks/useOpenBaseMapsGridHotkey";

import { GridView } from "@mui/icons-material";

import ButtonBaseMapsGrid from "./ButtonBaseMapsGrid";

// Top-right button of the 2D map editors: opens the base maps grid.
export default function ButtonOpenBaseMapsGrid() {
  // strings

  const titleS = "Tous les fonds de plan";

  // data

  const isOpen = useSelector(selectBaseMapsGridOpen);
  // The grid hands the sheet over in the print zone frame: not available in
  // the background-page mode.
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);

  // handlers

  const openGrid = useOpenBaseMapsGrid();
  useOpenBaseMapsGridHotkey({ enabled: !showBgImage, onOpen: openGrid });

  // render

  if (showBgImage) return null;

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<GridView fontSize="small" />}
      disabled={isOpen}
      shortcut={BASE_MAPS_GRID_HOTKEY}
      onClick={openGrid}
    />
  );
}
