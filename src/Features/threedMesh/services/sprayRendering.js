import { CanvasTexture } from "three";

// Rendering bits shared by the shoot spray (shootSprayController) and the
// splat paint layer (shootSplatsLayer).

// Points shader with a PER-PARTICLE size attribute (PointsMaterial only
// supports one global size): aSize is world meters, attenuated with depth
// exactly like PointsMaterial's sizeAttenuation (uScale = half the drawing
// buffer height in px).
export const SPRAY_VERTEX_SHADER = `
  attribute float aSize;
  uniform float uScale;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SPRAY_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform sampler2D uMap;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor, uOpacity) * sprite;
  }
`;

// Off-scene parking spot for unspawned/dead particles.
export const PARKED_Y = -9999;

// Soft round droplet sprite (radial white gradient), so particles read as
// liquid droplets instead of the square points default. Tinted via uColor.
export function makeDropletTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}
