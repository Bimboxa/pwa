import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

// ---------------------------------------------------------------------------
// RowDuplicateAnnotation — one duplicate of the helper list: the template
// icon (same per-type glyph as the edit toolbar header: line, strip…),
// label, overlap line. Clicking the row selects the
// annotation on the map (the parent passes useSelectAnnotationFromPanel).
// ---------------------------------------------------------------------------

export default function RowDuplicateAnnotation({ row, selected, onClick }) {
  // strings

  const totalS = "total";
  const partialS = "partiel";

  // helpers

  const partners = row.partnerIds?.length ?? 0;
  const linkedS = partners > 1 ? ` · ${partners} doublons liés` : "";
  const detailS = `${row.overlapText} · ${row.isTotal ? totalS : partialS}${linkedS}`;

  // render

  return (
    <Box
      onClick={() => onClick?.(row)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        cursor: "pointer",
        bgcolor: selected
          ? (theme) => alpha(theme.palette.secondary.main, 0.12)
          : "background.paper",
        "&:hover": {
          bgcolor: selected
            ? (theme) => alpha(theme.palette.secondary.main, 0.18)
            : "action.hover",
        },
        "&:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <AnnotationTemplateIcon
        template={row.template ?? row.annotation}
        size={24}
        use3D={false}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 700, userSelect: "none" }}
        >
          {row.label}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{
            display: "block",
            fontFamily: "monospace",
            fontWeight: 500,
            color: row.isTotal ? "warning.main" : "text.secondary",
          }}
        >
          {detailS}
        </Typography>
      </Box>
    </Box>
  );
}
