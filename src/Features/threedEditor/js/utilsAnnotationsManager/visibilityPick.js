// three's raycaster only tests layers, NOT `visible` — geometry hidden via
// `visible = false` (e.g. annotations hidden by the Maillage panel toggle)
// would still be pickable. Every picking path (click, hover, lasso, meshing)
// drops such hits through this filter.

export function isObjectChainVisible(object) {
  let o = object;
  while (o) {
    if (o.visible === false) return false;
    o = o.parent;
  }
  return true;
}

export function filterIntersectionsByVisibility(intersects) {
  return (intersects || []).filter((i) => isObjectChainVisible(i.object));
}
