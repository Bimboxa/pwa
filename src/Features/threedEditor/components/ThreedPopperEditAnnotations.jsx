import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import PopperEditAnnotations from "Features/mapEditor/components/PopperEditAnnotations";

// Thin wrapper around PopperEditAnnotations that owns its own annotations
// subscription. Living as a child of MainThreedEditor keeps re-renders from
// the annotations hook out of the parent — re-rendering MainThreedEditor would
// re-fire useAutoLoadAnnotationsInThreedEditor and destroy + recreate every
// 3D object.

export default function ThreedPopperEditAnnotations() {
  const annotations = useAnnotationsV2({
    caller: "ThreedPopperEditAnnotations",
    enabled: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  return (
    <PopperEditAnnotations viewerKey="THREED" allAnnotations={annotations || []} />
  );
}
