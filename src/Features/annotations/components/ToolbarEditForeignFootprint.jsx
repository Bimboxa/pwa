import { Box, Paper, Typography } from "@mui/material";
import { DragIndicator as GripIcon } from "@mui/icons-material";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import IconButtonGoToForeignAnnotation from "./IconButtonGoToForeignAnnotation";

/**
 * Toolbar for a read-only footprint: the projection, onto this base map, of an
 * annotation that lives on another one (a subtraction target, or an
 * annotation revolved around one of this plan's axes).
 *
 * Deliberately reduced to a single action. Every editing action of the normal
 * toolbar (move, resize, delete, template change…) would write against an id
 * that belongs to no row — harmless by construction, but meaningless — so none
 * of them is offered.
 */
export default function ToolbarEditForeignFootprint({ onDragStart }) {
  // data

  const selectedAnnotation = useSelectedAnnotation();

  // strings

  const label =
    selectedAnnotation?.templateLabel ||
    selectedAnnotation?.label ||
    "Annotation";

  // A revolution footprint is the plan projection of an annotation revolved
  // around an axis drawn on this plan; a foreign footprint the silhouette of
  // a subtraction target hosted by another base map.
  const caption = selectedAnnotation?.isRevolutionFootprint
    ? `Empreinte en plan de la révolution autour de « ${
        selectedAnnotation?.revolutionAxisLabel || "l'axe"
      } ».`
    : "Empreinte d'une annotation d'un autre fond de plan.";

  // render

  if (!selectedAnnotation) return null;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <Paper
        elevation={6}
        sx={{ borderRadius: 3, overflow: "hidden", minWidth: 230 }}
      >
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <GripIcon
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
          />
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>

        <Box
          sx={{
            px: 1.25,
            py: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
          <IconButtonGoToForeignAnnotation annotation={selectedAnnotation} />
        </Box>
      </Paper>
    </Box>
  );
}
