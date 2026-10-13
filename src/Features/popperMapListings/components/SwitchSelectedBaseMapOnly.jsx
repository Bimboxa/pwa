import { useDispatch, useSelector } from "react-redux";

import { setViewerAnnotationsScope } from "Features/panelDrawing/panelDrawingSlice";

import { Box, Switch, Tooltip, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// SwitchSelectedBaseMapOnly — footer switch of the Dessin popper. Checked, the
// displayed quantities (template rows, listing counters) are those of the
// selected base map only; unchecked (default), those of every annotation of
// the repérage. Same state as the "Fond de plan / Tous" chips of the Dessin
// and Viewer panels (panelDrawing.viewerAnnotationsScope).
// ---------------------------------------------------------------------------

export default function SwitchSelectedBaseMapOnly() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Fond de plan sélectionné seul";
  const tooltipS =
    "Si coché, les quantités affichées sont celles du fond de plan sélectionné uniquement. Sinon, celles de toutes les annotations (tous les fonds de plan).";

  // data

  const scope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);
  const checked = scope === "BASE_MAP";

  // handlers

  function handleChange(e) {
    dispatch(setViewerAnnotationsScope(e.target.checked ? "BASE_MAP" : "ALL"));
  }

  // render

  return (
    <Tooltip title={tooltipS} arrow placement="top">
      <Box
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          minWidth: 0,
          cursor: "pointer",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          size="small"
          color="secondary"
          checked={checked}
          onChange={handleChange}
          sx={{ transform: "scale(0.7)", m: -0.75 }}
        />
        <Typography
          component="span"
          onClick={() =>
            dispatch(setViewerAnnotationsScope(checked ? "ALL" : "BASE_MAP"))
          }
          sx={{
            fontSize: "0.65rem",
            lineHeight: 1,
            color: checked ? "panel.textMuted" : "panel.textLight",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "none",
          }}
        >
          {labelS}
        </Typography>
      </Box>
    </Tooltip>
  );
}
