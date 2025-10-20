import { useDispatch } from "react-redux";

import {
  setBaseMapPoseInBg,
  setBaseMapOpacity,
  setBaseMapGrayScale,
  setSelectedMainBaseMapId,
  setLegendFormat,
} from "Features/mapEditor/mapEditorSlice";
import {
  setBgImageKeyInMapEditor,
  setShowBgImageInMapEditor,
} from "Features/bgImage/bgImageSlice";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setBlueprintIdInMapEditor } from "Features/blueprints/blueprintsSlice";

import useEntityModel from "./useEntityModel";

export default function useOnEntityClick() {
  const dispatch = useDispatch();

  const onEntityClick = (entity) => {
    console.log("debug_1609 click on entity", entity);
    switch (entity?.entityModelType) {
      case "LOCATED_ENTITIES":
        dispatch(
          setSelectedItem({
            type: "ENTITY",
            id: entity.id,
            listingId: entity.listingId,
          })
        );
      case "BLUEPRINT":
        dispatch(setShowBgImageInMapEditor(true));
        dispatch(setBlueprintIdInMapEditor(entity.id));
        if (entity.baseMapPoseInBg) {
          dispatch(setBaseMapPoseInBg(entity.baseMapPoseInBg));
          dispatch(setBaseMapOpacity(entity.baseMapOpacity));
          dispatch(setBaseMapGrayScale(entity.baseMapGrayScale));
        }

        dispatch(setSelectedMainBaseMapId(entity.baseMapId));

        if (entity.bgImageKey)
          dispatch(setBgImageKeyInMapEditor(entity.bgImageKey));

        if (entity.bgImageRawTextAnnotations) {
          dispatch(
            setBgImageRawTextAnnotations(entity.bgImageRawTextAnnotations)
          );
        }

        if (entity.legendFormat) dispatch(setLegendFormat(entity.legendFormat));

        break;

      default:
        break;
    }
  };

  return onEntityClick;
}
