import { useSelector, useDispatch } from "react-redux";

import PopperBox from "Features/layout/components/PopperBox";
import ToolbarEditAnnotation from "Features/annotations/components/ToolbarEditAnnotation";
import { setAnnotationToolbarPosition } from "../mapEditorSlice";

export default function PopperEditAnnotation() {
  const dispatch = useDispatch();
  const anchorPosition = useSelector(
    (s) => s.mapEditor.annotationToolbarPosition
  );
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  const open =
    Boolean(anchorPosition) && selectedNode?.nodeType === "ANNOTATION";

  const handleClose = () => {
    dispatch(setAnnotationToolbarPosition(null));
  };

  return (
    <>
      {open && (
        <PopperBox
          key={`annotation-toolbar-${selectedNode?.id || "none"}`}
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

