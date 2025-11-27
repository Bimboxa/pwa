import { useSelector, useDispatch } from "react-redux";

import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";
import { setAnnotationToolbarPosition } from "../mapEditorSlice";

export default function PopperEditAnnotation({ viewerKey = null }) {
  const dispatch = useDispatch();
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // Only show popper if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  const open =
    shouldShow &&
    Boolean(anchorPosition) &&
    selectedNode.annotationType === "POLYLINE" &&
    selectedNode?.nodeType === "ANNOTATION";

  console.log("selectedNode", selectedNode);

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
          key={`annotation-toolbar-${selectedNode?.id || "none"}-${
            viewerKey || "MAP"
          }`}
          open={open}
          anchorPosition={anchorPosition}
          onClose={handleClose}
        >
          <ToolbarEditAnnotation />
        </PopperBox>
      )}
    </>
  );
}
