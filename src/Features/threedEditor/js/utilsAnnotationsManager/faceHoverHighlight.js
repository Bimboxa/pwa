// Face-level hover highlight for the 3D viewer (SketchUp-like).
//
// Instead of recoloring the whole annotation on hover, we highlight only the
// "face" under the cursor: the raycast-hit triangle plus every adjacent
// coplanar triangle (region-grow across shared edges while the geometric
// normal stays parallel within a small angular tolerance). The face is drawn
// by a transient overlay Mesh (child of the hit mesh) whose material renders
// a screen-space pattern of small blue dots over the original material.
//
// Lifecycle mirrors subSelectionHelpers: the caller builds/disposes the
// overlay when the hover key `(mesh.uuid, regionId)` changes.

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

// Region-grow angular tolerance: neighbors join while
// dot(seedNormal, neighborNormal) >= cos(TOLERANCE_RAD).
const TOLERANCE_RAD = 1e-2;

// Above this triangle count we skip the adjacency build entirely (revolution
// meshes can be huge) and fall back to a single-triangle region.
const MAX_TRIS_FOR_ADJACENCY = 100_000;

// Vertex-welding quantization (meters). Extrude-style geometries duplicate
// vertices per face; hashing positions at 0.1 mm is what makes edges "shared".
const WELD_PRECISION = 1e-4;

// ---------------------------------------------------------------------------
// Adjacency cache
// ---------------------------------------------------------------------------

// geometry → { edgeToTris, triNormals, regionOfTri }. WeakMap so entries are
// dropped when AnnotationsManager disposes/rebuilds geometries.
const adjacencyCache = new WeakMap();

function buildAdjacency(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triCount = (index ? index.count : position.count) / 3;

  const vertIndex = index
    ? (t, c) => index.getX(3 * t + c)
    : (t, c) => 3 * t + c;

  // Weld vertices by quantized position so duplicated corners share an id.
  const vertIdByKey = new Map();
  const weldedId = (vi) => {
    const key = `${Math.round(position.getX(vi) / WELD_PRECISION)},${Math.round(
      position.getY(vi) / WELD_PRECISION
    )},${Math.round(position.getZ(vi) / WELD_PRECISION)}`;
    let id = vertIdByKey.get(key);
    if (id === undefined) {
      id = vertIdByKey.size;
      vertIdByKey.set(key, id);
    }
    return id;
  };

  const edgeToTris = new Map();
  const triNormals = new Float32Array(3 * triCount);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const ab = new Vector3();
  const ac = new Vector3();

  for (let t = 0; t < triCount; t++) {
    const va = vertIndex(t, 0);
    const vb = vertIndex(t, 1);
    const vc = vertIndex(t, 2);

    a.fromBufferAttribute(position, va);
    b.fromBufferAttribute(position, vb);
    c.fromBufferAttribute(position, vc);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    ab.cross(ac);
    // Degenerate (zero-area) triangles keep a zero normal → never join a
    // region (dot stays 0).
    if (ab.lengthSq() > 0) ab.normalize();
    triNormals[3 * t] = ab.x;
    triNormals[3 * t + 1] = ab.y;
    triNormals[3 * t + 2] = ab.z;

    const ids = [weldedId(va), weldedId(vb), weldedId(vc)];
    for (let e = 0; e < 3; e++) {
      const i0 = ids[e];
      const i1 = ids[(e + 1) % 3];
      const key = i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`;
      let tris = edgeToTris.get(key);
      if (!tris) {
        tris = [];
        edgeToTris.set(key, tris);
      }
      tris.push(t);
    }
  }

  return {
    edgeToTris,
    triNormals,
    regionOfTri: new Int32Array(triCount).fill(-1),
    // Edge keys per triangle are recomputed during BFS via triEdgeKeys below,
    // so we also keep the welded corner ids to avoid re-hashing positions.
    cornerIds: buildCornerIds(triCount, vertIndex, weldedId),
  };
}

function buildCornerIds(triCount, vertIndex, weldedId) {
  const cornerIds = new Int32Array(3 * triCount);
  for (let t = 0; t < triCount; t++) {
    cornerIds[3 * t] = weldedId(vertIndex(t, 0));
    cornerIds[3 * t + 1] = weldedId(vertIndex(t, 1));
    cornerIds[3 * t + 2] = weldedId(vertIndex(t, 2));
  }
  return cornerIds;
}

function triEdgeKeys(cornerIds, t) {
  const keys = [];
  for (let e = 0; e < 3; e++) {
    const i0 = cornerIds[3 * t + e];
    const i1 = cornerIds[3 * t + ((e + 1) % 3)];
    keys.push(i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Coplanar region grow
// ---------------------------------------------------------------------------

// Returns { regionId, tris } — the hit triangle plus all adjacent coplanar
// triangles — or null when the geometry/faceIndex is unusable. `regionId` is
// stable for a given face (min tri index of the region) so callers can key
// the overlay on `${mesh.uuid}:${regionId}` and skip rebuilds while the
// cursor stays on the same face.
export function getCoplanarRegion(geometry, faceIndex) {
  if (!geometry?.isBufferGeometry) return null;
  const position = geometry.getAttribute("position");
  if (!position) return null;
  const index = geometry.getIndex();
  const triCount = Math.floor((index ? index.count : position.count) / 3);
  if (!(faceIndex >= 0 && faceIndex < triCount)) return null;

  if (triCount > MAX_TRIS_FOR_ADJACENCY) {
    return { regionId: faceIndex, tris: [faceIndex] };
  }

  let cache = adjacencyCache.get(geometry);
  if (!cache) {
    cache = buildAdjacency(geometry);
    adjacencyCache.set(geometry, cache);
  }

  const { edgeToTris, triNormals, regionOfTri, cornerIds } = cache;

  // Fast path: this face was already grown from a previous hover.
  const stamped = regionOfTri[faceIndex];
  if (stamped >= 0) {
    const tris = [];
    for (let t = 0; t < regionOfTri.length; t++) {
      if (regionOfTri[t] === stamped) tris.push(t);
    }
    return { regionId: stamped, tris };
  }

  const seedNx = triNormals[3 * faceIndex];
  const seedNy = triNormals[3 * faceIndex + 1];
  const seedNz = triNormals[3 * faceIndex + 2];
  const cosTol = Math.cos(TOLERANCE_RAD);

  // BFS across shared edges. Signed dot (no abs) so coincident opposite-facing
  // triangles (e.g. CSG-subtracted geometry) never merge. Always compared
  // against the SEED normal — prevents drift-merging around curved surfaces
  // (revolution facets highlight one facet, which is the SketchUp behavior).
  const visited = new Set([faceIndex]);
  const region = [faceIndex];
  const stack = [faceIndex];
  while (stack.length) {
    const t = stack.pop();
    for (const key of triEdgeKeys(cornerIds, t)) {
      const neighbors = edgeToTris.get(key);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        const dot =
          seedNx * triNormals[3 * n] +
          seedNy * triNormals[3 * n + 1] +
          seedNz * triNormals[3 * n + 2];
        if (dot < cosTol) continue;
        region.push(n);
        stack.push(n);
      }
    }
  }

  const regionId = Math.min(...region);
  // Stamping seed-grown regions is a deliberate approximation (seed-relative
  // growth isn't a strict equivalence relation) — good enough for hover.
  for (const t of region) regionOfTri[t] = regionId;

  return { regionId, tris: region };
}

// ---------------------------------------------------------------------------
// Stipple material (screen-space blue dots)
// ---------------------------------------------------------------------------

// Active clipping planes for overlay materials — same pattern as
// applyAnnotationMaterialState.setHighlightClippingPlanes. The array is the
// shared clippingManager.planes reference, so plane drags apply live; only
// enable/disable needs the setter.
let _clippingPlanes = null;
let _liveOverlayMaterial = null;

function syncMaterialClipping(mat) {
  if (!mat) return;
  const next =
    _clippingPlanes && _clippingPlanes.length ? _clippingPlanes : null;
  if (mat.clippingPlanes === next) return;
  const had = !!(mat.clippingPlanes && mat.clippingPlanes.length);
  const has = !!next;
  mat.clippingPlanes = next;
  if (had !== has) mat.needsUpdate = true;
}

export function setFaceHoverClippingPlanes(planes) {
  _clippingPlanes = planes || null;
  syncMaterialClipping(_liveOverlayMaterial);
}

// Fresh material per overlay (a shared singleton could get dispose()d by the
// AnnotationsManager cleanup traverse since the overlay lives inside the
// annotation object tree). The compiled program is still shared across
// overlays via customProgramCacheKey.
function createStippleMaterial() {
  const mat = new MeshBasicMaterial({
    color: 0x2196f3,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  syncMaterialClipping(mat);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
       vec2 stippleCell = mod(gl_FragCoord.xy, 6.0);
       float stippleDist = length(stippleCell - 3.0);
       float stippleDot = 1.0 - smoothstep(0.9, 2.1, stippleDist);
       gl_FragColor.a = mix(0.10, 0.85, stippleDot);`
    );
  };
  mat.customProgramCacheKey = () => "faceHoverStipple";
  return mat;
}

