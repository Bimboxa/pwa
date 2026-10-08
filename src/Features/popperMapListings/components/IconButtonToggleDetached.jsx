import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapsListDetached,
  setToolsDetached,
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
// - target "TOOLS": the drawing tools leave the "Commandes" side for their own
//   popper (PopperDrawingTools) and back.
// ---------------------------------------------------------------------------

const DETACH_LABEL_BY_TARGET = {
  BASE_MAPS: "Détacher la liste",
  TOOLS: "Détacher les commandes",
};

export default function IconButtonToggleDetached({ target = "BASE_MAPS" }) {
  const dispatch = useDispatch();

  // strings

  const detachS = DETACH_LABEL_BY_TARGET[target];
  const attachS = "Attacher aux annotations";

  // data

  const detached = useSelector((s) =>
    target === "TOOLS"
      ? s.popperMapListings.toolsDetached
      : s.popperMapListings.baseMapsListDetached
  );

  // helpers

  const Icon = detached ? CallMerge : OpenInNew;
  const setDetached =
    target === "TOOLS" ? setToolsDetached : setBaseMapsListDetached;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(setDetached(!detached));
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
