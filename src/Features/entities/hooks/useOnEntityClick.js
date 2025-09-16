import { useDispatch } from "react-redux";

import {
  setBaseMapPoseInBg,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import { setBgImageKeyInMapEditor } from "Features/bgImage/bgImageSlice";

import useEntityModel from "./useEntityModel";

export default function useOnEntityClick() {
  const dispatch = useDispatch();

  const onEntityClick = (entity) => {
    console.log("debug_1609 click on entity", entity);
    switch (entity?.entityModelType) {
      case "BLUEPRINT":
        dispatch(setBaseMapPoseInBg(entity.baseMapPoseInBg));
        dispatch(setSelectedMainBaseMapId(entity.baseMapId));
        if (entity.bgImageKey)
          dispatch(setBgImageKeyInMapEditor(entity.bgImageKey));
        break;

      default:
        break;
    }
  };

  return onEntityClick;
}
