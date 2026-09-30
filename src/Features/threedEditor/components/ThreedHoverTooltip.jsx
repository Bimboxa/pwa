import { forwardRef, useImperativeHandle, useState } from "react";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { Paper, Typography } from "@mui/material";

import MapTooltip from "Features/mapEditorGeneric/components/MapTooltip";

// Owns the hover tooltip state in a child component so that MainThreedEditor
// does not re-render on every pointermove. A re-render of MainThreedEditor
// triggers `useAutoLoadAnnotationsInThreedEditor` to invoke `loadAnnotations`
// (which destroys + recreates every annotation object), making the GLB
// disappear briefly and the hover highlight target stale.

const ThreedHoverTooltip = forwardRef((_, ref) => {
  const [state, setState] = useState({ node: null, text: null, x: 0, y: 0 });

  useImperativeHandle(
    ref,
    () => ({
      set: (node, x, y) => setState({ node, text: null, x, y }),
      // Plain text tooltip (no annotation lookup) — e.g. the base map name
      // over a sheet of the 3D base maps grid.
      setText: (text, x, y) => setState({ node: null, text, x, y }),
      clear: () =>
        setState((prev) =>
          prev.node === null && prev.text === null
            ? prev
            : { ...prev, node: null, text: null }
        ),
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

  if (state.text) {
    return (
      <Paper
        elevation={3}
        sx={{
          position: "absolute",
          left: state.x,
          top: state.y,
          px: 1,
          py: 0.5,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <Typography variant="caption" noWrap>
          {state.text}
        </Typography>
      </Paper>
    );
  }

  if (!state.node) return null;

  // node.partQties: the hover addresses ONE face / edge of a mesh annotation
  // — its own measures replace the annotation totals.
  return (
    <MapTooltip
      hoveredNode={state.node}
      annotations={annotations || []}
      x={state.x}
      y={state.y}
      qtiesOverride={state.node.partQties}
    />
  );
});

export default ThreedHoverTooltip;
