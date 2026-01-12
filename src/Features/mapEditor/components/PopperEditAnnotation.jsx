import { useSelector, useDispatch } from "react-redux";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

import { setAnnotationToolbarPosition } from "../mapEditorSlice";

import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";
import ToolbarEditAnnotationVariantBaseMapAnnotation from "Features/annotations/components/ToolbarEditAnnotationVariantBaseMapAnnotation";


export default function PopperEditAnnotation({ viewerKey = null }) {
  const dispatch = useDispatch();

  // data
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedAnnotation = useSelectedAnnotation();

  // helpers

  // Only show popper if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  const open =
    shouldShow &&
    Boolean(anchorPosition) &&
    ["POLYLINE", "POLYGON", "IMAGE", "RECTANGLE"].includes(selectedNode?.annotationType) &&
    selectedNode?.nodeType === "ANNOTATION";

  // helper - isBaseMapAnnotation

  const isBaseMapAnnotation = selectedAnnotation?.isBaseMapAnnotation;

  // helper - anchorPlacement

  let anchorPlacement = "bottomMiddle";
  if (["IMAGE", "RECTANGLE"].includes(selectedAnnotation.type)) {
    anchorPlacement = "topLeft";
  }

  // handlers

  const handleClose = () => {
    // Only close if this popper's viewer is active
    if (shouldShow) {
      dispatch(setAnnotationToolbarPosition(null));
    }
  };

  return (
    <>
      {open && (
        <PopperBox
          key={`annotation-toolbar-${selectedNode?.id || "none"}-${viewerKey || "MAP"
            }`}
          open={open}
          anchorPosition={anchorPosition}
          onClose={handleClose}
          disableClickAway={true}
          anchorPlacement="bottomMiddle"
          showGrabHandle={true}
        >

          {!isBaseMapAnnotation ? <ToolbarEditAnnotation /> : <ToolbarEditAnnotationVariantBaseMapAnnotation />}

        </PopperBox>
      )}
    </>
  );
}
