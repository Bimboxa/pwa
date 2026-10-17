import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsListDetached } from "../popperMapListingsSlice";

import { IconButton, Tooltip } from "@mui/material";
import CallMerge from "@mui/icons-material/CallMerge";
import OpenInNew from "@mui/icons-material/OpenInNew";

// ---------------------------------------------------------------------------
// IconButtonToggleDetached — detach / attach icon of the base maps list, small
// and light grey, in the bottom band (PanelFooter) of the poppers: the list
// leaves the "Fonds de plan" side of the annotations popper for its own
// popper (PopperBaseMapsList) and back. (The former "TOOLS" target is gone:
// the commands live in the unified commands toolbar.)
// ---------------------------------------------------------------------------

export default function IconButtonToggleDetached() {
  const dispatch = useDispatch();

  // data

  const detached = useSelector((s) => s.popperMapListings.baseMapsListDetached);

  // strings

  const detachS = "Détacher la liste";
  const attachS = "Attacher aux annotations";

  // helpers

  const Icon = detached ? CallMerge : OpenInNew;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(setBaseMapsListDetached(!detached));
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
