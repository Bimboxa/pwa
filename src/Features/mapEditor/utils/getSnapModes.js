// Derive which snap computations (VERTEX, MIDPOINT, PROJECTION) are active
// based on the current UI state.
//
// Truth table (non-drawing):
//   Selected + QuickEdit ON  -> V + M + P
//   Selected + QuickEdit OFF -> V + M
//   No sel   + QuickEdit ON  -> V + M + P
//   No sel   + QuickEdit OFF -> V only
//
// Drawing mode: always V + M + P.

const getSnapModes = ({isDrawing, isQuickEdit, hasSelection}) => {
  if (isDrawing || isQuickEdit) {
    return {vertex: true, midpoint: true, projection: true};
  }

  if (hasSelection) {
    return {vertex: true, midpoint: true, projection: false};
  }

  return {vertex: true, midpoint: false, projection: false};
};

export default getSnapModes;
