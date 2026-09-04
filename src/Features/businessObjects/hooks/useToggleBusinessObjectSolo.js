import { useDispatch, useSelector } from "react-redux";

import { setSelectedBusinessObjectId } from "../businessObjectsSlice";
import { clearSelection } from "Features/selection/selectionSlice";
import {
  setSelectedMainBaseMapId,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";

// Clicking a business object toggles its SOLO display: the editors show only
// the annotations linked to it or to its descendants (useAnnotationsV2
// filter keyed on selectedBusinessObjectId), the base map switches and zooms
// to the object's MAIN annotation (the one on the active base map first),
// else to the first linked annotation. Re-clicking the soloed object restores
// the full display. The properties panel is NOT opened — the object's
// properties show when the user opens it (routing on selectedBusinessObjectId).
export default function useToggleBusinessObjectSolo() {
  const dispatch = useDispatch();

  const selectedBusinessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  return (businessObject, soloAnnotations, mainAnnotations) => {
    if (!businessObject) return;

    // toggle off: re-click on the soloed object restores the full display
    if (businessObject.id === selectedBusinessObjectId) {
      dispatch(setSelectedBusinessObjectId(null));
      return;
    }

    // Drop any stale map selection: its annotation may be hidden by the solo,
    // leaving an orphan editing wrapper otherwise.
    dispatch(clearSelection());
    dispatch(setSelectedBusinessObjectId(businessObject.id));

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
