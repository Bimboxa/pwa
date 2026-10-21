import { useMemo } from "react";
import { useSelector } from "react-redux";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import { useOverlayAnnotationsBaseMapIds } from "Features/baseMapOverlays/hooks/useBaseMapOverlays";

// ---------------------------------------------------------------------------
// useDisplayedAnnotationsBaseMapIds — base maps whose annotations the
// displayed editor shows (title of the « X annotations sur N fonds de plan »
// section, SectionPopperBaseMaps): the main one under its own eye, plus the
// 2D overlays with their badge on (`isDessin2d`) or the 3D base maps with a
// display mode. Shared by the Dessin popper (PopperMapListings) and the
// docked Dessin panel (PanelDrawing).
// Returns both sets: `otherDisplayedBaseMapIds` (without the main one) also
// widens the popper's counters to those base maps.
// ---------------------------------------------------------------------------

const EMPTY = [];

export default function useDisplayedAnnotationsBaseMapIds({
  baseMap,
  isDessin2d,
}) {
  // data

  const { value: scopeBaseMaps } = useBaseMaps({});
  const overlayAnnotationsBaseMapIds = useOverlayAnnotationsBaseMapIds({
    baseMap,
    baseMaps: scopeBaseMaps,
    enabled: isDessin2d,
  });
  // 3D can show annotations from several base maps at once.
  const extraBaseMapIdsIn3d = useExtraBaseMapIdsIn3d();

  const hideAnnotationsInViewer = useSelector(
    (s) => s.viewers.hideAnnotationsInViewer
  );
  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const hideMainBaseMapAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );

  // helpers

  const otherDisplayedBaseMapIds = useMemo(
    () =>
      isDessin2d
        ? overlayAnnotationsBaseMapIds
        : hideAnnotationsIn3d
          ? EMPTY
          : extraBaseMapIdsIn3d,
    [
      isDessin2d,
      overlayAnnotationsBaseMapIds,
      hideAnnotationsIn3d,
      extraBaseMapIdsIn3d,
    ]
  );

  const displayedBaseMapIds = useMemo(() => {
    if (!baseMap?.id) return EMPTY;
    const mainShown = isDessin2d
      ? !hideAnnotationsInViewer
      : !hideAnnotationsIn3d && !hideMainBaseMapAnnotationsIn3d;
    return [...(mainShown ? [baseMap.id] : []), ...otherDisplayedBaseMapIds];
  }, [
    baseMap?.id,
    isDessin2d,
    hideAnnotationsInViewer,
    hideAnnotationsIn3d,
    hideMainBaseMapAnnotationsIn3d,
    otherDisplayedBaseMapIds,
  ]);

  return useMemo(
    () => ({ displayedBaseMapIds, otherDisplayedBaseMapIds }),
    [displayedBaseMapIds, otherDisplayedBaseMapIds]
  );
}