// ---------------------------------------------------------------------------
// Overlay mesh
// ---------------------------------------------------------------------------

// Builds the overlay Mesh for the given triangle subset, in mesh-LOCAL
// coordinates. The caller adds it as a child of `mesh` (identity transform →
// inherits all parent transforms; AnnotationsManager rebuild/dispose
// traversals remove it automatically with the annotation).
export function buildFaceHoverOverlay(mesh, tris) {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!position || !tris?.length) return null;
  const index = geometry.getIndex();
  const vertIndex = index
    ? (t, c) => index.getX(3 * t + c)
    : (t, c) => 3 * t + c;

  const positions = new Float32Array(9 * tris.length);
  let offset = 0;
  for (const t of tris) {
    for (let c = 0; c < 3; c++) {
      const vi = vertIndex(t, c);
      positions[offset++] = position.getX(vi);
      positions[offset++] = position.getY(vi);
      positions[offset++] = position.getZ(vi);
    }
  }

  const overlayGeometry = new BufferGeometry();
  overlayGeometry.setAttribute("position", new BufferAttribute(positions, 3));

  const material = createStippleMaterial();
  _liveOverlayMaterial = material;

  const overlay = new Mesh(overlayGeometry, material);
  overlay.userData.isHoverOverlay = true;
  // Invisible to raycasts — polygonOffset doesn't move geometry, so without
  // this the coplanar overlay would shadow the source mesh on the next hit.
  overlay.raycast = () => {};
  overlay.renderOrder = 998; // under the 999 sub-selection helpers
  return overlay;
}

// Tolerates an overlay already orphaned by an AnnotationsManager rebuild
// (double-dispose is safe in three).
export function disposeFaceHoverOverlay(overlay) {
  if (!overlay) return;
  overlay.parent?.remove(overlay);
  overlay.geometry?.dispose();
  overlay.material?.dispose();
  if (_liveOverlayMaterial === overlay.material) _liveOverlayMaterial = null;
}
