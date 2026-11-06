import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { Box, Switch, Tooltip, Typography } from "@mui/material";

import db from "App/db/db";

// « Accroche sur les sommets (3D) » of an imported 3D object (OBJECT_3D):
// off by default — the 3D snap index (useVertexSnap's buildIndex) walks every
// vertex and edge of a snappable mesh, which freezes the drawing tools on a
// heavy model. The row flag `vertexSnap3d` opts the object back in.
// Changing it rebuilds the object in 3D (the GLB is parsed again).
export default function FieldAnnotationVertexSnap3d({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Accroche sur les sommets (3D)";
  const helperS =
    "Accroche des outils 3D sur les sommets et arêtes de l'objet. À laisser désactivé sur une maquette lourde.";

  // data

  const checked = Boolean(annotation?.vertexSnap3d);

  // handlers

  async function handleChange(e) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, {
      vertexSnap3d: e.target.checked,
    });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <Tooltip title={helperS} placement="left">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="body2">{labelS}</Typography>
        <Switch size="small" checked={checked} onChange={handleChange} />
      </Box>
    </Tooltip>
  );
}
