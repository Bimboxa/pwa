// Face-level hover highlight for the 3D viewer (SketchUp-like).
//
// Instead of recoloring the whole annotation on hover, we highlight only the
// "face" under the cursor: the raycast-hit triangle plus every adjacent
// triangle reachable across shared edges whose DIHEDRAL angle stays below the
// current threshold. The face is drawn by a transient overlay Mesh (child of
// the hit mesh) whose material renders a screen-space pattern of small blue
// dots over the original material.
//
// The angle is checked between ADJACENT triangles (not against the seed), so a
// tessellated curved surface — a revolution lathe, a profile swept along a
// curve — is picked up as ONE coherent face while a real crease (a wall
// meeting a slab) still stops the grow. The threshold is the "Sélection de
// face" 3D view setting (threedEditor.faceSelectionAngleDeg).
//
// Lifecycle mirrors subSelectionHelpers: the caller builds/disposes the
// overlay when the hover key `(mesh.uuid, angleDeg, regionId)` changes.

import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

// Fallback dihedral tolerance (degrees) when the caller passes none.
export const DEFAULT_FACE_ANGLE_DEG = 25;

// Plane mode ({plane: true}) normal tolerance: triangles join while
// dot(seedNormal, triNormal) >= cos(TOLERANCE_RAD).
const TOLERANCE_RAD = 1e-2;

// Above this triangle count we skip the adjacency build entirely (revolution
// meshes can be huge) and fall back to a single-triangle region.
const MAX_TRIS_FOR_ADJACENCY = 100_000;

// Vertex-welding quantization (meters). Extrude-style geometries duplicate
// vertices per face; hashing positions at 0.1 mm is what makes edges "shared".
const WELD_PRECISION = 1e-4;

// Plane mode ({plane: true}): max distance (mesh-local meters) of a triangle
// vertex to the seed plane. Aligned with WELD_PRECISION — CSG intersection
// noise is well below this at building scale.
const PLANE_DIST_TOL = 1e-4;

// ---------------------------------------------------------------------------
// Adjacency cache
// ---------------------------------------------------------------------------

// geometry → { edgeToTris, triNormals, triCount, regionsByAngle,
// planeRegionOfTri }. WeakMap so entries are dropped when AnnotationsManager
// disposes/rebuilds geometries.
const adjacencyCache = new WeakMap();

function buildAdjacency(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triCount = Math.floor((index ? index.count : position.count) / 3);

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
    triCount,
    // Dihedral partitions, keyed by angle threshold (degrees). Built lazily by
    // getAngleRegions, capped by MAX_CACHED_ANGLES.
    regionsByAngle: new Map(),
    // Separate stamp array for plane-mode regions, which is NOT a partition
    // (seed-relative) and therefore keeps its own lazy stamping.
    planeRegionOfTri: new Int32Array(triCount).fill(-1),
  };
}

// ---------------------------------------------------------------------------
// Dihedral-angle region partition
// ---------------------------------------------------------------------------

// The join predicate is carried by the EDGE (two triangles sharing an edge
// join when the angle between their normals is below the threshold), so
// "belongs to the same face" is a true equivalence relation: one union-find
// pass partitions the whole geometry exactly, and every later hover is a
// lookup. Regions are cached per angle; a couple of thresholds is all a
// slider drag needs to keep hot.
const MAX_CACHED_ANGLES = 3;

function getAngleRegions(cache, angleDeg) {
  const key = Math.round(angleDeg * 10) / 10;
  const cached = cache.regionsByAngle.get(key);
  if (cached) return cached;

  const { triCount, triNormals, edgeToTris } = cache;
  const cosTol = Math.cos((Math.max(0, key) * Math.PI) / 180);

  const parent = new Int32Array(triCount);
  for (let t = 0; t < triCount; t++) parent[t] = t;
  const find = (t) => {
    let root = t;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]]; // path halving
      root = parent[root];
    }
    return root;
  };
  // Always keep the SMALLER index as the root, so a region's id ends up being
  // its min triangle index (stable key for the hover overlay).
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (ra < rb) parent[rb] = ra;
    else parent[ra] = rb;
  };

  // Signed dot (no abs) so coincident opposite-facing triangles (e.g.
  // CSG-subtracted geometry) never merge. Degenerate triangles keep a zero
  // normal → dot 0 → never join.
  for (const tris of edgeToTris.values()) {
    if (tris.length < 2) continue;
    for (let i = 0; i < tris.length; i++) {
      const a = tris[i];
      for (let j = i + 1; j < tris.length; j++) {
        const b = tris[j];
        const dot =
          triNormals[3 * a] * triNormals[3 * b] +
          triNormals[3 * a + 1] * triNormals[3 * b + 1] +
          triNormals[3 * a + 2] * triNormals[3 * b + 2];
        if (dot >= cosTol) union(a, b);
      }
    }
  }

  const regionOfTri = new Int32Array(triCount);
  const trisByRegion = new Map();
  for (let t = 0; t < triCount; t++) {
    const root = find(t);
    regionOfTri[t] = root;
    let tris = trisByRegion.get(root);
    if (!tris) {
      tris = [];
      trisByRegion.set(root, tris);
    }
    tris.push(t);
  }

  const regions = { regionOfTri, trisByRegion };
  if (cache.regionsByAngle.size >= MAX_CACHED_ANGLES) {
    cache.regionsByAngle.delete(cache.regionsByAngle.keys().next().value);
  }
  cache.regionsByAngle.set(key, regions);
  return regions;
}

