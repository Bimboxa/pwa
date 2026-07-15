import { useEffect } from "react";

import { useDispatch } from "react-redux";

import { setEditorMode } from "Features/threedEditor/threedEditorSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionsBaseMapTransform3D from "./SectionsBaseMapTransform3D";

// "Position 3D" drill-in of PanelBaseMapProperties when the 3D viewer is
// active: transform sections (rotation / translation / offset) targeting the
// given baseMap. While open, the viewer is put in BASEMAP_POSITION editor
// mode so the transform gizmo owns the pointer (annotation selection and
// basemap re-selection are suppressed — see MainThreedEditor.handleClick).
export default function PanelBaseMapTransformInThreed({ baseMap, onBack }) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setEditorMode("BASEMAP_POSITION"));
    return () => dispatch(setEditorMode("NAVIGATION"));
  }, [dispatch]);

  if (!baseMap) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={onBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Position 3D
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {baseMap.name || "Fond de plan"}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5 }}>
        <SectionsBaseMapTransform3D baseMap={baseMap} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
