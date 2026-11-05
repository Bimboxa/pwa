import { SCALE_STEPS } from "Features/mapEditorGeneric/utils/scaleSteps";

// Dynamic grid: smallest step of the scale indicator sequence whose cell is
// at least this wide on screen.
export const MIN_DYNAMIC_CELL_PX = 24;
// Below this cell width on screen a family of lines is neither drawn nor
// snappable (it would only be a grey wash).
export const MIN_VISIBLE_CELL_PX = 6;
// Fixed grid: one main line every N cells (squared paper).
export const FIXED_MAJOR_EVERY = 5;

// Screen px of one metre of the base map: camera zoom × base map pose scale
// / meterByPx (metres per base-map local px).
export function getPxPerMeter({ zoom, basePoseK, meterByPx }) {
  if (!(meterByPx > 0)) return null;
  const k = (zoom || 1) * (basePoseK || 1);
  return k > 0 ? k / meterByPx : null;
}

// The editor grid actually displayed, or null when there is nothing to draw.
// Single source of truth of the grid layer, the grid snap and the bottom-left
// label:
//   { stepM, majorEvery }
// - stepM: cell size in metres of the lines drawn (the SECONDARY grid, thin
//   lines) — also the snap grid;
// - majorEvery: one line out of `majorEvery` belongs to the MAIN grid (thicker
//   line), counted from the grid origin; 1 = every line is a main line.
//
// - dynamic: the cell follows the zoom on the scale indicator sequence, the
//   main grid being the next length of that sequence (10 cm → 50 cm,
//   50 cm → 1 m…);
// - fixed: stepM cells with a main line every FIXED_MAJOR_EVERY; while the
//   cells are too small on screen only the main grid stays.
export default function getDisplayedGrid({ stepM, dynamic, pxPerMeter }) {
  if (!(pxPerMeter > 0)) return null;

  if (dynamic) {
    let index = SCALE_STEPS.findIndex(
      (s) => s.meters * pxPerMeter >= MIN_DYNAMIC_CELL_PX
    );
    if (index === -1) index = SCALE_STEPS.length - 1;
    const step = SCALE_STEPS[index].meters;
    const next = SCALE_STEPS[index + 1]?.meters;
    return {
      stepM: step,
      majorEvery: next ? Math.round(next / step) : FIXED_MAJOR_EVERY,
    };
  }

  if (!(stepM > 0)) return null;
  if (stepM * pxPerMeter >= MIN_VISIBLE_CELL_PX) {
    return { stepM, majorEvery: FIXED_MAJOR_EVERY };
  }
  const majorStepM = stepM * FIXED_MAJOR_EVERY;
  if (majorStepM * pxPerMeter >= MIN_VISIBLE_CELL_PX) {
    return { stepM: majorStepM, majorEvery: 1 };
  }
  return null;
}