// Returns { regionId, tris } — the hit triangle plus every triangle of its
// face — or null when the geometry/faceIndex is unusable. `regionId` is stable
// for a given face (min tri index of the region) so callers can key the
// overlay on `${mesh.uuid}:${angleDeg}:${regionId}` and skip rebuilds while
// the cursor stays on the same face.
//
// `angleDeg` is the max dihedral angle joining two adjacent triangles: 0 keeps
// strictly coplanar facets together, 25 (the default setting) follows a
// revolution / swept surface across its facets without crossing a real crease.
//
// `plane: true` skips the adjacency walk entirely and selects EVERY triangle
// lying on the seed triangle's plane (signed normal within TOLERANCE_RAD, all
// three vertices within PLANE_DIST_TOL of the plane). CSG-carved geometries
// (userData.hasSubtraction) need this: boolean cuts leave T-junctions the
// vertex weld cannot bridge, so edge-adjacency fragments a coplanar surface
// into disconnected components. Callers must use the same mode for hover and
// creation so what is highlighted is what gets created.
export function getFaceRegion(
  geometry,
  faceIndex,
  { plane = false, angleDeg = DEFAULT_FACE_ANGLE_DEG } = {}
) {
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

  if (plane) return getPlaneRegion(geometry, faceIndex, cache);

  const { regionOfTri, trisByRegion } = getAngleRegions(cache, angleDeg);
  const regionId = regionOfTri[faceIndex];
  return { regionId, tris: trisByRegion.get(regionId) || [faceIndex] };
}

// Plane mode: O(triCount) sweep over the cached triangle normals, no
// adjacency walk. Signed dot against the seed normal (like the BFS) so
// coincident opposite-facing CSG triangles never join; the 3-vertex distance
// check rejects within-normal-tolerance triangles that merely cross the plane.
function getPlaneRegion(geometry, faceIndex, cache) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const vertIndex = index
    ? (t, c) => index.getX(3 * t + c)
    : (t, c) => 3 * t + c;

  const { triNormals, planeRegionOfTri } = cache;

  // Fast path: this face's plane region was already computed.
  const stamped = planeRegionOfTri[faceIndex];
  if (stamped >= 0) {
    const tris = [];
    for (let t = 0; t < planeRegionOfTri.length; t++) {
      if (planeRegionOfTri[t] === stamped) tris.push(t);
    }
    return { regionId: stamped, tris };
  }

  const seedNx = triNormals[3 * faceIndex];
  const seedNy = triNormals[3 * faceIndex + 1];
  const seedNz = triNormals[3 * faceIndex + 2];
  // Degenerate seed triangle (zero normal): single-tri region.
  if (seedNx === 0 && seedNy === 0 && seedNz === 0) {
    planeRegionOfTri[faceIndex] = faceIndex;
    return { regionId: faceIndex, tris: [faceIndex] };
  }

  const planeDist = (vi) =>
    seedNx * position.getX(vi) +
    seedNy * position.getY(vi) +
    seedNz * position.getZ(vi);
  const d = planeDist(vertIndex(faceIndex, 0));
  const cosTol = Math.cos(TOLERANCE_RAD);

  const region = [];
  for (let t = 0; t < planeRegionOfTri.length; t++) {
    const dot =
      seedNx * triNormals[3 * t] +
      seedNy * triNormals[3 * t + 1] +
      seedNz * triNormals[3 * t + 2];
    if (dot < cosTol) continue;
    if (
      Math.abs(planeDist(vertIndex(t, 0)) - d) > PLANE_DIST_TOL ||
      Math.abs(planeDist(vertIndex(t, 1)) - d) > PLANE_DIST_TOL ||
      Math.abs(planeDist(vertIndex(t, 2)) - d) > PLANE_DIST_TOL
    ) {
      continue;
    }
    region.push(t);
  }
  if (!region.includes(faceIndex)) region.push(faceIndex);

  const regionId = Math.min(...region);
  for (const t of region) planeRegionOfTri[t] = regionId;

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
