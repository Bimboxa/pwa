import { useMemo } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDisabledBaseMapIds from "Features/baseMaps/hooks/useDisabledBaseMapIds";

/**
 * Base maps (other than the main one) whose annotations are requested in the 3D
 * scene, i.e. those set to a display mode !== NONE in
 * `threedEditor.annotationsModeByBaseMapIdIn3d`. The main base map is always
 * loaded via `filterByMainBaseMap` and is excluded here.
 *
 * Base maps of the listings disabled for the scope (folder eye-off) are left
 * out as well: their persisted mode must not load their annotations, legend
 * entries or counts (see useDisabledBaseMapIds).
 */
export default function useExtraBaseMapIdsIn3d() {
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const { disabledIds } = useDisabledBaseMapIds();

  return useMemo(
    () =>
      Object.keys(annotationsModeByBaseMapId || {}).filter(
        (id) => id !== mainBaseMap?.id && !disabledIds.has(id)
      ),
    [annotationsModeByBaseMapId, mainBaseMap?.id, disabledIds]
  );
}
