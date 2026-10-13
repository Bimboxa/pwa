import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import { formatQtyValue } from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";

// ---------------------------------------------------------------------------
// RowHostBrushAnnotation — one 2D annotation the « Pinceau » created on the
// host instead of a paint (autoCreatedFrom = host, autoGenKind MESH_BRUSH),
// in the host's « Parties peintes » section: template icon on a color
// swatch, "Annotation 2D", "Ligne · 3,20 ml" / "Surface · 12,40 m²". A click
// selects the annotation; the selected one is highlighted.
// ---------------------------------------------------------------------------

export default function RowHostBrushAnnotation({
  annotation,
  template,
  color,
  isSelected,
  onClick,
}) {
  // strings

  const titleS = "Annotation 2D";
  const lineS = "Ligne";
  const surfaceS = "Surface";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const isLine = annotation?.type === "POLYLINE";
  const qties = annotation?.qties;
  const qtyS =
    qties?.enabled === false
      ? `– ${isLine ? "ml" : "m²"}`
      : isLine
        ? `${formatQtyValue(qties?.length)} ml`
        : `${formatQtyValue(qties?.surface)} m²`;
  const label = annotation?.annotationLabel || annotation?.label || titleS;

  // render

  return (
    <Box
      onClick={() => onClick?.(annotation)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        cursor: "pointer",
        bgcolor: isSelected ? "action.selected" : "background.paper",
        "&:hover": {
          bgcolor: isSelected ? "action.selected" : "action.hover",
        },
        "&:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 2,
          flexShrink: 0,
          bgcolor: alpha(color, 0.2),
        }}
      >
        {template && (
          <AnnotationTemplateIcon
            template={template}
            size={20}
            spriteImage={spriteImage}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 700, userSelect: "none", minWidth: 0 }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{
            display: "block",
            fontFamily: "monospace",
            fontWeight: 500,
            color: "text.secondary",
          }}
        >
          {`${isLine ? lineS : surfaceS} · ${qtyS}`}
        </Typography>
      </Box>
    </Box>
  );
}
