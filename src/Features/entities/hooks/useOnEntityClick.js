import { useDispatch, useSelector } from "react-redux";

import {
  setBaseMapPoseInBg,
  setBaseMapOpacity,
  setBaseMapGrayScale,
  setSelectedMainBaseMapId,
  setLegendFormat,
  setSelectedNode,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";
import {
  setBgImageKeyInMapEditor,
  setShowBgImageInMapEditor,
  setBgImageRawTextAnnotations,
} from "Features/bgImage/bgImageSlice";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setBlueprintIdInMapEditor } from "Features/blueprints/blueprintsSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";

export default function useOnEntityClick() {
  const dispatch = useDispatch();

  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const onEntityClick = (entity) => {
    console.log("debug_1609 click on entity", entity);
    switch (entity?.entityModelType) {
      case "LOCATED_ENTITY":
        dispatch(
          setSelectedItem({
            type: "ENTITY",
            id: entity.id,
            listingId: entity.listingId,
            entityId: entity.id,
          })
        );
        const annotations = entity.annotations;
        const annotationInMapEditor = annotations.find(
          (a) => a.baseMapId === baseMapId
        );
        if (
          annotations?.length > 0 &&
          !annotations.map((a) => a.baseMapId).includes(baseMapId)
        ) {
          dispatch(setSelectedMainBaseMapId(annotations[0]?.baseMapId));
        }

        if (annotationInMapEditor) {
          dispatch(
            setSelectedNode({
              nodeId: annotationInMapEditor.id,
              nodeType: "ANNOTATION",
              annotationType: annotationInMapEditor.type,
            })
          );
          let zoomTo;
          if (
            ["RECTANGLE", "POLYLINE", "SEGMENT"].includes(
              annotationInMapEditor.type
            )
          ) {
            zoomTo = annotationInMapEditor.points[0];
          } else {
            zoomTo = {
              x: annotationInMapEditor.x,
              y: annotationInMapEditor.y,
            };
          }

          dispatch(setZoomTo(zoomTo));
        }
        break;

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
