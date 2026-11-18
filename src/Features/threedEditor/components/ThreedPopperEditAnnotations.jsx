import { useCallback, useMemo } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useSceneExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useSceneExtraBaseMapIdsIn3d";
import PopperEditAnnotations from "Features/mapEditor/components/PopperEditAnnotations";
import ToolbarEditMeshes3d from "Features/threedMesh/components/ToolbarEditMeshes3d";
import ToolbarEditCutLines from "Features/threedCutLines/components/ToolbarEditCutLines";

// Thin wrapper around PopperEditAnnotations that owns its own annotations
// subscription. Living as a child of MainThreedEditor keeps re-renders from
// the annotations hook out of the parent — re-rendering MainThreedEditor would
// re-fire useAutoLoadAnnotationsInThreedEditor and destroy + recreate every
// 3D object.

// Mixed selection (annotations + cut lines + mailles, e.g. a lasso in the
// Maillage module): the cut lines and the mailles each get their own section
// under the annotations one, in the same popper. A section renders nothing
// when none of its kind is selected.

export default function ThreedPopperEditAnnotations() {
  // Same base maps as the scene: a lasso picks annotations of every base map
  // displayed in 3D, not only the main one — the popper must list them all.
  const extraBaseMapIds = useSceneExtraBaseMapIdsIn3d();

  const annotations = useAnnotationsV2({
    caller: "ThreedPopperEditAnnotations",
    enabled: true,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
  });

  // Cut lines are kept out of the annotations section (no template, no
  // quantities): they are listed in their own one.
  const { regularAnnotations, cutLines } = useMemo(() => {
    const regular = [];
    const lines = [];
    (annotations || []).forEach((a) =>
      (a?.type === "CUT_LINE" ? lines : regular).push(a)
    );
    return { regularAnnotations: regular, cutLines: lines };
  }, [annotations]);

  const renderExtraSection = useCallback(
    ({ onDragStart }) => (
      <>
        <ToolbarEditCutLines cutLines={cutLines} onDragStart={onDragStart} />
        <ToolbarEditMeshes3d embedded onDragStart={onDragStart} />
      </>
    ),
    [cutLines]
  );

  return (
    <PopperEditAnnotations
      viewerKey="THREED"
      allAnnotations={regularAnnotations}
      renderExtraSection={renderExtraSection}
    />
  );
}
