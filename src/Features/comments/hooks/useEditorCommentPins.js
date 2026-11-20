import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Located infos the DISPLAYED editor can show as pins:
// - 2D: the ones located on the main base map;
// - 3D: every one with a world position.
// Shared by the pins layer and the count chip of the strip.
export default function useEditorCommentPins(comments) {
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const mainBaseMap = useMainBaseMap();

  const isThreed = isThreedFamilyViewerKey(effectiveKey);
  const mainBaseMapId = mainBaseMap?.id ?? null;

  return (comments ?? []).filter((c) =>
    isThreed
      ? Boolean(c.location?.worldPosition)
      : Boolean(c.location?.point) && c.location.baseMapId === mainBaseMapId
  );
}
