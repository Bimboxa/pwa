// ---------------------------------------------------------------------------
// getPanelAutoMaxHeight — maxHeight of a floating panel in "auto" height
// mode (usePanelResize.fitContent): the panel follows its content but its
// bottom never goes below the editor's bottom reserve (same 80px band as the
// default geometry of the poppers, where the bottom bar buttons sit),
// whatever its CSS `top` and its vertical drag offset.
// `top` is a CSS length ("50px", a calc(...)); `offsetY` the drag offset in
// px (usePanelDrag.position.y).
// ---------------------------------------------------------------------------

export const PANEL_BOTTOM_RESERVE_PX = 80;

export default function getPanelAutoMaxHeight({
  top = "50px",
  offsetY = 0,
  minHeight = 120,
} = {}) {
  return `max(${minHeight}px, calc(100% - (${top}) - ${PANEL_BOTTOM_RESERVE_PX}px - ${Math.round(offsetY)}px))`;
}
