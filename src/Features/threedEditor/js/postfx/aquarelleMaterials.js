import {
  Color,
  DataTexture,
  RedFormat,
  NearestFilter,
  EdgesGeometry,
  MeshToonMaterial,
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

// AQUARELLE render mode building blocks: toon "lavis" materials + ink edge
// lines. Materials are created at object-build time (native-at-rebuild rule,
// see useAutoLoadAnnotationsInThreedEditor); edges are (re)built by the
// per-root finishing pass in AnnotationsManager so they track async loads and
// CSG carves.

export const PAPER_COLOR = "#f4f1ea";
const EDGE_COLOR = "#2a2a2a";
const EDGE_LINEWIDTH_PX = 1.8;
const EDGE_THRESHOLD_ANGLE = 15;
// "Construction line" overshoot: each edge segment is extended by this
// fraction of its length at both ends.
const EDGE_EXTENSION = 0.04;
const PAPER_LERP = 0.45;
const SATURATION_FACTOR = 0.45;
// Lightness is REMAPPED into a pale band (not just multiplied): a watercolor
// wash is always light — even a "dark" template color must land as a tinted
// wash, or the post-process grain reads as pointillism over the whole face.
const LIGHTNESS_FLOOR = 0.55;
const LIGHTNESS_RANGE = 0.35;
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

export function createAquarelleMaterial({ color, opacity }) {
  return new MeshToonMaterial({
    color: toWatercolorColor(color),
    gradientMap: getToonGradientMap(),
    transparent: opacity < 1,
    opacity,
    // depthWrite stays true even when transparent — same z-sort stability
    // trade-off as the STANDARD Lambert branch (see createAnnotationObject3D).
    depthWrite: true,
    // Push faces back so the ink edge lines never z-fight with them.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

// ONE shared LineMaterial for every ink edge in the scene (perf: a single
// program + uniform resolution update point). deleteAllAnnotationsObjects
// dispose()s it on every rebuild — harmless, three just deallocates the
// program and recompiles it on the next render.
let _edgeMaterial = null;
export function getSharedEdgeLineMaterial() {
  if (!_edgeMaterial) {
    _edgeMaterial = new LineMaterial({
      color: EDGE_COLOR,
      linewidth: EDGE_LINEWIDTH_PX,
      worldUnits: false,
    });
  }
  return _edgeMaterial;
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

// Per-root ink edge pass (mirrors applyShadowFlags in AnnotationsManager):
// remove stale sketch edges, then rebuild one LineSegments2 per solid mesh
// from its CURRENT geometry — re-run after async loads and CSG carves so the
// lines always match the displayed (possibly carved) mesh.
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
    // Material is shared — dispose the geometry only.
    edge.geometry?.dispose();
  });

  const material = getSharedEdgeLineMaterial();
  if (resolution) material.resolution.copy(resolution);

  meshes.forEach((mesh) => {
    const edges = new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_ANGLE);
    const positions = extendSegments(
      edges.attributes.position.array,
      EDGE_EXTENSION
    );
    edges.dispose();
    if (positions.length === 0) return;

    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    const line = new LineSegments2(geometry, material);
    line.userData.isSketchEdge = true;
    // The pivot raycast walks the whole scene and accepts any isMesh hit
    // (LineSegments2 extends Mesh) — edges must be invisible to it.
    line.raycast = () => {};
    line.renderOrder = (mesh.renderOrder ?? 0) + 1;
    // Child of the mesh: inherits the basemap-group transform and is freed by
    // the existing cleanup traverse in deleteAllAnnotationsObjects.
    mesh.add(line);
  });
}

export function disposeAquarelleShared() {
  _gradientMap?.dispose();
  _gradientMap = null;
  _edgeMaterial?.dispose();
  _edgeMaterial = null;
}
