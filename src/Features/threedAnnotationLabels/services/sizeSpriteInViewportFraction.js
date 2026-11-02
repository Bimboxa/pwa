import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Sibling of sizeSpriteInCssPx for the sprites sized as a FRACTION of the
// viewport rather than in CSS px (dimension cards, maille cards and handles,
// meshing markers): their historical `scale.y` is a raw value that, with
// `sizeAttenuation: false` under the perspective camera, shows
// `scale.y / (2·tan(fov/2))` of the viewport height.
//
// Under the orthographic camera (« Caméra ortho ») the sprite shader applies
// no distance factor — the scale is in world units and the same raw value
// would be a few millimetres tall. This re-sizes the sprite before every
// render so it keeps the perspective look: perspective → the raw `fraction`
// (unchanged rendering); orthographic → the world height showing the same
// viewport fraction as the raw value under the reference fov.
//
// onBeforeRender runs before three computes modelViewMatrix, and the sprite
// shader reads its scale from matrixWorld — hence the explicit update.
const FALLBACK_REFERENCE_FOV_DEG = 75;

export default function sizeSpriteInViewportFraction(
  sprite,
  { fraction, aspect = 1 }
) {
  const apply = (scaleY) => {
    if (Math.abs(scaleY - sprite.scale.y) < 1e-6) return;
    sprite.scale.set(scaleY * aspect, scaleY, 1);
    sprite.updateMatrixWorld(true);
  };

  apply(fraction);

  sprite.onBeforeRender = (renderer, scene, camera) => {
    if (!camera?.isOrthographicCamera) {
      apply(fraction);
      return;
    }
    const fovRef =
      getActiveThreedEditor()?.sceneManager?.controlsManager?.referenceFov ??
      FALLBACK_REFERENCE_FOV_DEG;
    const tanHalf = Math.tan((fovRef * Math.PI) / 360);
    apply(
      (fraction * (camera.top - camera.bottom)) /
        (camera.zoom || 1) /
        (2 * tanHalf)
    );
  };
}
