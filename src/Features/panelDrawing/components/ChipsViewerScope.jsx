import { useDispatch, useSelector } from "react-redux";

import { setViewerAnnotationsScope } from "Features/panelDrawing/panelDrawingSlice";

import { Box } from "@mui/material";

// ---------------------------------------------------------------------------
// ChipsViewerScope — Viewer panel scope chips: the active base map, or the
// whole repérage ("Tous"). Drives the annotations set (useAnnotationsV2) and
// thus every displayed quantity.
// ---------------------------------------------------------------------------

export default function ChipsViewerScope({ baseMapName }) {
  const dispatch = useDispatch();

  // data

  const scope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);

  // helpers

  const chips = [
    { key: "BASE_MAP", label: baseMapName ?? "Fond de plan" },
    { key: "ALL", label: "Tous" },
  ];

  // render

  return (
    <Box sx={{ display: "flex", gap: 0.75, px: 1.5, pb: 1 }}>
      {chips.map(({ key, label }) => {
        const selected = key === scope;
        return (
          <Box
            key={key}
            component="button"
            onClick={() => dispatch(setViewerAnnotationsScope(key))}
            sx={{
              maxWidth: 200,
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
  );
}
