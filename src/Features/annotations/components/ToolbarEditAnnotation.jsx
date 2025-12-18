import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";

import { setCanTransformNode } from "Features/mapEditor/mapEditorSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import { Box, IconButton, Paper } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import FieldAnnotationEntityLabel from "./FieldAnnotationEntityLabel";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationShapeCode from "./FieldAnnotationShapeCode";
import FieldAnnotationFillAndStroke from "./FieldAnnotationFillAndStroke";
import FieldToggleFWC from "Features/fwc/components/FieldToggleFWC";
import IconButtonDialogCloneAnnotation from "./IconButtonDialogCloneAnnotation";
import IconButtonToggleAnnotationCloseLine from "./IconButtonToggleAnnotationCloseLine";
import ButtonAnnotationTemplate from "./ButtonAnnotationTemplate";
import IconButtonCloneAnnotation from "./IconButtonCloneAnnotation";

import { PopperDragHandle } from "Features/layout/components/PopperBox";

export default function ToolbarEditAnnotation() {
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

      <ButtonAnnotationTemplate annotation={selectedAnnotation} />
      {/* <IconButton onClick={handleCanTransformChange} size="small">
        {canTransformNode ? (
          <LockOpen fontSize="small" />
        ) : (
          <Lock fontSize="small" />
        )}
      </IconButton> */}
      {/* <FieldAnnotationEntityLabel
        value={selectedAnnotation?.entity?.label}
        onChange={handleEntityLabelChange}
      /> */}

      {/* <FieldToggleFWC value={selectedAnnotation?.entity?.fwc} onChange={handleToggleFWC} /> */}
      {/* <FieldAnnotationFillAndStroke
        annotation={selectedAnnotation}
        onChange={handleChange}
      /> */}
      {/* <FieldAnnotationShapeCode
        annotation={selectedAnnotation}
        onChange={handleChange}
      /> */}
      {/* <FieldAnnotationHeight
        annotation={selectedAnnotation}
        onChange={handleChange}
      /> */}

      {showCloseLine && (
        <IconButtonToggleAnnotationCloseLine annotation={selectedAnnotation} />
      )}
      <Box sx={{ ml: 2 }}>
        <IconButtonCloneAnnotation annotation={selectedAnnotation} />
      </Box>
    </Paper>
  );
}
