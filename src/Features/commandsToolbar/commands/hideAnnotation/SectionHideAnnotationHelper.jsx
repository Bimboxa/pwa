import { useSelector } from "react-redux";

import { selectHiddenRegistryCount } from "Features/hiddenAnnotations/hiddenAnnotationsSlice";

import { Box, Typography } from "@mui/material";

import SectionShortcutHelpers from "Features/annotations/components/SectionShortcutHelpers";

const SHORTCUTS = [{ key: "Esc", label: "Quitter" }];

// Body of the drawing helper while « Masquer l'annotation » is armed from
// the commands toolbar (mapEditor.enabledDrawingMode === HIDE_ANNOTATION):
// what to do, and how many items are hidden so far. Rendered by
// SectionDrawingHelperContent (2D docked / floating helper, 3D panel). The
// mode stays armed after each click; the hidden items are listed — and shown
// again — from the arrow next to the command button.
export default function SectionHideAnnotationHelper() {
  // strings

  const hintS = "Cliquez sur une annotation pour la masquer";
  const noneS = "Aucun élément masqué";
  const restoreS =
    "Retrouvez les éléments masqués avec la flèche à droite du bouton.";

  // data

  const hiddenCount = useSelector(selectHiddenRegistryCount);

  // helpers

  const countS =
    hiddenCount === 0
      ? noneS
      : hiddenCount === 1
        ? "1 élément masqué"
        : `${hiddenCount} éléments masqués`;

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {hintS}
      </Box>

      <Box
        sx={{
          px: 1.25,
          py: 1,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {countS}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {restoreS}
        </Typography>
      </Box>

      <SectionShortcutHelpers shortcuts={SHORTCUTS} />
    </Box>
  );
}
