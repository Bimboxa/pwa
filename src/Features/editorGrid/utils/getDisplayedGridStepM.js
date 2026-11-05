import { SCALE_STEPS } from "Features/mapEditorGeneric/utils/scaleSteps";

// Dynamic grid: smallest step of the scale indicator sequence whose cell is
// at least this wide on screen.
export const MIN_DYNAMIC_CELL_PX = 24;
// Fixed grid: below this cell width on screen the grid is neither drawn nor
// snappable (it would only be a grey wash).
export const MIN_VISIBLE_CELL_PX = 6;

// Screen px of one metre of the base map: camera zoom × base map pose scale
// / meterByPx (metres per base-map local px).
export function getPxPerMeter({ zoom, basePoseK, meterByPx }) {
  if (!(meterByPx > 0)) return null;
  const k = (zoom || 1) * (basePoseK || 1);
  return k > 0 ? k / meterByPx : null;
}

// Cell size (metres) of the editor grid actually displayed, or null when
// there is nothing to draw. Single source of truth of the grid layer, the
// grid snap and the bottom-left label.
// - dynamic: follows the zoom, on the scale indicator sequence;
// - fixed: stepM, hidden while its cells are too small on screen.
export default function getDisplayedGridStepM({ stepM, dynamic, pxPerMeter }) {
  if (!(pxPerMeter > 0)) return null;
  if (dynamic) {
    const step = SCALE_STEPS.find(
      (s) => s.meters * pxPerMeter >= MIN_DYNAMIC_CELL_PX
    );
    return step ? step.meters : SCALE_STEPS[SCALE_STEPS.length - 1].meters;
  }
  if (!(stepM > 0)) return null;
  return stepM * pxPerMeter >= MIN_VISIBLE_CELL_PX ? stepM : null;
}
