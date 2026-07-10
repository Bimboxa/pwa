import { useCallback } from "react";
import { useDispatch } from "react-redux";

import {
  setNavigateToWorldPoint,
  setSelectAnnotationInThreed,
} from "Features/threedEditor/threedEditorSlice";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getAnnotationBbox from "Features/annotations/utils/getAnnotationBbox";

// Pan the 3D camera (in another tab) to a given annotation. Dispatches the
// fire-and-forget `setNavigateToWorldPoint` event, which is whitelisted in
// syncTabsMiddleware and consumed by useNavigateCameraOnEvent in the 3D tab.
//
// The annotation's `points` are already resolved to basemap image-pixel space
// (useAnnotationsV2 / resolvePoints), so the bbox center is fed directly to
// pixelToWorld — no Konva stage-pose correction is needed (unlike the former
// click-driven path).
export default function useNavigateThreedCameraToAnnotation() {
  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();

  return useCallback(
    (annotation) => {
      if (!baseMap || !annotation) return;
      const imageSize = baseMap.getImageSize?.();
      const meterByPx = baseMap.getMeterByPx?.();
      if (
        !imageSize?.width ||
        !imageSize?.height ||
        !Number.isFinite(meterByPx)
      )
        return;

      const bbox = getAnnotationBbox(annotation);
      if (!bbox) return;
      const centerPx = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      };

      const localMeters = pixelToWorld(centerPx, {
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        meterByPx,
      });
      const worldVec = baseMapLocalToWorld(
        localMeters,
        getBaseMapTransform(baseMap)
      );

      const triggeredAt = Date.now();

      dispatch(
        setNavigateToWorldPoint({
          baseMapId: baseMap.id,
          worldX: worldVec.x,
          worldY: worldVec.y,
          worldZ: worldVec.z,
          triggeredAt,
        })
      );

      if (annotation.id) {
        dispatch(
          setSelectAnnotationInThreed({
            annotationId: annotation.id,
            annotationType: annotation.type,
            listingId: annotation.listingId,
            annotationTemplateId: annotation.annotationTemplateId,
            triggeredAt,
          })
        );
      }
    },
    [baseMap, dispatch]
  );
}
