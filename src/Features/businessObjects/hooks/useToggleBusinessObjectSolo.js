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
// to the first linked annotation. Re-clicking the soloed object restores the
// full display. The properties panel is NOT opened — the object's properties
// show when the user opens it (routing on selectedBusinessObjectId).
export default function useToggleBusinessObjectSolo() {
  const dispatch = useDispatch();

  const selectedBusinessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );

  return (businessObject, soloAnnotations) => {
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

    // soloAnnotations = own + descendants' linked annotations (resolved, in
    // tree order) — pose the camera on the first one.
    const first = soloAnnotations?.[0];
    if (first?.baseMapId) dispatch(setSelectedMainBaseMapId(first.baseMapId));
    if (first?.points?.length > 0) {
      dispatch(setZoomTo(first.points[0]));
    } else if (first?.x != null) {
      dispatch(setZoomTo({ x: first.x, y: first.y }));
    }
  };
}
