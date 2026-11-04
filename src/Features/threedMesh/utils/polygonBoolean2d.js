import polygonClipping from "polygon-clipping";

import { signedArea2d } from "./computeFaceArea.js";
import {
  closeRing,
  openLoop,
  removeCollinearVertices2d,
  withWinding,
} from "./coalesceCoplanarFaces.js";

// 2D polygon booleans of the maille tools, on top of `polygon-clipping`.
//
// Geometries are MultiPolygons in the library's own format:
//   MultiPolygon = Polygon[] ; Polygon = Ring[] (outer ring, then holes) ;
//   Ring = [x, y][] (closed: last point = first point).
// Every operation returns a MultiPolygon ([] = empty) or NULL when the
// library throws (near-degenerate input): callers treat null as a failure.
//
// Pure (no three.js), node-testable.

// Weld grid (meters): the same point reached through two different rigid
// maps (a crease vertex of two unfolded pieces) differs by float noise only.
export const DEFAULT_WELD_GRID_M = 1e-6;

// Returns weld(x, y) → [x, y]: the point snapped to the grid, or the point
// already registered in one of the 9 neighboring cells — two near-identical
// points always come back with the SAME coordinates (a plain grid snap
// separates two points straddling a rounding boundary).
export function createWelder(grid = DEFAULT_WELD_GRID_M) {
  const cells = new Map();
  return function weld(x, y) {
    const ix = Math.round(x / grid);
    const iy = Math.round(y / grid);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const found = cells.get(`${ix + dx}_${iy + dy}`);
        if (found) return found;
      }
    }
    const point = [ix * grid, iy * grid];
    cells.set(`${ix}_${iy}`, point);
    return point;
  };
}

// Open ring [[x, y]] of an open loop [{x, y}], through `map(p) → [x, y]`.
export function loopToRing(loop, map = (p) => [p.x, p.y]) {
  return loop.map(map);
}

// MultiPolygon of ONE polygon given as open rings [contour, ...holes]
// (rings shorter than 3 points are dropped; [] when the contour is).
export function ringsToMultiPolygon(rings) {
  if (!rings?.length || !(rings[0]?.length >= 3)) return [];
  const valid = rings.filter((ring) => ring?.length >= 3);
  return [valid.map((ring) => closeRing([...ring]))];
}

export function rectMultiPolygon({ xMin, xMax, yMin, yMax }) {
  return [
    [
      [
        [xMin, yMin],
        [xMax, yMin],
        [xMax, yMax],
        [xMin, yMax],
        [xMin, yMin],
      ],
    ],
  ];
}

export function unionAll(multiPolygons) {
  const geoms = (multiPolygons || []).filter((mp) => mp?.length);
  if (!geoms.length) return [];
  try {
    return polygonClipping.union(geoms[0], ...geoms.slice(1));
  } catch {
    return null;
  }
}

export function difference(subject, clip) {
  if (!subject?.length) return [];
  if (!clip?.length) return subject;
  try {
    return polygonClipping.difference(subject, clip);
  } catch {
    return null;
  }
}

export function intersection(a, b) {
  if (!a?.length || !b?.length) return [];
  try {
    return polygonClipping.intersection(a, b);
  } catch {
    return null;
  }
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum) / 2;
}

export function polygonArea(polygon) {
  if (!polygon?.length) return 0;
  let area = ringArea(polygon[0]);
  for (let i = 1; i < polygon.length; i++) area -= ringArea(polygon[i]);
  return Math.max(0, area);
}

export function multiPolygonArea(multiPolygon) {
  return (multiPolygon || []).reduce((sum, p) => sum + polygonArea(p), 0);
}

// Bounds { xMin, xMax, yMin, yMax } of a MultiPolygon, null when empty.
export function multiPolygonBounds(multiPolygon) {
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;
  for (const polygon of multiPolygon || []) {
    for (const [x, y] of polygon[0] || []) {
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  return xMin <= xMax ? { xMin, xMax, yMin, yMax } : null;
}

export function boundsOverlap(a, b, margin = 0) {
  return (
    !!a &&
    !!b &&
    a.xMin <= b.xMax + margin &&
    b.xMin <= a.xMax + margin &&
    a.yMin <= b.yMax + margin &&
    b.yMin <= a.yMax + margin
  );
}

// Every coordinate through `map([x, y]) → [x, y]`.
export function mapMultiPolygon(multiPolygon, map) {
  return (multiPolygon || []).map((polygon) =>
    polygon.map((ring) => ring.map(map))
  );
}

// [{ contour, holes, area }] open loops of {x, y} (contour CCW, holes CW,
// collinear vertices removed), polygons under `minArea` dropped.
export function multiPolygonToLoops(multiPolygon, { minArea = 0 } = {}) {
  const out = [];
  for (const polygon of multiPolygon || []) {
    if (!polygon.length) continue;
    const contour = withWinding(
      removeCollinearVertices2d(openLoop(polygon[0])),
      true
    );
    if (!contour || contour.length < 3) continue;
    const holes = polygon
      .slice(1)
      .map((ring) =>
        withWinding(removeCollinearVertices2d(openLoop(ring)), false)
      )
      .filter((hole) => hole && hole.length >= 3);
    let area = Math.abs(signedArea2d(contour));
    for (const hole of holes) area -= Math.abs(signedArea2d(hole));
    if (area <= minArea) continue;
    out.push({ contour, holes, area });
  }
  return out;
}
