import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setEditedAnnotation } from "../annotationsSlice";

import { setCanTransformNode } from "Features/mapEditor/mapEditorSlice";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import { Box, IconButton, Paper } from "@mui/material";
import { Lock, LockOpen } from "@mui/icons-material";

import FieldAnnotationHeight from "./FieldAnnotationHeight";
import FieldAnnotationShapeCode from "./FieldAnnotationShapeCode";

export default function ToolbarEditAnnotation() {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const canTransformNode = useSelector((s) => s.mapEditor.canTransformNode);

  // data

  const updateAnnotation = useUpdateAnnotation();

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

  return (
    <Paper elevation={6} sx={{ display: "flex", alignItems: "center" }}>
      <IconButton onClick={handleCanTransformChange} size="small">
        {canTransformNode ? (
          <LockOpen fontSize="small" />
        ) : (
          <Lock fontSize="small" />
        )}
      </IconButton>
      <FieldAnnotationHeight
        annotation={selectedAnnotation}
        onChange={handleChange}
      />
      <FieldAnnotationShapeCode
        annotation={selectedAnnotation}
        onChange={handleChange}
      />
    </Paper>
  );
}
