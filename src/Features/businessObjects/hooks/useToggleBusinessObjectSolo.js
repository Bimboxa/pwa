import { useDispatch, useSelector } from "react-redux";

import { setSoloBusinessObjectId } from "../businessObjectsSlice";
import {
  setSelectedMainBaseMapId,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";

// The row's filter icon toggles the object's SOLO display: the editors show
// only the annotations linked to it or to its descendants (useAnnotationsV2
// filter keyed on soloBusinessObjectId), the base map switches and zooms
// to the object's MAIN annotation (the one on the active base map first),
// else to the first linked annotation. Re-clicking the icon restores the full
// display. Display only: the row CLICK owns the selection (zonings.soloZone
// pattern), so the solo survives every selection change.
export default function useToggleBusinessObjectSolo() {
  const dispatch = useDispatch();

  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  return (businessObject, soloAnnotations, mainAnnotations) => {
    if (!businessObject) return;

    // toggle off: re-click on the soloed object restores the full display
    if (businessObject.id === soloBusinessObjectId) {
      dispatch(setSoloBusinessObjectId(null));
      return;
    }

    dispatch(setSoloBusinessObjectId(businessObject.id));

    // Camera target: main annotation on the active base map → first main
    // annotation → first linked annotation (own + descendants', tree order).
    const mains = mainAnnotations ?? [];
    const target =
      mains.find((a) => a.baseMapId === selectedBaseMapId) ??
      mains[0] ??
      soloAnnotations?.[0];
    if (target?.baseMapId) dispatch(setSelectedMainBaseMapId(target.baseMapId));
    if (target?.points?.length > 0) {
      dispatch(setZoomTo(target.points[0]));
    } else if (target?.x != null) {
      dispatch(setZoomTo({ x: target.x, y: target.y }));
    }
  };
}
