import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
} from "three";

import { WHITE_PAGE_BORDER_COLOR } from "Features/baseMaps/utils/createWhitePageImage";

// Thin border of a white page plane in 3D: a white sheet over a light
// background (or over another white sheet) has no visible limit otherwise.
//
// A plain 1px LineLoop, child of the basemap mesh:
// - not a Mesh, so the scene export, the click picking and the vertex snap
//   already ignore it (they only keep meshes), and raycast is disabled;
// - child of the mesh, so it follows the image eye (meshWrap.visible), the
//   drawing offset and the removal of the mesh;
// - depth tested: the page in front hides the border of the page behind. The
//   polygonOffset of the plane lets the border win over its own page.
//
// The mesh owner disposes it (the cleanup loops of ImagesManager only free the
// plane's own geometry / material).

// Corners of a 1x1-segment PlaneGeometry, walked around the quad.
const CORNER_INDICES = [0, 1, 3, 2];

function buildBorderGeometry(planeGeometry) {
  const position = planeGeometry?.attributes?.position;
  const coords = [];
  if (position && position.count >= 4) {
    CORNER_INDICES.forEach((i) => {
      coords.push(position.getX(i), position.getY(i), position.getZ(i));
    });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(coords, 3));
  return geometry;
}

export function getBaseMapBorder(mesh) {
  return mesh?.children.find((c) => c.userData?.isBasemapBorder) ?? null;
}

// The border of the mesh, created on first call.
export function ensureBaseMapBorder(mesh) {
  if (!mesh) return null;
  const existing = getBaseMapBorder(mesh);
  if (existing) return existing;

  const material = new LineBasicMaterial({
    color: WHITE_PAGE_BORDER_COLOR,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  // same clipping as the plane it outlines (ClippingManager sets the planes
  // on the basemap material; a border created afterwards must not stick out)
  material.clippingPlanes = mesh.material?.clippingPlanes ?? null;

  const border = new LineLoop(buildBorderGeometry(mesh.geometry), material);
  border.userData.isBasemapBorder = true;
  border.raycast = () => {};
  mesh.add(border);
  return border;
}

// Re-fit the border after the plane geometry was replaced (scale change).
export function refitBaseMapBorder(mesh) {
  const border = getBaseMapBorder(mesh);
  if (!border) return;
  border.geometry?.dispose?.();
  border.geometry = buildBorderGeometry(mesh.geometry);
}

export function disposeBaseMapBorder(mesh) {
  const border = getBaseMapBorder(mesh);
  if (!border) return;
  mesh.remove(border);
  border.geometry?.dispose?.();
  border.material?.dispose?.();
}
