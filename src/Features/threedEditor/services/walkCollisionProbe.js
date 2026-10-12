import { Box3, Matrix3, Raycaster, Vector3 } from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";

import { isObjectChainVisible } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";

// Collision probe of the first-person walk mode (WalkModeController): the
// geometry of the scene the walker stands on and bumps into — base map
// planes, annotation solids (extrusions, revolutions, OBJECT_3D GLBs, mesh
// 3D faces) and mailles. Scan base maps are NOT here: their meshes have no
// CPU geometry and never answer a raycast (see attachScene3dToBaseMapGroup);
// the walk reads their height map instead (createScene3dGroundSampler).
//
// Two questions, both answered by raycasts against an explicit target list
// (recursive intersectObjects on the whole scene can throw on fat lines with
// stale geometry, see useMeshingPointerHandlers):
// - sampleGroundY: the highest surface below a point (vertical ray down);
// - probeBody: the nearest obstacle ahead in the body band (horizontal rays
//   at several heights above the feet).
//
// The target list is rebuilt at most once per second (maybeRefresh): the
// scene changes mid-walk (annotations rebuilt, textures / GLBs loaded, eye
// toggles) and a 1 s latency is invisible to the walker. Visibility is
// evaluated at refresh time only.
//
// Materials are DoubleSide everywhere (walls, mesh sheets, base map planes):
// both faces block, so an open mesh sheet or a VERTICAL base map is a wall
// from either side. Consequence: inside a closed solid (free climb on → walk
// into a wall → free climb off) every body ray hits an interior face and the
// walker is stuck until free climb is turned back on.

const REFRESH_INTERVAL_MS = 1000;
// Above this triangle count a brute-force raycast per frame costs too much:
// the mesh gets a BVH (on the instance only, never on Mesh.prototype).
const BVH_TRIANGLE_THRESHOLD = 20000;
// Faces whose normal is nearly vertical (ramps, roofs) have no horizontal
// direction to slide along: stop instead (and avoid normalizing ~0).
const MIN_HORIZONTAL_NORMAL = 0.3;

const DOWN = new Vector3(0, -1, 0);

const _raycaster = new Raycaster();
const _origin = new Vector3();
const _normalMatrix = new Matrix3();
const _normal = new Vector3();

// userData flags of the decorations that are never walkable / blocking.
const SKIPPED_FLAGS = [
  "isHoverOverlay", // transient face stipple
  "isPaintOverlay", // painted part (Pinceau) skin
  "isGridPlaceholder", // base maps grid decorations
  "isDecor", // scan base maps (no CPU geometry)
  "isHatchFill", // hatched fill band / lines
  "isRevolutionAxisCircle", // axis base circle
  "isSectionMarker", // revolution section markers / poché
  "isShadowCatcher",
  "isGizmo",
  "isClipHelper",
  "isDimensionLabel",
];

function isSkippedDecoration(obj) {
  const ud = obj.userData;
  if (!ud) return false;
  return SKIPPED_FLAGS.some((flag) => ud[flag]);
}

function getTriangleCount(geometry) {
  const index = geometry.index;
  if (index) return index.count / 3;
  const position = geometry.attributes?.position;
  return position ? position.count / 3 : 0;
}

