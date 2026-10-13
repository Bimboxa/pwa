import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import useSelectedLayoutLineData from "Features/annotations/hooks/useSelectedLayoutLineData";
import useDeleteLayoutLine from "Features/annotations/hooks/useDeleteLayoutLine";

// Inline row for the currently sub-selected layoutLine ("Ligne de
// calepinage"): label, bar count, total linear, delete. The density /
// alignment / bars are edited in the properties panel.
export default function ToolbarEditLayoutLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const { annotation, index, layoutLine, hasLayoutLine, layout } =
    useSelectedLayoutLineData();
  const deleteLayoutLine = useDeleteLayoutLine();

  // handlers

  async function handleDelete() {
    await deleteLayoutLine({ annotationId: annotation?.id, index });
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  // render

  if (!annotation || !hasLayoutLine) return null;

  const caption = `Calepinage ${index + 1}${
    layoutLine.label ? ` — ${layoutLine.label}` : ""
  } · ${layout?.barCount ?? 0} barres · ${(layout?.totalLengthM ?? 0).toFixed(2)} ml`;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {caption}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Supprimer la ligne de calepinage">
        <IconButton
          size="small"
          onClick={handleDelete}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor || "text.primary",
              bgcolor: (accentColor || "#000") + "18",
            },
          }}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
