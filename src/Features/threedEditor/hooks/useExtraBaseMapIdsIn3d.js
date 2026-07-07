import { useMemo } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

/**
 * Base maps (other than the main one) whose annotations are requested in the 3D
 * scene, i.e. those set to a display mode !== NONE in
 * `threedEditor.annotationsModeByBaseMapIdIn3d`. The main base map is always
 * loaded via `filterByMainBaseMap` and is excluded here.
 */
export default function useExtraBaseMapIdsIn3d() {
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const mainBaseMap = useMainBaseMap();

  return useMemo(
    () =>
      Object.keys(annotationsModeByBaseMapId || {}).filter(
        (id) => id !== mainBaseMap?.id
      ),
    [annotationsModeByBaseMapId, mainBaseMap?.id]
  );
}
