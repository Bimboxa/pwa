import { useSelector } from "react-redux";

import { Paper, Box, Typography } from "@mui/material";
import { RemoveCircleOutline as SubtractIcon } from "@mui/icons-material";

import ListAnnotationSubtractions from "Features/annotations/components/ListAnnotationSubtractions";

// Floating helper shown while the subtraction pick mode is active. Mirrors the
// look of PopperDrawingHelper: an instruction, the live list of already-added
// subtractions (each removable), and the Escape shortcut to exit the mode.
export default function PopperSubtractHelper() {
  const sourceAnnotationId = useSelector(
    (s) => s.mapEditor.subtractSourceAnnotationId
  );

  if (!sourceAnnotationId) return null;

  return (
    <Paper
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 50,
        left: 50,
        zIndex: 10,
        width: 290,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: "grey.900",
          color: "common.white",
          borderTopLeftRadius: (t) => t.shape.borderRadius,
          borderTopRightRadius: (t) => t.shape.borderRadius,
        }}
      >
        <SubtractIcon fontSize="small" />
        <Typography variant="subtitle2">Mode soustraction</Typography>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Cliquez sur une annotation pour l'ajouter à la soustraction.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Annotations soustraites
          </Typography>
          <ListAnnotationSubtractions
            annotationId={sourceAnnotationId}
            emptyLabel="Aucune annotation soustraite pour le moment."
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              px: 0.75,
              py: 0.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 0.5,
              fontSize: "0.7rem",
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Esc
          </Box>
          <Typography variant="caption" color="text.secondary">
            Quitter le mode soustraction
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
