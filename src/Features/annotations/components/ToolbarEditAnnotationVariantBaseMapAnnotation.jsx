import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setCanTransformNode } from "Features/mapEditor/mapEditorSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { Box, IconButton, Paper } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import FieldAnnotationLabel from "./FieldAnnotationLabel";
import FieldAnnotationColor from "./FieldAnnotationColor";
import FieldAnnotationIsEraser from "./FieldAnnotationIsEraser";
import IconButtonToggleAnnotationCloseLine from "./IconButtonToggleAnnotationCloseLine";


import { PopperDragHandle } from "Features/layout/components/PopperBox";

export default function ToolbarEditAnnotationVariantBaseMapAnnotation() {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const canTransformNode = useSelector((s) => s.mapEditor.canTransformNode);

  console.log("selectedAnnotation", selectedAnnotation);

  // data

  const updateAnnotation = useUpdateAnnotation();
  const updateEntity = useUpdateEntity();

  // helpers - show

  const showCloseLine = selectedAnnotation?.type === "POLYLINE";
  const type = selectedAnnotation?.type;

  // useEffect

  useEffect(() => {
    return () => {
      dispatch(setCanTransformNode(false));
    };
  }, []);

  // handler

  function handleCanTransformChange() {
    dispatch(setCanTransformNode(!canTransformNode));
  }
  async function handleChange(newAnnotation) {
    await updateAnnotation(newAnnotation);
  }

  async function handleEntityLabelChange(label) {
    const entityId = selectedAnnotation?.entityId;
    if (!entityId) return;
    await updateEntity(entityId, { label });
  }

  async function handleToggleFWC(fwc) {
    const entityId = selectedAnnotation?.entityId;
    if (!entityId) return;
    await updateEntity(entityId, { fwc });
  }

  return (
    <Paper elevation={6} sx={{ display: "flex", alignItems: "center", p: 0.5 }}>
      <PopperDragHandle>
        <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
          <DragIndicatorIcon fontSize="small" />
        </Box>
      </PopperDragHandle>

      {type === "POLYGON" && (
        <Box sx={{ display: "flex", alignItems: "center", mr: 1, gap: 1 }}>
          <FieldAnnotationLabel annotation={selectedAnnotation} onChange={handleChange} />
          <FieldAnnotationColor annotation={selectedAnnotation} onChange={handleChange} />
          <FieldAnnotationIsEraser annotation={selectedAnnotation} onChange={handleChange} />
        </Box>
      )}

      {type === "POLYLINE" && (
        <Box sx={{ display: "flex", alignItems: "center", mr: 1, gap: 1 }}>
          <FieldAnnotationLabel annotation={selectedAnnotation} onChange={handleChange} />
          <FieldAnnotationColor annotation={selectedAnnotation} onChange={handleChange} />
          <IconButtonToggleAnnotationCloseLine annotation={selectedAnnotation} />
        </Box>
      )}

      {type === "IMAGE" && (
        <Box sx={{ display: "flex", alignItems: "center", mr: 1, gap: 1 }}>
          <FieldAnnotationLabel annotation={selectedAnnotation} onChange={handleChange} />
        </Box>
      )}

    </Paper>
  );
}
