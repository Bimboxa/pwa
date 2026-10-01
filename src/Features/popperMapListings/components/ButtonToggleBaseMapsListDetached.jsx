import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsListDetached } from "../popperMapListingsSlice";

import { Box, Typography } from "@mui/material";
import CallMerge from "@mui/icons-material/CallMerge";
import OpenInNew from "@mui/icons-material/OpenInNew";

// ---------------------------------------------------------------------------
// ButtonToggleBaseMapsListDetached — row above the base maps list of the
// poppers: "Détacher la liste" (the list leaves the annotations popper for
// its own popper, PopperBaseMapsList) / "Attacher aux annotations" (back to
// a single popper with the header toggle).
// ---------------------------------------------------------------------------

export default function ButtonToggleBaseMapsListDetached() {
  const dispatch = useDispatch();

  // strings

  const detachS = "Détacher la liste";
  const attachS = "Attacher aux annotations";

  // data

  const detached = useSelector((s) => s.popperMapListings.baseMapsListDetached);

  // helpers

  const Icon = detached ? CallMerge : OpenInNew;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(setBaseMapsListDetached(!detached));
  }

  // render

  return (
    <Box
      role="button"
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.5,
        cursor: "pointer",
        bgcolor: "panel.sectionBg",
        borderBottom: "1px solid",
        borderColor: "panel.border",
        color: "panel.textMuted",
        "&:hover": { color: "panel.textPrimary" },
      }}
    >
      <Icon sx={{ fontSize: 14 }} />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {detached ? attachS : detachS}
      </Typography>
    </Box>
  );
}
