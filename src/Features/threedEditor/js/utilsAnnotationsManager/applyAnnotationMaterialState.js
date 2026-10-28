// Material state machine for annotation 3D objects in the 3D viewer.
//
// Four states are supported:
//   - "hover"         — fluo green singleton override.
//   - "dim"           — grey + low-opacity singleton override (applied to
//                       non-selected annotations when the user has at least
//                       one annotation selected).
//   - "soloTransparent" — lighter grey + low-opacity singleton override
//                       (annotations left out of a solo in the TRANSPARENT
//                       solo style, viewers.soloDimStyle).
//   - "soloWireframe" — light grey edge lines only, the surface turns
//                       invisible (annotations left out of a solo in the
//                       WIREFRAME solo style, viewers.soloDimStyle). The
//                       surface keeps its raycast so hover / selection still
//                       reach the annotation.
//   - "none"          — restore the cached original material.
//
// All meshes under `object3D` are walked. The very first time we touch a mesh,
// we cache its original material in `mesh.userData.originalMaterial` — this is
// the single source of truth used to restore the original. Hover, dim and
// wireframe are orthogonal singleton overrides; transitioning between them
// does not require any special bookkeeping.
//
// The black grid-edge overlays of the built meshes (userData.isGridEdge,
// LineSegments — see buildGridEdgeLines / buildWallEdges) follow the state
// too: light grey while dimmed or wireframed, their own material otherwise
// (their visibility belongs to applyWireframeSettings, never touched here).

import { DoubleSide, LineBasicMaterial, MeshBasicMaterial } from "three";

import buildGridEdgeLines from "./buildGridEdgeLines";
import { buildWallEdges } from "./extrudePolylineWall";
import { SOLO_DIM_WIREFRAME_COLOR_HEX } from "Features/annotations/constants/soloDimStyle";

const HOVER_MATERIAL = new MeshBasicMaterial({
  color: 0x00ff00,
  side: DoubleSide,
});

const DIM_MATERIAL = new MeshBasicMaterial({
  color: 0x888888,
  transparent: true,
  opacity: 0.3,
  side: DoubleSide,
  depthWrite: false,
});

// Transparent solo style: lighter than the selection dim.
const SOLO_TRANSPARENT_MATERIAL = new MeshBasicMaterial({
  color: SOLO_DIM_WIREFRAME_COLOR_HEX,
  transparent: true,
  opacity: 0.3,
  side: DoubleSide,
  depthWrite: false,
});

// Wireframe solo style: the surface draws nothing but stays raycastable.
const INVISIBLE_SURFACE_MATERIAL = new MeshBasicMaterial({
  colorWrite: false,
  depthWrite: false,
  side: DoubleSide,
});

// Wireframe solo style: the edge lines of the surface.
const SOLO_EDGE_MATERIAL = new LineBasicMaterial({
  color: SOLO_DIM_WIREFRAME_COLOR_HEX,
  transparent: true,
  opacity: 0.9,
});

// Dihedral threshold of the solo edge lines: the "crease" default of the
// Wireframe settings (silhouettes, free borders and real folds, not every
// facet seam of a lathe).
const SOLO_EDGE_THRESHOLD_DEG = 15;

const HOVER_COLOR = 0x00ff00;
const DIM_COLOR = 0x888888;
const SOLO_WIRE_COLOR = SOLO_DIM_WIREFRAME_COLOR_HEX;

export const STATE_NONE = "none";
export const STATE_HOVER = "hover";
export const STATE_DIM = "dim";
export const STATE_SOLO_WIREFRAME = "soloWireframe";
export const STATE_SOLO_TRANSPARENT = "soloTransparent";

// Active clipping planes for the highlight overrides. The hover/dim materials
// are swapped in place of the original (already-clipped) material, so without
// this they'd render the full geometry past the cut. There is a single global
// plane, so we keep the shared array module-side and sync the singletons +
// line clones to it. See setHighlightClippingPlanes.
let _clippingPlanes = null;

// Assign the active clipping planes to `mat`, flipping needsUpdate ONLY when the
// plane count transitions 0↔1 (that changes the shader; mutating the plane in
// place does not — matches ClippingManager's recompile-avoidance rationale).
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

// Called when the clipping plane is enabled/disabled. Pass the shared planes
// array (clippingManager.planes) when active, null otherwise.
export function setHighlightClippingPlanes(planes) {
  _clippingPlanes = planes || null;
  syncMaterialClipping(HOVER_MATERIAL);
  syncMaterialClipping(DIM_MATERIAL);
  syncMaterialClipping(SOLO_TRANSPARENT_MATERIAL);
  syncMaterialClipping(INVISIBLE_SURFACE_MATERIAL);
  syncMaterialClipping(SOLO_EDGE_MATERIAL);
}

// Fat-line objects (Line2, e.g. the POINT height trait) render with a
// LineMaterial; swapping in the MeshBasicMaterial singletons would break them
// (the instanced LineGeometry needs the line shader). Instead, lazily clone the
// original LineMaterial — preserving its linewidth/thickness, resolution,
// worldUnits and depthTest — and just recolor it. Clones are cached on the
// child so hover/dim transitions don't reallocate.
function isLineObject(child) {
  return (
    child.isLine2 ||
    child.isLineSegments2 ||
    !!child.userData?.originalMaterial?.isLineMaterial
  );
}

