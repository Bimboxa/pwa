import {
  CanvasTexture,
  LinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

import sizeSpriteInCssPx from "Features/threedAnnotationLabels/services/sizeSpriteInCssPx";

import { PICK_ANGULAR, PICK_MIN_M } from "./attachFatLineRaycast";

// 3D marker of a POINT annotation: a filled dot (disc or square, like the 2D
// NodePointStatic) surrounded by a ring. The dot measures `size`, the ring
// 2 × `size` — the sprite quad is the ring's bounding square.
const CANVAS_PX = 128;
const RING_TO_DOT_RATIO = 2;
const MIN_SIZE = 3; // px or cm: keeps a degenerate size visible / pickable
const DEFAULT_SIZE = 20; // drawingShapeConfig POINT default
const DEFAULT_COLOR = "#2196f3";
const HALO_COLOR = "rgba(255,255,255,0.9)";
// Above the annotation surfaces, below the interactive handles (1005).
const POINT_SPRITE_RENDER_ORDER = 1000;

// One texture per (color, variant): shared by every sprite, never disposed
// with a single point (a plan can hold hundreds of them).
const textureCache = new Map();

function getPointTexture(color, variant) {
  const key = `${color}|${variant}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d");
  const c = CANVAS_PX / 2;
  const ringWidth = 10;
  const haloWidth = 4;
  const ringRadius = c - ringWidth / 2 - haloWidth;
  const dotHalf = c / RING_TO_DOT_RATIO;

  // Ring: white halo underneath for contrast on any backdrop, then the color.
  ctx.beginPath();
  ctx.arc(c, c, ringRadius, 0, Math.PI * 2);
  ctx.lineWidth = ringWidth + 2 * haloWidth;
  ctx.strokeStyle = HALO_COLOR;
  ctx.stroke();
  ctx.lineWidth = ringWidth;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Center dot (the 2D glyph): disc or square, same white outline.
  ctx.beginPath();
  if (variant === "SQUARE") {
    ctx.rect(c - dotHalf, c - dotHalf, 2 * dotHalf, 2 * dotHalf);
  } else {
    ctx.arc(c, c, dotHalf, 0, Math.PI * 2);
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = haloWidth;
  ctx.strokeStyle = HALO_COLOR;
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

// Depth-tested, but with the depth of a point pulled toward the camera by
// DEPTH_BIAS_IN_SIZES × the marker's world size (its on-screen position is
// untouched). A billboard has ONE depth — its center's — while the surface it
// lies on (base map plane, slab) comes closer to the camera over half of the
// quad: without the bias that half is swallowed. 3 sizes clear a surface
// seen up to ~80° off its normal, and anything standing further in front
// than that still hides the marker.
const DEPTH_BIAS_IN_SIZES = 3;
const PROJECT_CHUNK = "gl_Position = projectionMatrix * mvPosition;";

function applyDepthBias(shader) {
  if (!shader.vertexShader.includes(PROJECT_CHUNK)) return;
  shader.vertexShader = shader.vertexShader.replace(
    PROJECT_CHUNK,
    `${PROJECT_CHUNK}
	vec4 biasedPosition = mvPosition;
	biasedPosition.z += max( scale.x, scale.y ) * ${DEPTH_BIAS_IN_SIZES.toFixed(1)};
	biasedPosition.z = min( biasedPosition.z, 0.5 * mvPosition.z );
	vec4 biasedClip = projectionMatrix * biasedPosition;
	gl_Position.z = ( biasedClip.z / biasedClip.w ) * gl_Position.w;`
  );
}

const _center = new Vector3();
const _onRay = new Vector3();

/**
 * Builds the dot + ring sprite of a POINT annotation.
 *
 * - sizeUnit "CM": a billboard at real-world scale (ring = 2 × size cm).
 * - any other unit (PX, same rule as the 2D renderer): constant on-screen
 *   size (ring = 2 × size CSS px), perspective and orthographic cameras.
 *
 * Depth-tested (hidden by what stands in front of it), with a depth bias so
 * the surface it lies on never swallows half of it — see applyDepthBias.
 *
 * @param {Object} params
 * @param {string} params.color - "#RRGGBB" (alpha already stripped).
 * @param {string} [params.variant] - "CIRCLE" | "SQUARE".
 * @param {number} [params.size] - dot diameter / side, in px or cm.
 * @param {string} [params.sizeUnit] - "PX" | "CM".
 * @returns {Sprite}
 */
export default function createPointSprite({ color, variant, size, sizeUnit }) {
  const dotSize = Math.max(MIN_SIZE, Number(size) || DEFAULT_SIZE);
  const ringSize = RING_TO_DOT_RATIO * dotSize;
  const isWorldSized = sizeUnit === "CM";

  const material = new SpriteMaterial({
    map: getPointTexture(color || DEFAULT_COLOR, variant || "CIRCLE"),
    transparent: true,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: isWorldSized,
  });
  material.onBeforeCompile = applyDepthBias;
  const sprite = new Sprite(material);
  const worldRadius = isWorldSized ? ringSize / 100 / 2 : 0;
  if (isWorldSized) {
    sprite.scale.set(2 * worldRadius, 2 * worldRadius, 1);
  } else {
    sizeSpriteInCssPx(sprite, { cssHeight: ringSize });
  }
  sprite.renderOrder = POINT_SPRITE_RENDER_ORDER;
  sprite.userData.isAnnotationPointSprite = true;
  // The texture is shared (textureCache): only the material is owned.
  sprite.userData.dispose = () => material.dispose();

  // Hover / click picking: distance from the ray to the point, within the
  // same distance-scaled tolerance as the fat lines (a few screen px) — or
  // the ring radius when the marker is world-sized. Replaces three's sprite
  // raycast (quad-exact, and throwing when raycaster.camera is unset).
  sprite.raycast = function (raycaster, intersects) {
    this.getWorldPosition(_center);
    const ray = raycaster.ray;
    ray.closestPointToPoint(_center, _onRay);
    const distance = ray.origin.distanceTo(_onRay);
    const threshold = Math.max(
      PICK_MIN_M,
      PICK_ANGULAR * distance,
      worldRadius
    );
    if (_onRay.distanceToSquared(_center) > threshold * threshold) return;
    intersects.push({ distance, point: _center.clone(), object: this });
  };

  return sprite;
}
