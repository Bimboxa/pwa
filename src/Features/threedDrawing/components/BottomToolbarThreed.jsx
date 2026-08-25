import { useDispatch, useSelector } from "react-redux";

import { toggleClippingPlaneEditing } from "Features/threedEditor/threedEditorSlice";

import { Button, Divider, Paper, Stack, Tooltip } from "@mui/material";
import ContentCutIcon from "@mui/icons-material/ContentCut";

import ButtonExtrudeThreed from "Features/threedExtrude/components/ButtonExtrudeThreed";
import ButtonMeshThreed from "Features/threedMesh/components/ButtonMeshThreed";
import ButtonMoveBaseMapThreed from "Features/threedBaseMapMove/components/ButtonMoveBaseMapThreed";
import ButtonRotateBaseMapThreed from "Features/threedBaseMapMove/components/ButtonRotateBaseMapThreed";
import ButtonMoveAnnotationThreed from "Features/threedAnnotationMove/components/ButtonMoveAnnotationThreed";
import ButtonRotateAnnotationThreed from "Features/threedAnnotationMove/components/ButtonRotateAnnotationThreed";

// Floating bottom toolbar for the main 3D viewer. Its content does not depend
// on the current selection: the extrude ("push/pull") entry point + the meshing
// one (MESHES viewer only), then the clipping plane. Face drawing has no button
// here: it is armed by picking a template row in PopperMapListings (see
// useTemplateFaceDrawBridge).
// Viewer module (read-only): the creation/modification actions ("Extruder",
// "Mailler") are hidden — only "Coupe" remains.
// Fond de plan module (BASE_MAPS): base-map placement only — "Déplacer" /
// "Tourner" (base map), no "Extruder" nor "Coupe".
// Dessin module (MAP): "Déplacer" / "Tourner" act on the selected
// ANNOTATIONS (threedAnnotationMove) — the base-map versions stay in the
// other modules.
// The zoom out lives outside the toolbar (ButtonZoomOutThreed, bottom-right
// of the editor).
export default function BottomToolbarThreed() {
  const dispatch = useDispatch();

  // Meshing is confined to the MESHES viewer (mailles are only displayed
  // there), so the "Mailler" entry point hides in the plain THREED viewer.
  const isMeshesViewer = useSelector(
    (s) => s.viewers.selectedViewerKey === "MESHES"
  );
  const isViewerModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "THREED"
  );
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );
  const isMapModule = useSelector((s) => s.viewers.selectedViewerKey === "MAP");
  const clippingEditing = useSelector(
    (s) => s.threedEditor.clippingPlane.editing
  );

  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {!isViewerModule && (
          <>
            {!isBaseMapsModule && <ButtonExtrudeThreed />}
            {isMeshesViewer && <ButtonMeshThreed />}
            {!isMapModule && <ButtonMoveBaseMapThreed />}
            {!isMapModule && <ButtonRotateBaseMapThreed />}
            {isMapModule && <ButtonMoveAnnotationThreed />}
            {isMapModule && <ButtonRotateAnnotationThreed />}
            {/* No leading divider when nothing precedes "Coupe" (Viewer
                module). */}
            {!isBaseMapsModule && (
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            )}
          </>
        )}
        {!isBaseMapsModule && (
          <Tooltip title="Plan de coupe">
            <Button
              size="small"
              variant={clippingEditing ? "contained" : "outlined"}
              color={clippingEditing ? "secondary" : "inherit"}
              startIcon={<ContentCutIcon sx={{ fontSize: 18 }} />}
              onClick={() => dispatch(toggleClippingPlaneEditing())}
              sx={{ textTransform: "none", borderRadius: "8px" }}
            >
              Coupe
            </Button>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}
