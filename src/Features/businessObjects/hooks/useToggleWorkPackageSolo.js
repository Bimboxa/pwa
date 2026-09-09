import { useDispatch, useSelector } from "react-redux";

import { setSoloWorkPackageId } from "../businessObjectsSlice";
import {
  setSelectedMainBaseMapId,
  setZoomTo,
} from "Features/mapEditor/mapEditorSlice";

// The row's filter icon toggles the package's SOLO display: the editors show
// only its linked annotations (useAnnotationsV2 filter); the base map switches
// and zooms to the first linked annotation (active base map first). Re-click
// restores the full display. Same contract as the business-object solo
// (display only — the row click owns the selection).
export default function useToggleWorkPackageSolo() {
  const dispatch = useDispatch();
  const soloWorkPackageId = useSelector(
    (s) => s.businessObjects.soloWorkPackageId
  );
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  return (workPackage, linkedAnnotations) => {
    if (!workPackage) return;
    if (workPackage.id === soloWorkPackageId) {
      dispatch(setSoloWorkPackageId(null));
      return;
    }
    dispatch(setSoloWorkPackageId(workPackage.id));

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
