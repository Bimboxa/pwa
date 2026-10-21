import { Box, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

// ---------------------------------------------------------------------------
// SoloIconToggle — the row icon as the SOLO toggle, same affordance as the
// template rows of PopperMapListings (AnnotationTemplateRow): a 24px icon
// slot that takes a button shape when the row is hovered, a secondary ring
// while soloed. Used by the « Annotations sans modèle » rows (popper and
// docked Dessin panel) and, around the listing avatar, by the listing rows
// of the Dessin popper (`title` / `size` overrides).
// ---------------------------------------------------------------------------

export default function SoloIconToggle({
  isSolo,
  isHidden = false,
  isRowHovered = false,
  onToggle,
  // Tooltip override (default: Solo / Quitter le solo).
  title,
  // Slot size (px).
  size = 24,
  children,
}) {
  // strings

  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const tooltipS = title ?? (isSolo ? exitSoloS : soloS);

  // handlers

  const handleClick = (e) => {
    e.stopPropagation();
    onToggle?.();
  };

  // render

  return (
    <Tooltip title={tooltipS} arrow placement="left">
      <Box
        onClick={handleClick}
        onDoubleClick={(e) => e.stopPropagation()}
        sx={(theme) => ({
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 1,
          cursor: "pointer",
          transition: "background-color 120ms, box-shadow 120ms",
          ...(isSolo && {
            bgcolor: alpha(theme.palette.secondary.main, 0.15),
            boxShadow: `0 0 0 2px ${theme.palette.secondary.main}`,
          }),
          ...(isRowHovered && {
            bgcolor: "background.paper",
            boxShadow: isSolo
              ? `0 0 0 2px ${theme.palette.secondary.main}, ${theme.shadows[1]}`
              : `0 0 0 1px ${theme.palette.panel.border}, ${theme.shadows[1]}`,
          }),
          "&:hover": {
            bgcolor: "background.paper",
            boxShadow: isSolo
              ? `0 0 0 2px ${theme.palette.secondary.main}, ${theme.shadows[3]}`
              : `0 0 0 1px ${theme.palette.panel.border}, ${theme.shadows[3]}`,
          },
        })}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isHidden ? 0.4 : 1,
            filter: isHidden ? "grayscale(100%)" : "none",
          }}
        >
          {children}
        </Box>
      </Box>
    </Tooltip>
  );
}
