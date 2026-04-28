import { useEffect } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isActiveViewer = selectedViewerKey === "THREED";

  const annotations = useAnnotationsV2({
    caller: "MainThreedEditor",
    enabled: isActiveViewer,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  useEffect(() => {
    if (!threedEditor?.loadAnnotations || !rendererIsReady) return;
    threedEditor.loadAnnotations(annotations || []);
  }, [rendererIsReady, annotations, threedEditor]);
}
