import { useDispatch, useSelector } from "react-redux";

import { setImageScaleDraft } from "../mapEditorSlice";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";

import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import PopperBox from "Features/layout/components/PopperBox";
import SectionImageScale from "./SectionImageScale";
import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

// Popper of the IMAGE scale tool — opens once the 2-click cote is drawn
// (imageScaleDraft.anchorPosition), same shell as PopperEditScale.
export default function PopperImageScale({ viewerKey = null }) {
  const dispatch = useDispatch();

  // data

  const draft = useSelector((s) => s.mapEditor.imageScaleDraft);
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const resetNewAnnotation = useResetNewAnnotation();

  // helpers

  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";
  const open =
    shouldShow && !captureFramingActive && Boolean(draft?.anchorPosition);

  // handlers

  function handleClose() {
    dispatch(setImageScaleDraft(null));
    dispatch(setTempAnnotations([]));
    resetNewAnnotation();
  }

  return (
    <PopperBox
      open={open}
      anchorPosition={draft?.anchorPosition}
      onClose={handleClose}
      disableClickAway
      addHeader
    >
      <SectionImageScale />
    </PopperBox>
  );
}
