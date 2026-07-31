import { useSelector } from "react-redux";

import { Paper, Box, Typography } from "@mui/material";
import { RemoveCircleOutline as SubtractIcon } from "@mui/icons-material";

import ListAnnotationSubtractions from "Features/annotations/components/ListAnnotationSubtractions";

// Floating helper shown while a subtraction pick mode is active. Mirrors the
// look of PopperDrawingHelper: an instruction, the live list of already-created
// relations (each removable), and the Escape shortcut to exit the mode.
//
// Serves both directions of the mode — the pivot annotation is either the one
// being carved ("Soustraire une annotation") or the one being subtracted
// ("À soustraire de"). See Features/mapEditor/utils/subtractPickMode.
export default function PopperSubtractHelper() {
  // data

  const subtractSourceAnnotationId = useSelector(
    (s) => s.mapEditor.subtractSourceAnnotationId
  );
  const subtractTargetAnnotationId = useSelector(
    (s) => s.mapEditor.subtractTargetAnnotationId
  );

  const isReverse = Boolean(subtractTargetAnnotationId);
  const pivotAnnotationId =
    subtractSourceAnnotationId || subtractTargetAnnotationId;

  // strings

  const title = isReverse ? "Mode « à soustraire de »" : "Mode soustraction";
  const instruction = isReverse
    ? "Cliquez sur les annotations à creuser avec cette annotation. Toutes les annotations sous le curseur sont prises."
    : "Cliquez sur une annotation pour l'ajouter à la soustraction.";
  const listTitle = isReverse
    ? "Creusées par cette annotation"
    : "Annotations soustraites";
  const emptyLabel = isReverse
    ? "Aucune annotation creusée pour le moment."
    : "Aucune annotation soustraite pour le moment.";

  // render

  if (!pivotAnnotationId) return null;

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
        <Typography variant="subtitle2">{title}</Typography>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {instruction}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {listTitle}
          </Typography>
          <ListAnnotationSubtractions
            annotationId={pivotAnnotationId}
            direction={isReverse ? "SOURCES" : "TARGETS"}
            emptyLabel={emptyLabel}
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
