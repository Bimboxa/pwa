import { forwardRef, useImperativeHandle, useState } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import MapTooltip from "Features/mapEditorGeneric/components/MapTooltip";

// Owns the hover tooltip state in a child component so that MainThreedEditor
// does not re-render on every pointermove. A re-render of MainThreedEditor
// triggers `useAutoLoadAnnotationsInThreedEditor` to invoke `loadAnnotations`
// (which destroys + recreates every annotation object), making the GLB
// disappear briefly and the hover highlight target stale.

const ThreedHoverTooltip = forwardRef((_, ref) => {
  const [state, setState] = useState({ node: null, x: 0, y: 0 });

  useImperativeHandle(
    ref,
    () => ({
      set: (node, x, y) => setState({ node, x, y }),
      clear: () =>
        setState((prev) => (prev.node === null ? prev : { ...prev, node: null })),
    }),
    []
  );

  const annotations = useAnnotationsV2({
    caller: "ThreedHoverTooltip",
    enabled: true,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
  });

  if (!state.node) return null;

  return (
    <MapTooltip
      hoveredNode={state.node}
      annotations={annotations || []}
      x={state.x}
      y={state.y}
    />
  );
});

export default ThreedHoverTooltip;
