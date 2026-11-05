import { memo, useMemo } from "react";

import useMapCameraSelector from "Features/mapEditorGeneric/hooks/useMapCamera";
import useEditorGrid from "../hooks/useEditorGrid";

import getGridFrame from "../utils/getGridFrame";
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
// Follows the LIVE camera (useMapCameraSelector): the dynamic cell size
// switches during the zoom gesture, not after it. It still re-renders only
// when the displayed grid changes or the view leaves the region already
// drawn (utils/getGridFrame.js) — never on every frame.
function LayerEditorGrid({ imageSize, meterByPx, basePose }) {
  // data

  const { enabled, stepM, dynamic } = useEditorGrid();

  const frame = useMapCameraSelector(
    (camera, previous) =>
      getGridFrame({ camera, previous, stepM, dynamic, meterByPx, basePose }),
    enabled
  );

  // helpers

  // width / height as primitives: the size object is rebuilt by the parent
  // on every render.
  const width = imageSize?.width;
  const height = imageSize?.height;

  const paths = useMemo(() => {
    if (!frame) return null;
    return buildGridPath({
      cellPx: frame.stepM / meterByPx,
      imageSize: { width, height },
      viewBox: frame.box,
      majorEvery: frame.majorEvery,
    });
  }, [frame, meterByPx, width, height]);

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
