import { useMemo } from "react";
import { useSelector } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDisabledBaseMapIds from "Features/baseMaps/hooks/useDisabledBaseMapIds";
import useBlocksBaseMaps from "Features/blocks/hooks/useBlocksBaseMaps";

/**
 * Base maps (other than the main one) whose annotations are requested in the 3D
 * scene, i.e. those set to a display mode !== NONE in
 * `threedEditor.annotationsModeByBaseMapIdIn3d`. The main base map is always
 * loaded via `filterByMainBaseMap` and is excluded here.
 *
 * Base maps of the listings disabled for the scope (folder eye-off) are left
 * out as well: their persisted mode must not load their annotations, legend
 * entries or counts (see useDisabledBaseMapIds).
 *
 * Blocks context: only the base maps of the main one's family are kept (the
 * blocks base maps on a blocks base map, the regular ones otherwise). The
 * persisted modes are left untouched, so each family finds its eyes back.
 */
export default function useExtraBaseMapIdsIn3d() {
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const { disabledIds } = useDisabledBaseMapIds();
  const blocksBaseMaps = useBlocksBaseMaps();
  const isBlocksContext = Boolean(mainBaseMap?.isBlocksBaseMap);

  return useMemo(() => {
    const blocksBaseMapIds = new Set((blocksBaseMaps ?? []).map((b) => b.id));
    return Object.keys(annotationsModeByBaseMapId || {}).filter(
      (id) =>
        id !== mainBaseMap?.id &&
        !disabledIds.has(id) &&
        blocksBaseMapIds.has(id) === isBlocksContext
    );
  }, [
    annotationsModeByBaseMapId,
    mainBaseMap?.id,
    disabledIds,
    blocksBaseMaps,
    isBlocksContext,
  ]);
}
