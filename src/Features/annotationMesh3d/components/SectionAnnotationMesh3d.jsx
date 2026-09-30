import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Typography } from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import resetMesh3dAnnotationService from "../services/resetMesh3dAnnotationService";

// "Mesh 3D" section of the annotation properties panel: shown on an
// annotation that was drawn in 2D then converted to a mesh (it carries the
// `mesh3dSource` snapshot), with the action that reverts it to its original
// 2D geometry. Self-hiding otherwise.
export default function SectionAnnotationMesh3d({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Mesh 3D";
  const descriptionS =
    "Cette annotation a été convertie en mesh 3D. La réinitialisation restaure sa géométrie 2D d'origine et supprime les modifications du mesh.";
  const resetS = "Réinitialiser";
  const doneS = "Annotation réinitialisée (Ctrl+Z pour annuler)";
  const failedS = "Réinitialisation impossible";

  // helpers

  const canReset = Boolean(
    annotation?.isMesh3d && annotation?.mesh3dSource?.points?.length
  );

  // handlers

  async function handleReset() {
    try {
      const result = await resetMesh3dAnnotationService({
        annotationId: annotation.id,
        dispatch,
      });
      dispatch(
        setToaster(
          result.ok
            ? { message: doneS, severity: "success" }
            : { message: failedS, severity: "warning" }
        )
      );
    } catch (err) {
      console.error("[annotationMesh3d] reset failed", err);
      dispatch(setToaster({ message: failedS, severity: "error" }));
    }
  }

  // render

  if (!canReset) return null;

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
        {descriptionS}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<RestartAltIcon />}
        onClick={handleReset}
        sx={{ textTransform: "none", alignSelf: "flex-start" }}
      >
        {resetS}
      </Button>
    </Box>
  );
}
