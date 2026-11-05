import { useMemo } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useExtraBaseMapIdsIn3d from "./useExtraBaseMapIdsIn3d";
import useDessinGridBaseMapIds from "Features/baseMapsGrid3d/hooks/useDessinGridBaseMapIds";
import { selectBaseMapsGridScopeOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import { selectBaseMapsGridDessinOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridDessin";

/**
 * Base maps (other than the main one) whose annotations are built in the 3D
 * scene: the chips with a display mode (useExtraBaseMapIdsIn3d) plus, while a
 * base maps grid is displayed, every sheet of that grid (SCOPE module:
 * baseMapsGrid.scopeSheets; Dessin module: every base map of the scope).
 *
 * Single source for the scene (useAutoLoadAnnotationsInThreedEditor) and for
 * whatever lists the annotations picked in it (multi-selection popper /
 * panel): an annotation that can be lassoed in 3D must be resolvable there.
 * The array identity only changes with its content.
 */
export default function useSceneExtraBaseMapIdsIn3d() {
  // data

  const mainBaseMap = useMainBaseMap();
  const chipExtraBaseMapIds = useExtraBaseMapIdsIn3d();
  const gridPinned = useSelector(selectBaseMapsGridScopeOpen);
  const gridDessin = useSelector(selectBaseMapsGridDessinOpen);
  const scopeSheetIds = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.baseMapIds
  );
  const dessinSheetIds = useDessinGridBaseMapIds();

  // helpers

  const sheetIdsKey = useMemo(() => {
    const sheetIds = gridPinned
      ? scopeSheetIds
      : gridDessin
        ? dessinSheetIds
        : null;
    if (!sheetIds) return "";
    return sheetIds
      .filter((id) => id !== mainBaseMap?.id)
      .sort()
      .join(",");
  }, [gridPinned, gridDessin, scopeSheetIds, dessinSheetIds, mainBaseMap?.id]);

  return useMemo(() => {
    if (!sheetIdsKey) return chipExtraBaseMapIds;
    return [
      ...new Set([...chipExtraBaseMapIds, ...sheetIdsKey.split(",")]),
    ].filter(Boolean);
  }, [chipExtraBaseMapIds, sheetIdsKey]);
}
