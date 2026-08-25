import { Box, Paper, Typography } from "@mui/material";
import { DragIndicator as GripIcon } from "@mui/icons-material";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import IconButtonGoToForeignAnnotation from "./IconButtonGoToForeignAnnotation";

/**
 * Toolbar for a read-only footprint: the projection, onto this base map, of a
 * subtraction target that lives on another one.
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
            Empreinte d&apos;une annotation d&apos;un autre fond de plan.
          </Typography>
          <IconButtonGoToForeignAnnotation annotation={selectedAnnotation} />
        </Box>
      </Paper>
    </Box>
  );
}