export function createWalkCollisionProbe({ sceneManager }) {
  let targets = [];
  const bounds = new Box3();
  let lastRefresh = -Infinity;

  // Ancestry verdict per parent: whether a mesh under it is a walk target
  // (an annotation root / base map plane / maille ancestor, all visible).
  // Mailles and mesh 3D annotations hold hundreds of face meshes under one
  // group — one chain walk per group instead of one per face.
  const buildParentVerdicts = () => {
    const verdicts = new Map();
    return (parent) => {
      if (!parent) return false;
      const cached = verdicts.get(parent);
      if (cached !== undefined) return cached;
      let verdict = false;
      let node = parent;
      let visible = true;
      while (node) {
        if (node.visible === false) {
          visible = false;
          break;
        }
        const ud = node.userData;
        if (ud?.nodeType === "ANNOTATION" || ud?.isBasemap || ud?.isMesh3d) {
          verdict = true;
        }
        node = node.parent;
      }
      verdict = verdict && visible;
      verdicts.set(parent, verdict);
      return verdict;
    };
  };

  const refresh = () => {
    const scene = sceneManager?.scene;
    targets = [];
    bounds.makeEmpty();
    lastRefresh = performance.now();
    if (!scene) return;
    scene.updateMatrixWorld(true);
    const isTargetParent = buildParentVerdicts();

    scene.traverse((obj) => {
      if (!obj.isMesh || obj.isLine2 || obj.isLineSegments2) return;
      if (obj.visible === false) return;
      const geometry = obj.geometry;
      if (!geometry?.attributes?.position) return;
      if (isSkippedDecoration(obj)) return;
      // The mesh itself may carry the tag (base map plane, maille face).
      const ud = obj.userData;
      const selfTagged = ud?.isBasemap || ud?.isMesh3d;
      if (!selfTagged && !isTargetParent(obj.parent)) return;
      if (selfTagged && !isObjectChainVisible(obj.parent)) return;

      if (
        !geometry.boundsTree &&
        getTriangleCount(geometry) > BVH_TRIANGLE_THRESHOLD
      ) {
        // `indirect`: the BVH must NOT reorder geometry.index — meshPaint,
        // snap and CSG read faceIndex on the same geometry.
        geometry.boundsTree = new MeshBVH(geometry, { indirect: true });
        obj.raycast = acceleratedRaycast;
      }
      targets.push(obj);
      bounds.expandByObject(obj);
    });
  };

  const maybeRefresh = (now) => {
    if (now - lastRefresh >= REFRESH_INTERVAL_MS) refresh();
  };

  // Highest surface below (x, fromY, z) → world Y, or null when the ray
  // meets nothing (off the geometry: the caller falls back to the plane).
  // skipBasemapsAbove: base map planes higher than this Y are not a floor
  // (free climb: the plan of an upper level hanging over the walker's head
  // is a drawing, not a slab to pop onto — it becomes a floor once the
  // walker's head rises above it).
  const sampleGroundY = (x, z, fromY, { skipBasemapsAbove = null } = {}) => {
    if (targets.length === 0 || bounds.isEmpty()) return null;
    if (fromY < bounds.min.y) return null;
    _origin.set(x, fromY, z);
    _raycaster.set(_origin, DOWN);
    _raycaster.near = 0;
    _raycaster.far = fromY - bounds.min.y + 2;
    const hits = _raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      if (
        skipBasemapsAbove !== null &&
        hit.object.userData?.isBasemap &&
        hit.point.y > skipBasemapsAbove
      ) {
        continue;
      }
      return hit.point.y;
    }
    return null;
  };

  // Nearest obstacle ahead: horizontal rays from (origin.x, feetY + h,
  // origin.z) along `dir` (unit, horizontal) for each h of `heights`, up to
  // `length + radius`. → {distance, normal} (normal: world, horizontal,
  // unit, facing the walker) or null when the way is clear.
  const probeBody = ({ origin, feetY, dir, length, radius, heights }) => {
    if (targets.length === 0) return null;
    let best = null;
    _raycaster.near = 0;
    _raycaster.far = length + radius;
    for (const h of heights) {
      _origin.set(origin.x, feetY + h, origin.z);
      _raycaster.set(_origin, dir);
      const hits = _raycaster.intersectObjects(targets, false);
      const hit = hits.find((candidate) => candidate.face);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }
    if (!best) return null;

    _normalMatrix.getNormalMatrix(best.object.matrixWorld);
    _normal.copy(best.face.normal).applyMatrix3(_normalMatrix).normalize();
    // Double-sided faces: the side facing the walker.
    if (_normal.dot(dir) > 0) _normal.negate();
    _normal.y = 0;
    const normal =
      _normal.length() < MIN_HORIZONTAL_NORMAL
        ? dir.clone().negate()
        : _normal.clone().normalize();
    return { distance: best.distance, normal };
  };

  const getBounds = () => bounds;

  const dispose = () => {
    // boundsTrees stay on their geometries (freed with them); the geometry
    // of a disposed mesh keeps its attributes anyway.
    targets = [];
    bounds.makeEmpty();
  };

  return {
    refresh,
    maybeRefresh,
    sampleGroundY,
    probeBody,
    getBounds,
    dispose,
  };
}

export default createWalkCollisionProbe;
