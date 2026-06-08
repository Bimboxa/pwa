import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isActiveViewer = selectedViewerKey === "THREED";
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  const baseMapOpacityIn3d = useSelector(
    (s) => s.threedEditor.baseMapOpacityIn3d
  );
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  // Other base maps whose annotations are requested (mode !== NONE), excluding
  // the main one (always loaded by `filterByMainBaseMap`).
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const mainBaseMap = useMainBaseMap();
  const { value: baseMaps = [] } = useBaseMaps();

  const extraBaseMapIds = useMemo(
    () =>
      Object.keys(annotationsModeByBaseMapId || {}).filter(
        (id) => id !== mainBaseMap?.id
      ),
    [annotationsModeByBaseMapId, mainBaseMap?.id]
  );

  const annotations = useAnnotationsV2({
    caller: "MainThreedEditor",
    enabled: isActiveViewer,
    withEntity: true,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  useEffect(() => {
    if (!threedEditor?.loadAnnotations || !rendererIsReady) return;
    // Ensure the extra base maps' groups exist before (re)creating annotation
    // objects — `createAnnotationsObjects` silently skips annotations whose
    // base map is not in `baseMapsMap`. Idempotent (no-op if already loaded).
    if (threedEditor.ensureBaseMapLoaded) {
      extraBaseMapIds.forEach((id) => {
        const bm = baseMaps.find((b) => b.id === id);
        if (bm?.image?.imageUrlClient) {
          threedEditor.ensureBaseMapLoaded(bm, { opacity: baseMapOpacityIn3d });
        }
      });
    }
    threedEditor.loadAnnotations(annotations || [], {
      disableOpacity,
      antiAliasingShrink,
    });
  }, [
    rendererIsReady,
    annotations,
    threedEditor,
    disableOpacity,
    antiAliasingShrink,
    extraBaseMapIds,
    baseMaps,
    baseMapOpacityIn3d,
  ]);

  return annotations;
}
