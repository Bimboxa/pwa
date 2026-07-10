// Toggle visibility on all renderable children of the scene. The predicate
// decides whether each renderable should be drawn in this pass. Returns a
// restore() callback that puts the original visibility back.
//
// Only renderables (Mesh/Line/LineSegments/Points/Sprite) are toggled, never
// transform groups: in Three.js a parent's `visible=false` cascades to ALL
// descendants regardless of their own flag. Since annotations are attached
// as children of the basemap group (so a translate/rotate of the basemap
// carries them along), toggling that group would either hide the basemap
// mesh + annotations together (Layer 1) or hide them together (Layer 2).
// Leaving groups always visible and only flipping the leaf renderables lets
// the predicate cleanly select what actually draws.
export function setVisibilityByPredicate(scene, shouldKeepVisible) {
  const restore = [];
  scene.traverse((obj) => {
    if (obj === scene) return;
    if (obj.isCamera || obj.isLight) return;
    if (
      !obj.isMesh &&
      !obj.isLine &&
      !obj.isLineSegments &&
      !obj.isPoints &&
      !obj.isSprite
    )
      return;
    const wasVisible = obj.visible;
    const keep = shouldKeepVisible(obj);
    if (wasVisible !== keep) {
      restore.push([obj, wasVisible]);
      obj.visible = keep;
    }
  });
  return () => {
    restore.forEach(([obj, vis]) => {
      obj.visible = vis;
    });
  };
}

export function isBasemap(obj) {
  if (obj.userData?.isBasemap) return true;
  // Walk up the parents in case the basemap is nested in a group later.
  let p = obj.parent;
  while (p) {
    if (p.userData?.isBasemap) return true;
    p = p.parent;
  }
  return false;
}
