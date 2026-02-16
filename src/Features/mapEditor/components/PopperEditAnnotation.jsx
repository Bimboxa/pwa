import { useSelector, useDispatch } from "react-redux";
import { selectSelectedItems } from "Features/selection/selectionSlice";

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

  const selectedItems = useSelector(selectSelectedItems);
  const selectedNode = selectedItems.length === 1 ? { nodeId: selectedItems[0].nodeId, nodeType: selectedItems[0].type } : null;

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedAnnotation = useSelectedAnnotation();

  console.log("debug_2701_A_selectedAnnotation", selectedAnnotation, selectedNode);

  // Note: used annotationType if available in item (it wasn't in InteractionLayer), falling back to selectedAnnotation logic
  const type = selectedNode?.annotationType || selectedAnnotation?.type;

  // helpers

  // Only show popper if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  const open =
    shouldShow &&
    Boolean(anchorPosition) &&
    ["MARKER", "POINT", "POLYLINE", "POLYGON", "IMAGE", "RECTANGLE", "STRIP",].includes(type) &&
    selectedNode?.nodeType === "ANNOTATION";

  // helper - isBaseMapAnnotation

  const isBaseMapAnnotation = selectedAnnotation?.isBaseMapAnnotation;

  // helper - anchorPlacement

  let anchorPlacement = "bottomMiddle";

  if (["IMAGE", "RECTANGLE"].includes(selectedAnnotation.type)) {
    anchorPlacement = "topLeft";
  }

  let offset = [0, -100];
  if (["IMAGE", "RECTANGLE"].includes(selectedAnnotation.type)) {
    offset = [10, 0];
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
          anchorPlacement={anchorPlacement}
          showGrabHandle={true}
          offset={offset}
        >

          {!isBaseMapAnnotation ? <ToolbarEditAnnotation /> : <ToolbarEditAnnotationVariantBaseMapAnnotation />}

        </PopperBox>
      )}
    </>
  );
}
