import { useCallback } from "react";
import { useSelector } from "react-redux";

import { BASE_MAPS_GRID_PHASE } from "../constants/baseMapsGridConstants";
import selectBaseMapsGridDessin from "../utils/selectBaseMapsGridDessin";

import useOpenBaseMapsGrid from "../hooks/useOpenBaseMapsGrid";
import useOpenBaseMapsGridHotkey, {
  BASE_MAPS_GRID_HOTKEY,
} from "../hooks/useOpenBaseMapsGridHotkey";

import { GridView } from "@mui/icons-material";

import ButtonBaseMapsGrid from "./ButtonBaseMapsGrid";

import { getActiveBaseMapsGrid } from "../services/baseMapsGridRegistry";

// Bottom bar button of the 2D map editors (SectionBaseMapsBottomBarControls):
// the single toggle of the base maps grid, in every module — opens it, and
// closes it through the handle of the mounted grid (the closing transition
// is owned by LayerBaseMapsGrid).
export default function ButtonOpenBaseMapsGrid() {
  // strings

  const titleS = "Tous les fonds de plan";

  // data

  const phase = useSelector((s) => s.baseMapsGrid.phase);
  const isOpen = phase === BASE_MAPS_GRID_PHASE.OPEN;
  const isClosed = phase === BASE_MAPS_GRID_PHASE.CLOSED;
  // The grid hands the sheet over in the print zone frame: not available in
  // the background-page mode.
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  // Dessin module: direct display of the whole table (every base map of
  // the scope) — the opening lands on the whole table, not on the main
  // base map's sheet.
  const dessin = useSelector(selectBaseMapsGridDessin);

  // handlers

  const openBaseMapsGrid = useOpenBaseMapsGrid();
  // No-op during the opening / closing transitions.
  const toggleGrid = useCallback(() => {
    if (isOpen) getActiveBaseMapsGrid()?.close();
    else if (isClosed) openBaseMapsGrid({ fitAll: dessin });
  }, [isOpen, isClosed, openBaseMapsGrid, dessin]);
  useOpenBaseMapsGridHotkey({ enabled: !showBgImage, onToggle: toggleGrid });

  // render

  if (showBgImage) return null;

  return (
    <ButtonBaseMapsGrid
      title={titleS}
      icon={<GridView />}
      active={isOpen}
      disabled={!isOpen && !isClosed}
      shortcut={BASE_MAPS_GRID_HOTKEY}
      shortcutPlacement="top"
      onClick={toggleGrid}
    />
  );
}
