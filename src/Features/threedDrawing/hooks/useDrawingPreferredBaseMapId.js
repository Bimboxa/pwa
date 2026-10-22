import { useSelector } from "react-redux";

// Base map a 3D drawing lands on when the geometry alone cannot decide:
// several base maps left at the default pose stack at the origin (coplanar
// plane hits under the cursor), or a point snapped to a vertex / edge / axis
// lock, which carries no base map of its own.
//
// The base map selected in 3D wins — a plain click on its image
// (`baseMaps.selectedBaseMapId`, the one the properties panel shows); without
// one, the main base map selected in 2D. The 3D selection is dropped whenever
// the main base map changes (baseMapsSlice matcher), so it never outlives the
// plan the user switched to.
export default function useDrawingPreferredBaseMapId() {
  const selectedIn3dId = useSelector((s) => s.baseMaps.selectedBaseMapId);
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  return selectedIn3dId ?? mainBaseMapId ?? null;
}
