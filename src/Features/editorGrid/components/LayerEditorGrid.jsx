import { memo, useMemo } from "react";

import useMapZoom from "Features/mapEditorGeneric/hooks/useMapZoom";
import useEditorGrid from "../hooks/useEditorGrid";

import getDisplayedGridStepM, {
  getPxPerMeter,
} from "../utils/getDisplayedGridStepM";
import buildGridPath from "../utils/buildGridPath";

const GRID_STROKE = "rgba(120, 130, 145, 0.35)";

// Editor grid (« Grille » command): thin light-grey metric grid over the
// current base map of the 2D editor. Drawn in base-map LOCAL px — mount it
// inside the basePose group of StaticMapContent, above the base map image
// and under the annotations. Hairline whatever the zoom (non-scaling stroke),
// never hit-tested, left out of the captures.
//
// Re-renders on its own: the flushed map zoom (end of a zoom gesture) and
// the debounced visible box, not on every camera tick.
function LayerEditorGrid({ imageSize, meterByPx, basePoseK = 1, visibleViewBox }) {
  // data

  const { enabled, stepM, dynamic } = useEditorGrid();
  const zoom = useMapZoom(enabled);

  // helpers

  const displayedStepM = enabled
    ? getDisplayedGridStepM({
        stepM,
        dynamic,
        pxPerMeter: getPxPerMeter({ zoom, basePoseK, meterByPx }),
      })
    : null;

  // width / height as primitives: the size object is rebuilt by the parent
  // on every render.
  const width = imageSize?.width;
  const height = imageSize?.height;

  const d = useMemo(() => {
    if (!displayedStepM) return "";
    return buildGridPath({
      cellPx: displayedStepM / meterByPx,
      imageSize: { width, height },
      viewBox: visibleViewBox,
    });
  }, [displayedStepM, meterByPx, width, height, visibleViewBox]);

  // render

  if (!d) return null;

  return (
    <path
      data-capture-hide
      d={d}
      fill="none"
      stroke={GRID_STROKE}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
      shapeRendering="crispEdges"
      style={{ pointerEvents: "none" }}
    />
  );
}

export default memo(LayerEditorGrid);
