import { useSelector, useDispatch } from "react-redux";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { setAnnotationsToolbarPosition } from "../mapEditorSlice";

import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotations from "Features/annotations/components/ToolbarEditAnnotations";

export default function PopperEditAnnotations({ viewerKey = null, allAnnotations }) {
  const dispatch = useDispatch();

  // data
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationsToolbarPosition
  );

  const selectedItems = useSelector(selectSelectedItems);
  const selectedNodes = selectedItems.map(i => ({ nodeId: i.nodeId, nodeType: i.type }));

  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // Only show popper if viewerKey matches active viewer (or if viewerKey is not specified, show for MAP)
  const shouldShow = viewerKey
    ? activeViewerKey === viewerKey
    : activeViewerKey === "MAP";

  const open = shouldShow && Boolean(anchorPosition) && selectedNodes?.length > 1;

  // helper - anchorPlacement

  let anchorPlacement = "bottomMiddle";

  // handlers

  const handleClose = () => {

    dispatch(setAnnotationsToolbarPosition(null));

  };

  return (
    <>
      {open && (
        <PopperBox
          key={`annotation-toolbar-${selectedNodes?.[0]?.nodeId || "none"}-${viewerKey || "MAP"
            }`}
          open={open}
          anchorPosition={anchorPosition}
          onClose={handleClose}
          disableClickAway={true}
          anchorPlacement={anchorPlacement}
          showGrabHandle={true}
          offset={[0, -50]}
          paperProps={{ elevation: 0, sx: { background: "transparent" } }}
        >

          <ToolbarEditAnnotations allAnnotations={allAnnotations} />

        </PopperBox>
      )}
    </>
  );
}
