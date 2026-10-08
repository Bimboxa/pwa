import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapsListDetached,
  setToolsDetached,
} from "../popperMapListingsSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import CallMerge from "@mui/icons-material/CallMerge";
import OpenInNew from "@mui/icons-material/OpenInNew";

// ---------------------------------------------------------------------------
// IconButtonToggleDetached — detach / attach icon of a side of the
// annotations popper:
// - target "BASE_MAPS": the base maps list leaves the "Fonds de plan" side for
//   its own popper (PopperBaseMapsList) and back;
// - target "TOOLS": the drawing tools leave the "Commandes" side for their own
//   popper (PopperDrawingTools) and back.
// variant "title": 28px square button of the side title row of
// PopperMapListings (next to the properties button); variant "header": small
// icon button of a detached popper's header (next to the collapse button).
// ---------------------------------------------------------------------------

const DETACH_LABEL_BY_TARGET = {
  BASE_MAPS: "Détacher la liste",
  TOOLS: "Détacher les commandes",
};

export default function IconButtonToggleDetached({
  target = "BASE_MAPS",
  variant = "title",
}) {
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

  if (variant === "header") {
    return (
      <Tooltip title={detached ? attachS : detachS}>
        <IconButton
          size="small"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleClick}
          sx={{ color: "panel.textLight", p: 0.25, cursor: "pointer" }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={detached ? attachS : detachS} arrow placement="top">
      <Box
        component="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClick}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          p: 0,
          border: "none",
          borderRadius: 2,
          flexShrink: 0,
          cursor: "pointer",
          color: "text.secondary",
          bgcolor: "action.hover",
          "&:hover": { bgcolor: "action.selected" },
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
    </Tooltip>
  );
}