// Cached recolored clone of the original line material for `state`
// (`cacheKey` on userData), re-synced to the clipping planes on every call so
// clipping toggles take effect.
function cachedLineClone(child, cacheKey, color, opacity) {
  if (!child.userData[cacheKey]) {
    const m = child.userData.originalMaterial.clone();
    m.color.set(color);
    if (opacity != null) {
      m.transparent = true;
      m.opacity = opacity;
    }
    child.userData[cacheKey] = m;
  }
  syncMaterialClipping(child.userData[cacheKey]);
  return child.userData[cacheKey];
}

function lineStateMaterial(child, state) {
  if (state === STATE_HOVER) {
    return cachedLineClone(child, "hoverLineMaterial", HOVER_COLOR);
  }
  if (state === STATE_DIM) {
    return cachedLineClone(child, "dimLineMaterial", DIM_COLOR, 0.3);
  }
  if (state === STATE_SOLO_WIREFRAME) {
    return cachedLineClone(child, "soloWireLineMaterial", SOLO_WIRE_COLOR, 0.9);
  }
  if (state === STATE_SOLO_TRANSPARENT) {
    return cachedLineClone(child, "soloDimLineMaterial", SOLO_WIRE_COLOR, 0.3);
  }
  return child.userData.originalMaterial;
}

// Grid-edge overlays (LineSegments, LineBasicMaterial): light grey while the
// annotation is dimmed / wireframed, original otherwise.
function gridEdgeStateMaterial(child, state) {
  if (
    state === STATE_DIM ||
    state === STATE_SOLO_WIREFRAME ||
    state === STATE_SOLO_TRANSPARENT
  ) {
    return cachedLineClone(child, "dimGridEdgeMaterial", SOLO_WIRE_COLOR, 0.5);
  }
  return child.userData.originalMaterial;
}

// Edge lines of a mesh for the wireframe solo style, cached on the mesh
// (userData.soloEdgeLines) and rebuilt when its geometry changed (CSG carve,
// surface cuts). Tagged isSoloEdge — NOT isGridEdge: the Wireframe settings,
// the carve rebuild and the export must ignore them.
function ensureSoloEdgeLines(mesh) {
  const geom = mesh.geometry;
  if (!geom) return null;
  const cached = mesh.userData.soloEdgeLines;
  if (cached && mesh.userData.soloEdgeGeometryUuid === geom.uuid) return cached;
  if (cached) {
    mesh.remove(cached);
    cached.geometry?.dispose?.();
  }
  const lines = mesh.userData.hasSubtraction
    ? buildWallEdges(geom, {
        seamDihedralDeg: SOLO_EDGE_THRESHOLD_DEG,
        kind: "EDGES",
        material: SOLO_EDGE_MATERIAL,
      })
    : buildGridEdgeLines(geom, {
        thresholdDeg: SOLO_EDGE_THRESHOLD_DEG,
        material: SOLO_EDGE_MATERIAL,
      });
  lines.userData = { isSoloEdge: true };
  lines.raycast = () => {};
  lines.renderOrder = (mesh.renderOrder ?? 0) + 1;
  mesh.add(lines);
  mesh.userData.soloEdgeLines = lines;
  mesh.userData.soloEdgeGeometryUuid = geom.uuid;
  return lines;
}

export default function applyAnnotationMaterialState(object3D, state) {
  if (!object3D) return;
  // scan base maps are a backdrop: never hover-tinted nor dimmed (their
  // materials are shared per atlas and must not be swapped).
  if (object3D.userData?.isDecor) return;

  object3D.traverse((child) => {
    // Solo edge lines of a mesh (added below): never restyled themselves.
    if (child.userData?.isSoloEdge) return;

    if (!child.isMesh) {
      if (child.isLineSegments && child.userData?.isGridEdge) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        child.material = gridEdgeStateMaterial(child, state);
      }
      return;
    }
    // Transient face-hover overlays (faceHoverHighlight.js) live inside the
    // annotation tree — skip them so dim/lasso passes never cache the stipple
    // material as originalMaterial.
    if (child.userData?.isHoverOverlay) return;
    // Invisible full surface of a hatched fill (applyHatchFill): its band and
    // lines carry the state, the surface must stay invisible.
    if (child.userData?.isHatchPickSurface) return;
    // Base circle of a plan revolution axis: keeps its look through hover /
    // dim (the dashed axis line carries the state).
    if (child.userData?.isRevolutionAxisCircle) return;
    if (!child.userData) child.userData = {};
    if (!child.userData.originalMaterial) {
      child.userData.originalMaterial = child.material;
    }

    if (isLineObject(child)) {
      child.material = lineStateMaterial(child, state);
      return;
    }

    const soloEdges =
      state === STATE_SOLO_WIREFRAME
        ? ensureSoloEdgeLines(child)
        : child.userData.soloEdgeLines;
    if (soloEdges) soloEdges.visible = state === STATE_SOLO_WIREFRAME;

    if (state === STATE_HOVER) {
      child.material = HOVER_MATERIAL;
    } else if (state === STATE_DIM) {
      child.material = DIM_MATERIAL;
    } else if (state === STATE_SOLO_TRANSPARENT) {
      child.material = SOLO_TRANSPARENT_MATERIAL;
    } else if (state === STATE_SOLO_WIREFRAME) {
      child.material = INVISIBLE_SURFACE_MATERIAL;
    } else {
      child.material = child.userData.originalMaterial;
    }
  });
}
