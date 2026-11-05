import { memo, useMemo } from "react";

import useMapZoom from "Features/mapEditorGeneric/hooks/useMapZoom";
import useEditorGrid from "../hooks/useEditorGrid";

import getDisplayedGrid, { getPxPerMeter } from "../utils/getDisplayedGrid";
import buildGridPath from "../utils/buildGridPath";

// main grid: 1 px line; secondary grid: thinner and lighter
const MAJOR_STROKE = "rgba(110, 120, 135, 0.5)";
const MINOR_STROKE = "rgba(120, 130, 145, 0.32)";
const MAJOR_WIDTH = 1;
const MINOR_WIDTH = 0.5;

// Editor grid (« Grille » command): light-grey metric grid over the current
// base map of the 2D editor — a main grid and a thinner secondary grid, in
// fixed and in dynamic mode alike (utils/getDisplayedGrid.js). Drawn in
// base-map LOCAL px — mount it inside the basePose group of
// StaticMapContent, above the base map image and under the annotations.
// Hairline whatever the zoom (non-scaling stroke), never hit-tested, left out
// of the captures.
//
// Re-renders on its own: the flushed map zoom (end of a zoom gesture) and
// the debounced visible box, not on every camera tick.
function LayerEditorGrid({ imageSize, meterByPx, basePoseK = 1, visibleViewBox }) {
  // data

  const { enabled, stepM, dynamic } = useEditorGrid();
  const zoom = useMapZoom(enabled);

  // helpers

  const grid = enabled
    ? getDisplayedGrid({
        stepM,
        dynamic,
        pxPerMeter: getPxPerMeter({ zoom, basePoseK, meterByPx }),
      })
    : null;
  const displayedStepM = grid?.stepM ?? null;
  const majorEvery = grid?.majorEvery ?? 1;

  // width / height as primitives: the size object is rebuilt by the parent
  // on every render.
  const width = imageSize?.width;
  const height = imageSize?.height;

  const paths = useMemo(() => {
    if (!displayedStepM) return null;
    return buildGridPath({
      cellPx: displayedStepM / meterByPx,
      imageSize: { width, height },
      viewBox: visibleViewBox,
      majorEvery,
    });
  }, [displayedStepM, majorEvery, meterByPx, width, height, visibleViewBox]);

  // render

  if (!paths?.minor && !paths?.major) return null;

  return (
    <g data-capture-hide fill="none" style={{ pointerEvents: "none" }}>
      {paths.minor && (
        <path
          d={paths.minor}
          stroke={MINOR_STROKE}
          strokeWidth={MINOR_WIDTH}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {paths.major && (
        <path
          d={paths.major}
          stroke={MAJOR_STROKE}
          strokeWidth={MAJOR_WIDTH}
          vectorEffect="non-scaling-stroke"
          shapeRendering="crispEdges"
        />
      )}
    </g>
  );
}

export default memo(LayerEditorGrid);
