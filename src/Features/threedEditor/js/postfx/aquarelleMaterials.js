import {
  Color,
  DataTexture,
  RedFormat,
  NearestFilter,
  EdgesGeometry,
  MeshToonMaterial,
  Vector3,
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

// AQUARELLE render mode building blocks: toon "lavis" materials + a two-layer
// edge drawing per mesh, mimicking a real architectural sketch:
// - a light-gray PENCIL under-drawing: wavy (geometry-level bow + jitter),
//   with "construction line" overshoot at both ends,
// - crisp straight black INK lines drawn on top.
// Materials are created at object-build time (native-at-rebuild rule, see
// useAutoLoadAnnotationsInThreedEditor); edges are (re)built by the per-root
// finishing pass in AnnotationsManager so they track async loads / CSG carves.

export const PAPER_COLOR = "#f4f1ea";

const INK_COLOR = "#2a2a2a";
const INK_LINEWIDTH_PX = 1.8;
const PENCIL_COLOR = "#9a948b";
const PENCIL_LINEWIDTH_PX = 1.3;
const EDGE_THRESHOLD_ANGLE = 15;
// "Construction line" overshoot of the pencil layer: each segment is
// extended by this fraction of its length at both ends.
const PENCIL_EXTENSION = 0.06;
// Pencil waviness: subdivide each segment (one point every ~TARGET_STEP
// meters, capped) and bow it sideways by a few % of its length.
const PENCIL_TARGET_STEP = 0.35;
const PENCIL_MAX_SUBDIVISIONS = 8;
const PENCIL_AMPLITUDE_RATIO = 0.012;
const PENCIL_MAX_AMPLITUDE = 0.05;

// Wash mapping: the HUE must survive (an orange floor stays clearly orange,
// see the pool-blue in the reference sketch) — so only a light paper tint
// and a mild desaturation; the "diluted" feel comes from lifting lightness.
const PAPER_LERP = 0.12;
const SATURATION_FACTOR = 0.8;
// Lightness is REMAPPED into a pale band (not just multiplied): a watercolor
// wash is always light — even a "dark" template color must land as a tinted
// wash, or the post-process grain reads as pointillism over the whole face.
const LIGHTNESS_FLOOR = 0.4;
const LIGHTNESS_RANGE = 0.45;
const LIGHTNESS_MAX = 0.92;

// 3-step toon gradient — module singleton shared by every aquarelle material.
// Material.dispose() never disposes textures, so the annotation cleanup
// traverse in deleteAllAnnotationsObjects can't kill it.
let _gradientMap = null;
export function getToonGradientMap() {
  if (!_gradientMap) {
    _gradientMap = new DataTexture(
      // Gentle steps: the darkest band stays a readable wash (a 120/255 low
      // step turned every shaded face near-black under the single key light).
      new Uint8Array([165, 205, 240]),
      3,
      1,
      RedFormat
    );
    _gradientMap.minFilter = NearestFilter;
    _gradientMap.magFilter = NearestFilter;
    _gradientMap.needsUpdate = true;
  }
  return _gradientMap;
}

// Watercolor palette shift: desaturate + lift the annotation color toward the
// paper cream, so saturated template colors read as a wash ("lavis").
export function toWatercolorColor(color) {
  const c = color.clone().lerp(new Color(PAPER_COLOR), PAPER_LERP);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(
    hsl.h,
    hsl.s * SATURATION_FACTOR,
    Math.min(LIGHTNESS_FLOOR + hsl.l * LIGHTNESS_RANGE, LIGHTNESS_MAX)
  );
  return c;
}

// Hex-string variant for React consumers (legend icons must show the same
// wash color as the 3D objects). Falls through non-parsable values.
export function toWatercolorHexColor(hex) {
  if (!hex) return hex;
  return `#${toWatercolorColor(new Color(hex)).getHexString()}`;
}

export function createAquarelleMaterial({ color, opacity }) {
  return new MeshToonMaterial({
    color: toWatercolorColor(color),
    gradientMap: getToonGradientMap(),
    transparent: opacity < 1,
    opacity,
    // depthWrite stays true even when transparent — same z-sort stability
    // trade-off as the STANDARD Lambert branch (see createAnnotationObject3D).
    depthWrite: true,
    // Push faces back so the ink/pencil edge lines never z-fight with them.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

// ONE shared LineMaterial per edge layer (perf: a single program + one
// resolution update point each). deleteAllAnnotationsObjects dispose()s them
// on every rebuild — harmless, three just deallocates the program and
// recompiles it on the next render.
let _inkMaterial = null;
let _pencilMaterial = null;
function getSharedInkLineMaterial() {
  if (!_inkMaterial) {
    _inkMaterial = new LineMaterial({
      color: INK_COLOR,
      linewidth: INK_LINEWIDTH_PX,
      worldUnits: false,
    });
  }
  return _inkMaterial;
}
function getSharedPencilLineMaterial() {
  if (!_pencilMaterial) {
    _pencilMaterial = new LineMaterial({
      color: PENCIL_COLOR,
      linewidth: PENCIL_LINEWIDTH_PX,
      worldUnits: false,
      // The wavy pencil bows in front of the straight ink line in places; if
      // it wrote depth, the ink (drawn after, renderOrder above) would lose
      // the depth test there and the gray would sit on top. Depth TEST stays
      // on, so walls still occlude the pencil.
      depthWrite: false,
    });
  }
  return _pencilMaterial;
}

// LineMaterial needs the canvas CSS-pixel size, updated on resize (see
// SketchPostFxManager.render) and at edge build time (AnnotationsManager).
export function setSketchEdgeResolution(width, height) {
  getSharedInkLineMaterial().resolution.set(width, height);
  getSharedPencilLineMaterial().resolution.set(width, height);
}

// Extend each segment by `ratio` of its length at both ends (construction
// line style). positions = flat [x1,y1,z1,x2,y2,z2, ...] array.
function extendSegments(positions, ratio) {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 6) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const dx = (bx - ax) * ratio;
    const dy = (by - ay) * ratio;
    const dz = (bz - az) * ratio;
    out[i] = ax - dx;
    out[i + 1] = ay - dy;
    out[i + 2] = az - dz;
    out[i + 3] = bx + dx;
    out[i + 4] = by + dy;
    out[i + 5] = bz + dz;
  }
  return out;
}

// Deterministic pseudo-random in [0,1) — keyed on geometry so a rebuild
// (mode toggle, carve) redraws the exact same pencil strokes.
function hash(n) {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

// Hand-drawn waviness: subdivide each segment and bow it sideways with a
// low-order sine (k=1 → single arc, k=2 → gentle S), plus a touch of
// per-point jitter. Endpoints keep their exact position so strokes still
// meet at corners. Returns a NEW flat segment-pair array.
function jitterSegments(positions) {
  const dir = new Vector3();
  const u = new Vector3();
  const v = new Vector3();
  const helper = new Vector3();
  const out = [];

  for (let i = 0; i < positions.length; i += 6) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];

    dir.set(bx - ax, by - ay, bz - az);
    const len = dir.length();
    if (len < 1e-6) continue;
    dir.divideScalar(len);

    // Perpendicular basis around the segment direction.
    helper.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.9) helper.set(1, 0, 0);
    u.crossVectors(dir, helper).normalize();
    v.crossVectors(dir, u);

    const seed = ax * 12.9898 + ay * 78.233 + az * 37.719 + bx * 3.1 + by;
    const amp = Math.min(PENCIL_MAX_AMPLITUDE, len * PENCIL_AMPLITUDE_RATIO);
    const ampU = (hash(seed * 7.1) - 0.5) * 2 * amp;
    const ampV = (hash(seed * 13.7) - 0.5) * 2 * amp;
    const k = 1 + Math.round(hash(seed * 3.3)); // 1 = arc, 2 = S-curve

    const n = Math.min(
      PENCIL_MAX_SUBDIVISIONS,
      Math.max(2, Math.ceil(len / PENCIL_TARGET_STEP))
    );
    let px = ax;
    let py = ay;
    let pz = az;
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const bow = Math.sin(Math.PI * t * k);
      const jitter = s === n ? 0 : (hash(seed * 31.7 + s) - 0.5) * amp * 0.5;
      const offU = ampU * bow + jitter;
      const offV = ampV * bow - jitter;
      const x = ax + (bx - ax) * t + u.x * offU + v.x * offV;
      const y = ay + (by - ay) * t + u.y * offU + v.y * offV;
      const z = az + (bz - az) * t + u.z * offU + v.z * offV;
      out.push(px, py, pz, x, y, z);
      px = x;
      py = y;
      pz = z;
    }
  }
  return new Float32Array(out);
}

