import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapsListDetached,
  setToolsDetached,
  setViewerContentMode,
} from "../popperMapListingsSlice";

import { IconButton, Tooltip } from "@mui/material";
import CallMerge from "@mui/icons-material/CallMerge";
import OpenInNew from "@mui/icons-material/OpenInNew";

// ---------------------------------------------------------------------------
// IconButtonToggleDetached — detach / attach icon of a side of the
// annotations popper, small and light grey, in the bottom band (PanelFooter)
// of the poppers:
// - target "BASE_MAPS": the base maps list leaves the "Fonds de plan" side for
//   its own popper (PopperBaseMapsList) and back;
// - target "TOOLS": the commands leave the popper for their own popper
//   (PopperDrawingTools) and back — the "Commandes" side of the annotations
//   popper in the drawing modules, the "Commandes" section under the base
//   maps list in the BaseMaps module (attaching lands there, not on the
//   "TOOLS" side the reducer selects, which that module does not have).
// ---------------------------------------------------------------------------

const DETACH_LABEL_BY_TARGET = {
  BASE_MAPS: "Détacher la liste",
  TOOLS: "Détacher les commandes",
};

export default function IconButtonToggleDetached({ target = "BASE_MAPS" }) {
  const dispatch = useDispatch();

  // data

  const detached = useSelector((s) =>
    target === "TOOLS"
      ? s.popperMapListings.toolsDetached
      : s.popperMapListings.baseMapsListDetached
  );
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );

  // strings

  const detachS = DETACH_LABEL_BY_TARGET[target];
  const attachS =
    target === "TOOLS" && isBaseMapsModule
      ? "Attacher aux fonds de plan"
      : "Attacher aux annotations";

  // helpers

  const Icon = detached ? CallMerge : OpenInNew;
  const setDetached =
    target === "TOOLS" ? setToolsDetached : setBaseMapsListDetached;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(setDetached(!detached));
    if (target === "TOOLS" && detached && isBaseMapsModule)
      dispatch(setViewerContentMode("BASE_MAPS"));
  }

  // render

  return (
    <Tooltip title={detached ? attachS : detachS} arrow placement="top">
      <IconButton
        size="small"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClick}
        sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
      >
        <Icon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
}
