import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import theme from "Styles/theme";

// Outline of the base map selected in the 3D editor (the one whose
// properties panel is open): a screen-space fat line around the image plane,
// in the theme secondary colour.
//
// Child of the basemap mesh, like the white page border (baseMapBorder), so
// it follows the image eye, the drawing offset and the removal of the mesh.
// Its own tag keeps it apart from that border, which applyBaseMapOpacity
// drops on every page that is not a white page.
//
// A Line2 IS a mesh: raycast is disabled and `isHoverOverlay` keeps it out of
// the vertex snap, the scene export and the base map vertex lookups.
// ClippingManager skips it too (UI, never sliced).

const OUTLINE_COLOR = theme.palette.secondary.main;
const OUTLINE_WIDTH_PX = 2;

// Corners of a 1x1-segment PlaneGeometry, walked around the quad (closed).
const CORNER_INDICES = [0, 1, 3, 2, 0];

function getOutlinePositions(planeGeometry) {
  const position = planeGeometry?.attributes?.position;
  if (!position || position.count < 4) return null;
  const coords = [];
  CORNER_INDICES.forEach((i) => {
    coords.push(position.getX(i), position.getY(i), position.getZ(i));
  });
  return coords;
}

// One material for every outline, owned by ImagesManager (resolution kept in
// sync with the canvas size there).
export function createBaseMapSelectionOutlineMaterial(resolution) {
  return new LineMaterial({
    color: OUTLINE_COLOR,
    linewidth: OUTLINE_WIDTH_PX,
    resolution,
    worldUnits: false,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

export function getBaseMapSelectionOutline(mesh) {
  return (
    mesh?.children.find((c) => c.userData?.isBasemapSelectionOutline) ?? null
  );
}

// The outline of the mesh, created on first call.
export function ensureBaseMapSelectionOutline(mesh, material) {
  if (!mesh) return null;
  const existing = getBaseMapSelectionOutline(mesh);
  if (existing) return existing;
  const positions = getOutlinePositions(mesh.geometry);
  if (!positions) return null;

  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const outline = new Line2(geometry, material);
  outline.renderOrder = 1001;
  outline.frustumCulled = false;
  outline.raycast = () => {};
  outline.userData.isBasemapSelectionOutline = true;
  outline.userData.isHoverOverlay = true;
  mesh.add(outline);
  return outline;
}

// Re-fit the outline after the plane geometry was replaced (scale change).
export function refitBaseMapSelectionOutline(mesh) {
  const outline = getBaseMapSelectionOutline(mesh);
  if (!outline) return;
  const positions = getOutlinePositions(mesh.geometry);
  if (!positions) return;
  outline.geometry?.dispose?.();
  outline.geometry = new LineGeometry();
  outline.geometry.setPositions(positions);
}

// The material is shared: only the geometry is released.
export function disposeBaseMapSelectionOutline(mesh) {
  const outline = getBaseMapSelectionOutline(mesh);
  if (!outline) return;
  mesh.remove(outline);
  outline.geometry?.dispose?.();
}
