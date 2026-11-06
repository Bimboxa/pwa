import { useDispatch, useSelector } from "react-redux";

import { setCompact } from "../popperMapListingsSlice";

import { ToggleButton, Tooltip, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// ToggleButtonCompact — "Compact" toggle of the Dessin popper header
// (PopperMapListings), left of the "Propriétés" button. On, the popper is a
// legend of the selected base map: every listing at once with its templates
// below, narrowed to those that have a visible annotation on the base map
// (popperMapListings.compact).
// ---------------------------------------------------------------------------

export default function ToggleButtonCompact() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Compact";
  const tooltipS =
    "Afficher uniquement les listes et modèles visibles sur le fond de plan";

  // data

  const compact = useSelector((s) => s.popperMapListings.compact);

  // handlers

  function handleChange(e) {
    e.stopPropagation();
    dispatch(setCompact(!compact));
  }

  // render

  return (
    <Tooltip title={tooltipS} arrow placement="top">
      <ToggleButton
        value="compact"
        selected={compact}
        size="small"
        // The header is the drag handle of the popper.
        onMouseDown={(e) => e.stopPropagation()}
        onChange={handleChange}
        sx={{ py: 0.25, px: 0.75, flexShrink: 0 }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{ fontWeight: 600, textTransform: "none" }}
        >
          {labelS}
        </Typography>
      </ToggleButton>
    </Tooltip>
  );
}
