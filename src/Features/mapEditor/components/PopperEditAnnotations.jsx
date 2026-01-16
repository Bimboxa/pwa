import { useSelector, useDispatch } from "react-redux";

import { setAnnotationsToolbarPosition } from "../mapEditorSlice";

import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotations from "Features/annotations/components/ToolbarEditAnnotations";

export default function PopperEditAnnotations({ viewerKey = null, allAnnotations }) {
  const dispatch = useDispatch();

  // data
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationsToolbarPosition
  );
  const selectedNodes = useSelector((s) => s.mapEditor.selectedNodes);
  const activeViewerKey = useSelector((s) => s.viewers.selectedViewerKey);


  const open = Boolean(anchorPosition) && selectedNodes?.length > 1;

  console.log("debug_151_open", anchorPosition)

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
        >

          <ToolbarEditAnnotations allAnnotations={allAnnotations} />

        </PopperBox>
      )}
    </>
  );
}
