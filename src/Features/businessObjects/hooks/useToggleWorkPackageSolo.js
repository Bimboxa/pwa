import { useDispatch, useSelector } from "react-redux";

import { setSelectedWorkPackageId } from "../businessObjectsSlice";
import { clearSelection } from "Features/selection/selectionSlice";
import {
  setSelectedMainBaseMapId,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";

// Clicking a work package toggles its SOLO display: the editors show only
// its linked annotations (useAnnotationsV2 filter); the base map switches
// and zooms to the first linked annotation (active base map first).
// Re-click restores the full display. Same contract as the business-object
// solo (properties panel not opened, solo survives map selections).
export default function useToggleWorkPackageSolo() {
  const dispatch = useDispatch();
  const selectedWorkPackageId = useSelector(
    (s) => s.businessObjects.selectedWorkPackageId
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  return (workPackage, linkedAnnotations) => {
    if (!workPackage) return;
    if (workPackage.id === selectedWorkPackageId) {
      dispatch(setSelectedWorkPackageId(null));
      return;
    }
    dispatch(clearSelection());
    dispatch(setSelectedWorkPackageId(workPackage.id));

    const rows = linkedAnnotations ?? [];
    const target =
      rows.find((a) => a.baseMapId === selectedBaseMapId) ?? rows[0];
    if (target?.baseMapId && target.baseMapId !== selectedBaseMapId)
      dispatch(setSelectedMainBaseMapId(target.baseMapId));
    if (target?.points?.length > 0 && target.points[0]?.x != null) {
      dispatch(setZoomTo(target.points[0]));
    }
  };
}
