import { useSelector, useDispatch } from "react-redux";

import { setAnchorPositionScale } from "../mapEditorSlice";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";

import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import PopperBox from "Features/layout/components/PopperBox";
import SectionEditScale from "./SectionEditScale";
import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

export default function PopperEditScale({ viewerKey = null }) {
  const dispatch = useDispatch();

  // data

  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionScale);
  const scaleAnnotationId = useSelector((s) => s.mapEditor.scaleAnnotationId);
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // No edit popper while a capture frame owns the screen (Capture tool,
  // Export rapide, POV framing) — same rule as UILayer / PopperMapListings.
  const captureFramingActive = useSelector(selectCaptureFramingActive);

  const resetNewAnnotation = useResetNewAnnotation();

  // helper

  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";
  const open = shouldShow && !captureFramingActive && Boolean(anchorPosition);

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
