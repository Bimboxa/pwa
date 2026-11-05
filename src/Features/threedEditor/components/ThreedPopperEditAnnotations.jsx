import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useSceneExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useSceneExtraBaseMapIdsIn3d";
import PopperEditAnnotations from "Features/mapEditor/components/PopperEditAnnotations";

// Thin wrapper around PopperEditAnnotations that owns its own annotations
// subscription. Living as a child of MainThreedEditor keeps re-renders from
// the annotations hook out of the parent — re-rendering MainThreedEditor would
// re-fire useAutoLoadAnnotationsInThreedEditor and destroy + recreate every
// 3D object.

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

  return (
    <PopperEditAnnotations
      viewerKey="THREED"
      allAnnotations={annotations || []}
    />
  );
}
