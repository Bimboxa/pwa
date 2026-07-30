// A sprite with `sizeAttenuation: false` is NOT a constant-CSS-px object: its
// on-screen height is `scale.y / tan(fov/2) / 2` of the viewport height, so it
// depends on BOTH the current fov and the canvas height. Sizing it from a
// hardcoded fraction (the historical CARD_SCREEN_HEIGHT) therefore renders a
// text of an arbitrary px size — visibly smaller than the 2D chip on a wide
// fov / short canvas.
//
// This resizes the sprite before every render from the LIVE camera + canvas so
// it measures exactly `cssHeight` CSS px, like its 2D counterpart, and stays
// right across window resizes and fov animations.
//
// onBeforeRender runs before three computes modelViewMatrix, and the sprite
// shader reads its scale from matrixWorld — hence the explicit update.
export default function sizeSpriteInCssPx(sprite, { cssHeight, aspect = 1 }) {
  const apply = (scaleY) => {
    if (Math.abs(scaleY - sprite.scale.y) < 1e-6) return;
    sprite.scale.set(scaleY * aspect, scaleY, 1);
    sprite.updateMatrixWorld(true);
  };

  // Sane value before the first render (nominal 50° fov on an 800 px canvas).
  apply((cssHeight * 2 * Math.tan((50 * Math.PI) / 360)) / 800);

  sprite.onBeforeRender = (renderer, scene, camera) => {
    const h = renderer?.domElement?.clientHeight || 0;
    if (!h || !camera?.isPerspectiveCamera) return;
    const fovDeg = camera.getEffectiveFOV?.() ?? camera.fov;
    apply((cssHeight * 2 * Math.tan((fovDeg * Math.PI) / 360)) / h);
  };
}
