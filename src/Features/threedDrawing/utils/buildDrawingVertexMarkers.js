import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from "three";

const MARKER_SIZE_PX = 14;

// One shared sprite: a white disc with a dark rim, tinted by the material
// color (the rim stays dark) — readable on any background.
let discTexture = null;
function getDiscTexture() {
  if (discTexture) return discTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 10, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  discTexture = new CanvasTexture(canvas);
  return discTexture;
}

// Fixed-pixel-size dots on the points placed so far in a 3D drawing: the
// feedback of a click (a lone first point draws no line yet). Always on top
// (no depth test), like the in-progress lines. The caller disposes the
// geometry and material (the sprite texture is shared, never disposed).
// points: [{x, y, z}] → Points | null
export default function buildDrawingVertexMarkers(points, color) {
  if (!points?.length) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      points.flatMap((p) => [p.x, p.y, p.z]),
      3
    )
  );
  const material = new PointsMaterial({
    color,
    map: getDiscTexture(),
    size: MARKER_SIZE_PX,
    sizeAttenuation: false,
    transparent: true,
    alphaTest: 0.5,
    depthTest: false,
  });
  const markers = new Points(geometry, material);
  markers.frustumCulled = false;
  markers.raycast = () => {};
  return markers;
}
