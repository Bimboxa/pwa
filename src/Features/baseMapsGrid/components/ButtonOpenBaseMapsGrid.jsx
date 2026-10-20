import { useCallback } from "react";
import { useSelector } from "react-redux";

import { selectBaseMapsGridOpen } from "../baseMapsGridSlice";
import selectBaseMapsGridDessin from "../utils/selectBaseMapsGridDessin";

import useOpenBaseMapsGrid from "../hooks/useOpenBaseMapsGrid";
import useOpenBaseMapsGridHotkey, {
  BASE_MAPS_GRID_HOTKEY,
} from "../hooks/useOpenBaseMapsGridHotkey";

import { GridView } from "@mui/icons-material";

import ButtonBaseMapsGrid from "./ButtonBaseMapsGrid";

// Bottom bar button of the 2D map editors (SectionBaseMapsBottomBarControls):
// opens the base maps grid.
export default function ButtonOpenBaseMapsGrid() {
  // strings

  const titleS = "Tous les fonds de plan";

  // data

  const isOpen = useSelector(selectBaseMapsGridOpen);
  // The grid hands the sheet over in the print zone frame: not available in
  // the background-page mode.
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  // Dessin module: direct display of the whole table (every base map of
  // the scope) — the opening lands on the whole table, not on the main
  // base map's sheet.
  const dessin = useSelector(selectBaseMapsGridDessin);

  // handlers

  const openBaseMapsGrid = useOpenBaseMapsGrid();
  const openGrid = useCallback(
    () => openBaseMapsGrid({ fitAll: dessin }),
    [openBaseMapsGrid, dessin]
  );
  useOpenBaseMapsGridHotkey({ enabled: !showBgImage, onOpen: openGrid });

  // render

  if (showBgImage) return null;

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<GridView />}
      disabled={isOpen}
      shortcut={BASE_MAPS_GRID_HOTKEY}
      shortcutPlacement="top"
      onClick={openGrid}
    />
  );
}
