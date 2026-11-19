import { ConeGeometry, Mesh, MeshBasicMaterial, Vector3 } from "three";

// Arrow head of a photo link line in 3D (`imageConnectorEnd: "ARROW"`): a
// small cone whose tip sits on the anchor, aligned with the leader
// (card → anchor). Constant SCREEN size like the anchor dot it replaces:
// rescaled before every render from the live camera + canvas. Never raycast
// (the drag grip is the target handle of the selected annotation).

// On-screen length / base radius of the head, in CSS px.
const ARROW_LENGTH_CSS_PX = 14;
const ARROW_RADIUS_CSS_PX = 5;

const _up = new Vector3(0, 1, 0);
const _dir = new Vector3();
const _world = new Vector3();
const _parentScale = new Vector3();

export default function createImageConnectorArrow3D({
  annotationId,
  color = "#333333",
  dimmed = false,
}) {
  // Unit-length cone, apex at the origin, pointing +Y.
  const geometry = new ConeGeometry(
    ARROW_RADIUS_CSS_PX / ARROW_LENGTH_CSS_PX,
    1,
    16
  );
  geometry.translate(0, -0.5, 0);
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: dimmed ? 0.3 : 1,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const arrow = new Mesh(geometry, material);
  arrow.renderOrder = 1002;
  arrow.raycast = () => {};
  arrow.userData = {
    annotationId,
    isImageConnectorArrow: true,
    noVertexSnap: true,
  };

  arrow.onBeforeRender = (renderer, _scene, camera) => {
    const h = renderer?.domElement?.clientHeight || 0;
    if (!h) return;
    let worldPerPx;
    if (camera?.isOrthographicCamera) {
      worldPerPx = (camera.top - camera.bottom) / (camera.zoom || 1) / h;
    } else if (camera?.isPerspectiveCamera) {
      const fovDeg = camera.getEffectiveFOV?.() ?? camera.fov;
      const distance = arrow
        .getWorldPosition(_world)
        .distanceTo(camera.position);
      worldPerPx = (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / h;
    } else {
      return;
    }
    let scale = ARROW_LENGTH_CSS_PX * worldPerPx;
    if (arrow.parent) {
      arrow.parent.getWorldScale(_parentScale);
      scale /= _parentScale.y || 1;
    }
    if (Math.abs(scale - arrow.scale.y) < 1e-9) return;
    arrow.scale.setScalar(scale);
    arrow.updateMatrixWorld(true);
  };

  return arrow;
}

// Tip on `target`, pointing away from `from` (the card end of the leader).
// Both in the local frame of the arrow's parent, like the leader ends.
export function setImageConnectorArrowEnds(arrow, target, from) {
  if (!arrow?.userData?.isImageConnectorArrow) return;
  arrow.position.set(target.x, target.y, target.z);
  _dir.set(target.x - from.x, target.y - from.y, target.z - from.z);
  if (_dir.lengthSq() < 1e-12) return;
  arrow.quaternion.setFromUnitVectors(_up, _dir.normalize());
}
