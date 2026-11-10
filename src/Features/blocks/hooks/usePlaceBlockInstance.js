import { useDispatch } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { BLOCK_INSTANCE_TYPE } from "../utils/blockTypes";

// Arms the placement of instances of a block: each click on the plan drops
// one (the mode stays armed until Escape) — same one-click gesture as the 3D
// objects of the library.
export default function usePlaceBlockInstance() {
  const dispatch = useDispatch();

  return function placeBlockInstance(block) {
    if (!block?.id) return;
    dispatch(
      setNewAnnotation({
        type: BLOCK_INSTANCE_TYPE,
        instanceOfBlockId: block.id,
        isTemplateless: true,
        label: block.label,
      })
    );
    dispatch(setEnabledDrawingMode("ONE_CLICK"));
  };
}
