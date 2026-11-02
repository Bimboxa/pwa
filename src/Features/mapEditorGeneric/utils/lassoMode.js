// Lasso selection modes, decided by the horizontal drag direction (AutoCAD
// convention): dragging left → right opens a "window" (only items fully
// enclosed by the rectangle are selected), dragging right → left opens a
// "crossing" window (items enclosed OR touched by the rectangle are
// selected). The vertical direction is irrelevant.
export const LASSO_MODE_WINDOW = "WINDOW"; // left → right: fully enclosed only
export const LASSO_MODE_CROSSING = "CROSSING"; // right → left: enclosed or crossed

export const getLassoMode = (startX, currentX) =>
  currentX < startX ? LASSO_MODE_CROSSING : LASSO_MODE_WINDOW;
