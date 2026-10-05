import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Shape,
  ShapeGeometry,
  Path,
  Vector2,
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import getHatchFillGeometry, {
  HATCH_BAND_WIDTH_M,
  HATCH_LINE_WIDTH_PX,
  HATCH_SPACING_M,
} from "Features/geometry/utils/getHatchFillGeometry";

import getPlanarMeshBoundary from "./getPlanarMeshBoundary";

// Hatched fill (fillType HATCHING / HATCHING_LEFT) of the planar sheets of an
// annotation: a solid band along the borders + oblique lines inside.
//
// The full surface (role "SOLID") stays in the scene with an INVISIBLE
// material: every tool picker, the carve, the quantities and the mesh
// conversions keep reading it as before. The band and the lines are children
// of that mesh with a no-op raycast. Selection / hover picking alone lets the
// ray through the gaps between the lines — see hatchPick.js.
//
// Idempotent: re-run by the finishing pass (async loads, CSG carve), it only
// rebuilds the meshes whose geometry changed.

const noRaycast = () => {};

function toRingPoints(ring) {
  // polygon-clipping rings repeat their first point.
  return ring.slice(0, -1).map(([x, y]) => new Vector2(x, y));
}

function buildBandGeometry(bandPolygons, frame) {
  const shapes = bandPolygons
    .map(([outer, ...holes]) => {
      if (!outer || outer.length < 4) return null;
      const shape = new Shape(toRingPoints(outer));
      holes.forEach((hole) => {
        if (hole.length >= 4) shape.holes.push(new Path(toRingPoints(hole)));
      });
      return shape;
    })
    .filter(Boolean);
  if (!shapes.length) return null;

  const flat = new ShapeGeometry(shapes);
  const flatPosition = flat.getAttribute("position");
  const { origin, u, v, normal } = frame;
  const positions = [];
  const normals = [];
  for (let i = 0; i < flatPosition.count; i++) {
    const x = flatPosition.getX(i);
    const y = flatPosition.getY(i);
    positions.push(
      origin.x + x * u.x + y * v.x,
      origin.y + x * u.y + y * v.y,
      origin.z + x * u.z + y * v.z
    );
    normals.push(normal.x, normal.y, normal.z);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setIndex(Array.from(flat.getIndex().array));
  flat.dispose();
  return geometry;
}

function buildHatchLines(lineSegments, frame, material, resolution) {
  if (!lineSegments.length) return null;
  const { origin, u, v } = frame;
  const positions = [];
  for (let i = 0; i < lineSegments.length; i += 2) {
    const x = lineSegments[i];
    const y = lineSegments[i + 1];
    positions.push(
      origin.x + x * u.x + y * v.x,
      origin.y + x * u.y + y * v.y,
      origin.z + x * u.z + y * v.z
    );
  }
  const color = material.color?.getHex?.() ?? 0x000000;
  const opacity = material.opacity ?? 1;

  // Fat lines (screen-space px thickness) need the canvas resolution —
  // without it (headless build) a 1 px line is kept.
  if (!resolution) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return new LineSegments(
      geometry,
      new LineBasicMaterial({ color, transparent: true, opacity })
    );
  }
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  return new LineSegments2(
    geometry,
    new LineMaterial({
      color,
      linewidth: HATCH_LINE_WIDTH_PX,
      resolution,
      worldUnits: false, // screen-space px thickness
      transparent: true,
      opacity,
      depthTest: true,
    })
  );
}

function clearHatchFill(solidMesh) {
  for (const child of [...solidMesh.children]) {
    if (!child.userData?.isHatchFill) continue;
    solidMesh.remove(child);
    child.geometry?.dispose?.();
    // The band shares the annotation material: only the line one is owned.
    if (child.userData.ownsMaterial) child.material?.dispose?.();
  }
  const userData = solidMesh.userData;
  if (userData.hatchOriginalMaterial) {
    solidMesh.material.dispose?.();
    solidMesh.material = userData.hatchOriginalMaterial;
  }
  delete userData.hatchOriginalMaterial;
  delete userData.isHatchPickSurface;
  delete userData.hatchPick;
  delete userData.hatchGeometry;
}

function applyHatchFillToMesh(solidMesh, direction, resolution) {
  if (solidMesh.userData.hatchGeometry === solidMesh.geometry) return;
  clearHatchFill(solidMesh);

  const frame = getPlanarMeshBoundary(solidMesh.geometry);
  if (!frame) return; // not planar: plain fill
  const hatch = getHatchFillGeometry({ loops: frame.loops, direction });
  if (!hatch) return;
  const bandGeometry = buildBandGeometry(hatch.bandPolygons, frame);
  if (!bandGeometry) return;

  const material = solidMesh.material;

  const band = new Mesh(bandGeometry, material);
  band.userData = { isHatchFill: true };
  band.raycast = noRaycast;
  solidMesh.add(band);

  const lines = buildHatchLines(
    hatch.lineSegments,
    frame,
    material,
    resolution
  );
  if (lines) {
    lines.userData = { isHatchFill: true, ownsMaterial: true };
    lines.raycast = noRaycast;
    solidMesh.add(lines);
  }

  // Invisible but still raycastable: three's raycaster ignores
  // material.visible, and the pickers only test object.visible.
  const pickMaterial = material.clone();
  pickMaterial.visible = false;
  solidMesh.material = pickMaterial;
  Object.assign(solidMesh.userData, {
    hatchOriginalMaterial: material,
    hatchGeometry: solidMesh.geometry,
    isHatchPickSurface: true,
    hatchPick: {
      origin: frame.origin,
      u: frame.u,
      v: frame.v,
      loops: frame.loops,
      direction,
      bandWidth: HATCH_BAND_WIDTH_M,
      spacing: HATCH_SPACING_M,
    },
  });
}

export default function applyHatchFill(root, { resolution } = {}) {
  const hatchFill = root?.userData?.hatchFill;
  if (!hatchFill) return;
  const solidMeshes = [];
  root.traverse((child) => {
    if (child.isMesh && child.userData?.role === "SOLID") {
      solidMeshes.push(child);
    }
  });
  solidMeshes.forEach((solidMesh) =>
    applyHatchFillToMesh(solidMesh, hatchFill.direction, resolution)
  );
}
