import {
  cross,
  dot,
  length,
  normalize,
  sub,
} from "../../threedMesh/utils/vec3Utils.js";
import { MESH_PAINT_PART_TYPES } from "../constants/meshPaintConstants.js";

import {
  localGeometryToPaint,
  localToPaintPoint,
  paintGeometryToLocal,
  paintPointToLocal,
} from "./meshPaintFrame.js";
import { faceCentroid, getFaceNewellNormal } from "./meshPaintGeometry.js";

// A painted part follows the move / rotate / resize / mirror its host got in
// the 2D or 3D editor: the plan coordinates go through the same 2D affine
// map as the host's points (fitAffine2d, in image PIXELS — exactly what
// commitWrapperTransform hands to applyAffineToMesh3d), z is shifted by dz
// (3D move).
//
// FACE: the PHYSICAL side is kept. The centroid and a probe 1 cm along the
// painted side's normal are mapped too; the new normal (Newell of the mapped
// contour) is turned toward the mapped probe, and the loops re-wound about
// it. A mirror (det < 0) thus keeps painting the same physical face side.
//
// FACE, curved surface: vertices mapped, loops reversed by a mirror.
//
// EDGE: points mapped; the optional `sides` (normals of the facets the edge
// borders) go through the inverse transpose of the map.
//
// imageSize: {width, height} of the source base map image. targetImageSize:
// the image the result is normalized against (cross-map paste; defaults to
// imageSize). metrics: {imageWidth, imageHeight, meterByPx} of the source
// base map (local-meter normal). targetMetrics: of the target base map
// (defaults to metrics re-sized to targetImageSize).
//
// Pure: node-testable.

const PROBE_M = 0.01;

const isFace = (partType) => partType === MESH_PAINT_PART_TYPES.FACE;

// Normal of a facet under the (affine) local map: inverse transpose of its
// linear part, so outward stays outward through a mirror or a shear.
// Stored form [x, y, z] in and out.
function mapNormal(normal, mapLocal) {
  const o = mapLocal({ x: 0, y: 0, z: 0 });
  const a0 = sub(mapLocal({ x: 1, y: 0, z: 0 }), o);
  const a1 = sub(mapLocal({ x: 0, y: 1, z: 0 }), o);
  const a2 = sub(mapLocal({ x: 0, y: 0, z: 1 }), o);
  const c12 = cross(a1, a2);
  const det = dot(a0, c12);
  const [nx, ny, nz] = Array.isArray(normal)
    ? normal
    : [normal?.x, normal?.y, normal?.z];
  if (!det) return [nx || 0, ny || 0, nz || 0];
  const c20 = cross(a2, a0);
  const c01 = cross(a0, a1);
  const n = normalize({
    x: (nx * c12.x + ny * c20.x + nz * c01.x) / det,
    y: (nx * c12.y + ny * c20.y + nz * c01.y) / det,
    z: (nx * c12.z + ny * c20.z + nz * c01.z) / det,
  });
  return [n.x || 0, n.y || 0, n.z || 0];
}

export default function applyAffineToPaintGeometry({
  partType,
  geometry,
  affine,
  imageSize,
  targetImageSize = imageSize,
  dz = 0,
  metrics,
  targetMetrics,
}) {
  if (!geometry) return geometry;
  const shiftZ = Number(dz) || 0;
  const hasAffine =
    affine &&
    imageSize?.width > 0 &&
    imageSize?.height > 0 &&
    targetImageSize?.width > 0 &&
    targetImageSize?.height > 0;
  if (!hasAffine && !shiftZ) return geometry;

  const { a, b, c, d, e, f } = hasAffine
    ? affine
    : { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
  const width = hasAffine ? imageSize.width : 1;
  const height = hasAffine ? imageSize.height : 1;
  const targetWidth = hasAffine ? targetImageSize.width : 1;
  const targetHeight = hasAffine ? targetImageSize.height : 1;
  const mapPoint = ([x, y, z]) => {
    const px = x * width;
    const py = y * height;
    return [
      (a * px + b * py + c) / targetWidth,
      (d * px + e * py + f) / targetHeight,
      (Number(z) || 0) + shiftZ,
    ];
  };

  // Normals need a meter frame (z is in meters, x / y in pixels). Without
  // metrics the pixel is taken as the meter: exact for vertical and
  // horizontal faces only.
  const sourceMetrics = metrics ?? {
    imageWidth: width,
    imageHeight: height,
    meterByPx: 1,
  };
  const destMetrics = targetMetrics ?? {
    ...sourceMetrics,
    imageWidth: hasAffine ? targetImageSize.width : sourceMetrics.imageWidth,
    imageHeight: hasAffine ? targetImageSize.height : sourceMetrics.imageHeight,
  };
  const mapLocal = (v) =>
    paintPointToLocal(
      mapPoint(localToPaintPoint(v, sourceMetrics)),
      destMetrics
    );

  if (!isFace(partType)) {
    const mapped = {
      ...geometry,
      points: (geometry.points || []).map(mapPoint),
    };
    if (!geometry.sides?.length) return mapped;
    return {
      ...mapped,
      sides: geometry.sides.map((n) => mapNormal(n, mapLocal)),
    };
  }

  // Curved surface (indexed facets): the winding of every loop is its side —
  // a mirror turns it over, the loops are reversed to keep the physical one.
  if (Array.isArray(geometry.vertices)) {
    const mirrored = a * e - b * d < 0;
    return {
      ...geometry,
      vertices: geometry.vertices.map(mapPoint),
      facets: mirrored
        ? (geometry.facets || []).map((facet) =>
            (facet || []).map((loop) => [...loop].reverse())
          )
        : geometry.facets,
    };
  }

  const mappedPolygons = (geometry.polygons || []).map((polygon) => ({
    contour: (polygon.contour || []).map(mapPoint),
    holes: (polygon.holes || []).map((hole) => hole.map(mapPoint)),
  }));

  const sourceLocal = paintGeometryToLocal(partType, geometry, sourceMetrics);
  const mappedLocal = paintGeometryToLocal(
    partType,
    { polygons: mappedPolygons, normal: [0, 0, 1] },
    destMetrics
  );
  if (!sourceLocal || !mappedLocal) {
    return { ...geometry, polygons: mappedPolygons };
  }

  // Mapped probe offset = where the painted side went.
  const centroid = faceCentroid(sourceLocal);
  const n = sourceLocal.normal;
  const probe = {
    x: centroid.x + n.x * PROBE_M,
    y: centroid.y + n.y * PROBE_M,
    z: centroid.z + n.z * PROBE_M,
  };
  const offset = sub(mapLocal(probe), mapLocal(centroid));

  let normal = getFaceNewellNormal(mappedLocal) ?? mappedLocal.normal;
  if (dot(normal, offset) < 0) {
    normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  }
  if (!(length(normal) > 0)) normal = normalize(offset);

  return {
    ...geometry,
    ...localGeometryToPaint(
      partType,
      { polygons: mappedLocal.polygons, normal },
      destMetrics
    ),
  };
}
