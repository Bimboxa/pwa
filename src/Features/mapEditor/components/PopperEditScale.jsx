import { useSelector, useDispatch } from "react-redux";

import { setAnchorPositionScale } from "../mapEditorSlice";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";

import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import PopperBox from "Features/layout/components/PopperBox";
import SectionEditScale from "./SectionEditScale";

export default function PopperEditScale() {
  const dispatch = useDispatch();

  // data

  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionScale);
  const scaleAnnotationId = useSelector((s) => s.mapEditor.scaleAnnotationId);

  const resetNewAnnotation = useResetNewAnnotation();

  // helper

  const open = Boolean(anchorPosition);

  // handlers

  async function handleClose() {
    dispatch(setAnchorPositionScale(null));
    resetNewAnnotation();
    dispatch(setTempAnnotations([]));
  }

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
      disableClickAway
      addHeader
    >
      <SectionEditScale />
    </PopperBox>
  );
}
