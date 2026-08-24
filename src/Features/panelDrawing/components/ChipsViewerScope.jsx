import { useDispatch, useSelector } from "react-redux";

import { setViewerAnnotationsScope } from "Features/panelDrawing/panelDrawingSlice";

import { Box, Typography } from "@mui/material";

// ---------------------------------------------------------------------------
// ChipsViewerScope — annotations scope chips of the panels: the active base
// map, or the whole repérage ("Tous"). Drives the annotations set
// (useAnnotationsV2) and thus every displayed quantity.
// ---------------------------------------------------------------------------

export default function ChipsViewerScope({ baseMapName }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Fonds de plan des annotations";

  // data

  const scope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);

  // helpers

  const chips = [
    { key: "BASE_MAP", label: baseMapName ?? "Fond de plan" },
    { key: "ALL", label: "Tous" },
  ];

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        px: 1.5,
        py: 1.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", minWidth: 0, flexShrink: 1 }}
      >
        {labelS}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.75, flexShrink: 0 }}>
        {chips.map(({ key, label }) => {
          const selected = key === scope;
          return (
            <Box
              key={key}
              component="button"
              onClick={() => dispatch(setViewerAnnotationsScope(key))}
              sx={{
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                px: 1.5,
                py: 0.5,
                borderRadius: 4,
                border: "1px solid",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.8125rem",
                fontWeight: 500,
                bgcolor: selected ? "grey.900" : "background.paper",
                color: selected ? "common.white" : "text.secondary",
                borderColor: selected ? "grey.900" : "divider",
                "&:hover": {
                  bgcolor: selected ? "grey.900" : "action.hover",
                },
              }}
            >
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
