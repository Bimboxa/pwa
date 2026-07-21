import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import useSelectedProfileLineData from "Features/annotations/hooks/useSelectedProfileLineData";
import useDeleteProfileLine from "Features/annotations/hooks/useDeleteProfileLine";

// Inline editor for the currently sub-selected profileLine ("Profil"). The
// vertical profile itself (per-vertex heights) is edited in the Élévation
// panel — this row only names the profile, opens the panel, and deletes it.
export default function ToolbarEditProfileLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const { annotation, index, profileLine, hasProfileLine } =
    useSelectedProfileLineData();
  const deleteProfileLine = useDeleteProfileLine();

  // handlers

  function handleOpenElevation() {
    dispatch(setSelectedMenuItemKey("ELEVATION"));
  }

  async function handleDelete() {
    await deleteProfileLine({ annotationId: annotation?.id, index });
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  // render

  if (!annotation || !hasProfileLine) return null;

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
        {`Profil ${index + 1} (${profileLine.points.length} points)`}
      </Typography>
      <Button size="small" onClick={handleOpenElevation} sx={{ ml: 0.5 }}>
        Éditer l'élévation
      </Button>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Supprimer le profil">
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
