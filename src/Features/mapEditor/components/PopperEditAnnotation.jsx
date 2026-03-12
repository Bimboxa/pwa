import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useSelectedNodes from "../hooks/useSelectedNodes";

import { setAnnotationToolbarPosition } from "../mapEditorSlice";

import db from "App/db/db";
import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";
import ToolbarEditAnnotationVariantBaseMapAnnotation from "Features/annotations/components/ToolbarEditAnnotationVariantBaseMapAnnotation";


export default function PopperEditAnnotation({ viewerKey = null }) {
  const dispatch = useDispatch();

  // data
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );

  const { node: selectedNode } = useSelectedNodes()

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedAnnotation = useSelectedAnnotation();
  const selectedItems = useSelector(selectSelectedItems);

  // Note: used annotationType if available in item (it wasn't in InteractionLayer), falling back to selectedAnnotation logic
  const type = selectedNode?.annotationType || selectedAnnotation?.type;

  // helpers

  // Only show popper if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  // Only show single toolbar when exactly 1 item is selected (not multi-selection)
  const isSingleSelection = selectedItems.length === 1;

  const open =
    shouldShow &&
    isSingleSelection &&
    Boolean(anchorPosition) &&
    ["MARKER", "POINT", "POLYLINE", "POLYGON", "IMAGE", "RECTANGLE", "STRIP",].includes(type) &&
    selectedNode?.nodeType === "ANNOTATION";

  // helper - isBaseMapAnnotation

  const listing = useLiveQuery(
    () => selectedAnnotation?.listingId ? db.listings.get(selectedAnnotation.listingId) : null,
    [selectedAnnotation?.listingId]
  );
  const isBaseMapAnnotation = listing?.isForBaseMaps === true;

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
          paperProps={{ elevation: 0, sx: { background: "transparent" } }}
        >

          {!isBaseMapAnnotation ? <ToolbarEditAnnotation /> : <ToolbarEditAnnotationVariantBaseMapAnnotation />}

        </PopperBox>
      )}
    </>
  );
}
