import getDisplayedGrid, { getPxPerMeter } from "./getDisplayedGrid";

// Margin kept around the visible area, as a fraction of the viewport: the
// grid is drawn a bit beyond the screen so a pan does not rebuild it at
// every frame.
const VIEW_MARGIN = 0.5;

function contains(box, inner) {
  return (
    inner.x >= box.x &&
    inner.y >= box.y &&
    inner.x + inner.width <= box.x + box.width &&
    inner.y + inner.height <= box.y + box.height
  );
}

// What the grid layer must draw for the LIVE camera:
//   { stepM, majorEvery, box } | null
// `box` is the region to cover, in base-map local px (null = no culling).
//
// Designed as a camera selector (useMapCameraSelector): `previous` is
// returned untouched — no re-render — as long as the displayed grid is the
// same AND the visible area is still inside the box already drawn. So during
// a gesture the grid is rebuilt only when the cell size switches or when the
// view leaves the drawn region, not on every frame. Zooming IN at a constant
// cell size keeps the (now oversized) box: the number of lines is unchanged.
export default function getGridFrame({
  camera,
  previous,
  stepM,
  dynamic,
  meterByPx,
  basePose,
}) {
  const poseK = basePose?.k || 1;
  const grid = getDisplayedGrid({
    stepM,
    dynamic,
    pxPerMeter: getPxPerMeter({ zoom: camera.k, basePoseK: poseK, meterByPx }),
  });
  if (!grid) return null;

  // visible area: screen → world (camera) → base-map local px (base pose)
  let visible = null;
  const size = camera.getViewportSize?.();
  const k = camera.k * poseK;
  if (size?.width > 0 && size?.height > 0 && k > 0) {
    visible = {
      x: (-camera.x / camera.k - (basePose?.x || 0)) / poseK,
      y: (-camera.y / camera.k - (basePose?.y || 0)) / poseK,
      width: size.width / k,
      height: size.height / k,
    };
  }

  const sameGrid =
    previous &&
    previous.stepM === grid.stepM &&
    previous.majorEvery === grid.majorEvery;
  if (sameGrid) {
    if (!visible && !previous.box) return previous;
    if (visible && previous.box && contains(previous.box, visible)) {
      return previous;
    }
  }

  const box = visible
    ? {
        x: visible.x - visible.width * VIEW_MARGIN,
        y: visible.y - visible.height * VIEW_MARGIN,
        width: visible.width * (1 + 2 * VIEW_MARGIN),
        height: visible.height * (1 + 2 * VIEW_MARGIN),
      }
    : null;
  return { stepM: grid.stepM, majorEvery: grid.majorEvery, box };
}