function buildEdgeLine({ positions, material, renderOrder }) {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const line = new LineSegments2(geometry, material);
  line.userData.isSketchEdge = true;
  // The pivot raycast walks the whole scene and accepts any isMesh hit
  // (LineSegments2 extends Mesh) — edges must be invisible to it.
  line.raycast = () => {};
  line.renderOrder = renderOrder;
  return line;
}

// Per-root edge pass (mirrors applyShadowFlags in AnnotationsManager):
// remove stale sketch edges, then rebuild the pencil + ink layers per solid
// mesh from its CURRENT geometry — re-run after async loads and CSG carves,
// so the lines always match the displayed (possibly carved) mesh.
export function applySketchEdges(root, { resolution }) {
  if (!root) return;

  const staleEdges = [];
  const meshes = [];
  root.traverse((child) => {
    if (child.userData?.isSketchEdge) {
      staleEdges.push(child);
      return;
    }
    if (
      child.isMesh &&
      !child.isLine2 &&
      !child.isLineSegments2 &&
      !child.userData?.isHoverOverlay &&
      child.geometry
    ) {
      meshes.push(child);
    }
  });

  staleEdges.forEach((edge) => {
    edge.parent?.remove(edge);
    // Materials are shared — dispose the geometry only.
    edge.geometry?.dispose();
  });

  if (resolution) setSketchEdgeResolution(resolution.x, resolution.y);

  meshes.forEach((mesh) => {
    const edges = new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_ANGLE);
    const positions = edges.attributes.position.array;
    edges.dispose();
    if (positions.length === 0) return;

    const baseOrder = mesh.renderOrder ?? 0;
    // Pencil under-drawing: overshoot + waviness, drawn below the ink.
    const pencilPositions = jitterSegments(
      extendSegments(positions, PENCIL_EXTENSION)
    );
    mesh.add(
      buildEdgeLine({
        positions: pencilPositions,
        material: getSharedPencilLineMaterial(),
        renderOrder: baseOrder + 1,
      })
    );
    // Ink layer: exact straight edges on top.
    mesh.add(
      buildEdgeLine({
        positions,
        material: getSharedInkLineMaterial(),
        renderOrder: baseOrder + 2,
      })
    );
  });
}

export function disposeAquarelleShared() {
  _gradientMap?.dispose();
  _gradientMap = null;
  _inkMaterial?.dispose();
  _inkMaterial = null;
  _pencilMaterial?.dispose();
  _pencilMaterial = null;
}
