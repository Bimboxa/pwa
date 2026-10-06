// Where the axis base lands on a vertical base map created for it: the axis
// sits at the middle of the width, its base at 90% of the height — the same
// fractions as the CHATEAU_EAU_V1 builder (BASE_POINT_X/Y_RATIO in
// Data/edx/.../chateauEauParams.js, which must stay the Data-side copy:
// Features never imports Data).
export const AXIS_BASE_POINT_RATIO = { x: 0.5, y: 0.9 };

// Default drawing height of an axis without an explicit `height` (3D default).
export const AXIS_DEFAULT_HEIGHT_M = 5;
