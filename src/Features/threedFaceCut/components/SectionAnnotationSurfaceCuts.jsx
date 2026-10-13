import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Typography } from "@mui/material";
import ContentCutOffIcon from "@mui/icons-material/LayersClear";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { isSurfaceCutRemoval } from "../utils/surfaceCutsFrame";

// "Découpes de surface" section of the annotation properties panel: shown
// on a surface host (lathe, shell…) cut by « Découpe horizontale /
// verticale » in 3D (annotation.surfaceCuts), with the action that removes
// every cut (the surface comes back in one piece; Ctrl+Z restores them).
// Self-hiding otherwise.
export default function SectionAnnotationSurfaceCuts({ annotation }) {
  const dispatch = useDispatch();
  const updateAnnotation = useUpdateAnnotation();

  // strings

  const titleS = "Découpes de surface";
  const countS = (n) =>
    n > 1
      ? `${n} découpes en 3D (Coupe face).`
      : "1 découpe en 3D (Coupe face).";
  const removedS = (n) =>
    n > 1 ? `${n} pièces supprimées.` : "1 pièce supprimée.";
  const descriptionS =
    "La surface est affichée en pièces, chacune peut être sélectionnée, supprimée ou peinte séparément.";
  const clearS = "Supprimer les découpes";
  const doneS = "Découpes supprimées (Ctrl+Z pour annuler)";
  const failedS = "Suppression impossible";

  // data

  const entries = annotation?.surfaceCuts ?? [];
  const removedCount = entries.filter(isSurfaceCutRemoval).length;
  const count = entries.length - removedCount;

  // handlers

  async function handleClear() {
    try {
      await updateAnnotation({ id: annotation.id, surfaceCuts: [] });
      dispatch(setToaster({ message: doneS, severity: "success" }));
    } catch (err) {
      console.error("[threedFaceCut] clear surface cuts failed", err);
      dispatch(setToaster({ message: failedS, severity: "error" }));
    }
  }

  // render

  if (!annotation?.id || !entries.length) return null;

  return (
    <Box
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {titleS}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {count > 0 ? `${countS(count)} ` : ""}
        {removedCount > 0 ? `${removedS(removedCount)} ` : ""}
        {descriptionS}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ContentCutOffIcon />}
        onClick={handleClear}
        sx={{ textTransform: "none", alignSelf: "flex-start" }}
      >
        {clearS}
      </Button>
    </Box>
  );
}
