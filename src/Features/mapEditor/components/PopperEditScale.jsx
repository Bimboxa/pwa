import { useSelector, useDispatch } from "react-redux";

import { setAnchorPositionScale } from "../mapEditorSlice";

import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";

import PopperBox from "Features/layout/components/PopperBox";
import SectionEditScale from "./SectionEditScale";

export default function PopperEditScale() {
  const dispatch = useDispatch();

  // data

  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionScale);
  const scaleAnnotationId = useSelector((s) => s.mapEditor.scaleAnnotationId);

  const deleteAnnotation = useDeleteAnnotation();

  // helper

  const open = Boolean(anchorPosition);

  // handlers

  async function handleClose() {
    dispatch(setAnchorPositionScale(null));
    if (scaleAnnotationId) deleteAnnotation(scaleAnnotationId);
  }

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
    >
      <SectionEditScale />
    </PopperBox>
  );
}
