import { useDispatch } from "react-redux";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import ListAnnotationSubtractions from "./ListAnnotationSubtractions";

export default function SectionAnnotationSubtractions({ annotation }) {
  // data

  const dispatch = useDispatch();
  const { relsBySource } = useAnnotationSubtractions();
  const rels = relsBySource.get(annotation?.id) ?? [];

  // handlers

  function handleRefresh() {
    // Force a recompute of the annotations pipeline (3D carve + quantities),
    // e.g. after the height of a subtracted annotation was changed.
    dispatch(triggerAnnotationsUpdate());
    dispatch(
      setToaster({ message: "Soustraction recalculée", severity: "info" })
    );
  }

  // render

  if (rels.length === 0) return null;

  return (
    <Box
      sx={{ width: 1, p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
          Soustractions
        </Typography>
        <Tooltip title="Relancer la soustraction">
          <IconButton size="small" onClick={handleRefresh}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <ListAnnotationSubtractions annotationId={annotation?.id} />
    </Box>
  );
}
