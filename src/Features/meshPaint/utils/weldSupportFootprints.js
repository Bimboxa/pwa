// Welds the horizontal faces of adjacent hosts: where a host B (rule `weld`
// containing "FOOTPRINT") stands on / hangs under a horizontal face of
// another host A, the footprint of B is removed from that face — the shell
// floor loses the pit's footprint, a deck sheet loses the low wall's, a low
// wall top loses the podium's. Faces of the FOOTPRINT host itself are left
// as they are (its top / bottom are usually ignored by its rule).
//
// Contact levels of B are the top and bottom planes of its box; a face of A
// is welded when its plane sits at one of them (PLANE_TOL_M) and its bounds
// overlap the footprint. The footprint is the XY union of every island of B
// (vertical faces project to slivers, dropped by area).
//
// Pure (polygon-clipping through polygonBoolean2d), node-testable.

import {
  boundsOverlap,
  difference,
  multiPolygonBounds,
  multiPolygonToLoops,
  ringsToMultiPolygon,
  unionAll,
} from "../../threedMesh/utils/polygonBoolean2d.js";

import { DEFAULT_QTES_THRESHOLDS, meanZ } from "./classifyHostPartsByRules.js";
import { faceArea } from "./meshPaintGeometry.js";

const MIN_FOOTPRINT_AREA_M2 = 1e-6;

const hasWeld = (rule, kind) =>
  Array.isArray(rule?.weld) ? rule.weld.includes(kind) : rule?.weld === kind;

const toRing = (loop) => loop.map((p) => [p.x, p.y]);

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

// XY MultiPolygon of a face's polygons (slivers dropped).
export function faceToMultiPolygonXY(polygons) {
  const parts = [];
  for (const polygon of polygons || []) {
    const contour = toRing(polygon.contour || []);
    if (contour.length < 3 || ringArea(contour) < MIN_FOOTPRINT_AREA_M2)
      continue;
    const holes = (polygon.holes || [])
      .map(toRing)
      .filter(
        (ring) => ring.length >= 3 && ringArea(ring) >= MIN_FOOTPRINT_AREA_M2
      );
    parts.push(ringsToMultiPolygon([contour, ...holes]));
  }
  return unionAll(parts) ?? [];
}

// XY footprint of a host: union of the projections of all its islands.
export function getHostFootprintXY(host) {
  return faceToMultiPolygonXY(
    (host.islands || []).flatMap((island) => island.polygons || [])
  );
}

/**
 * @param {object} args
 * @param {Array} args.faces classified faces (classifyHostPartsByRules)
 * @param {Array} args.hosts oriented hosts (same call), with `box`
 * @param {object} args.rules { [role]: rule }
 * @param {object} [args.thresholds]
 * @returns {Array} the faces, welded ones replaced (dropped when nothing is
 *   left), with `welded: true` on the modified faces
 */
export default function weldSupportFootprints({
  faces,
  hosts,
  rules,
  thresholds = DEFAULT_QTES_THRESHOLDS,
}) {
  const cutters = (hosts || [])
    .filter((host) => hasWeld(rules?.[host.role], "FOOTPRINT") && host.box)
    .map((host) => {
      const footprint = getHostFootprintXY(host);
      return {
        hostId: host.hostId,
        footprint,
        bounds: multiPolygonBounds(footprint),
        levels: [host.box.min.z, host.box.max.z],
      };
    })
    .filter((cutter) => cutter.footprint.length && cutter.bounds);
  if (!cutters.length) return faces;

  const out = [];
  for (const face of faces || []) {
    if (Math.abs(face.normal?.z ?? 0) < thresholds.TOP_NZ_MIN) {
      out.push(face);
      continue;
    }
    const z = meanZ(face);
    let current = null; // MultiPolygon XY once a cutter touches the face
    let touched = false;
    for (const cutter of cutters) {
      if (cutter.hostId === face.hostId) continue;
      if (
        !cutter.levels.some(
          (level) => Math.abs(level - z) <= thresholds.PLANE_TOL_M
        )
      ) {
        continue;
      }
      if (!current) current = faceToMultiPolygonXY(face.polygons);
      if (!boundsOverlap(multiPolygonBounds(current), cutter.bounds)) continue;
      const next = difference(current, cutter.footprint);
      if (next === null) continue; // boolean failure: keep the face as is
      current = next;
      touched = true;
    }
    if (!touched) {
      out.push(face);
      continue;
    }
    const loops = multiPolygonToLoops(current, {
      minArea: MIN_FOOTPRINT_AREA_M2,
    });
    if (!loops.length) continue; // fully covered
    const lift = (loop) => loop.map(([x, y]) => ({ x, y, z }));
    const up = (face.normal?.z ?? 0) > 0;
    // multiPolygonToLoops winds contours CCW (holes CW) about +z: reverse
    // for a down-facing face
    const wind = (loop) => (up ? loop : [...loop].reverse());
    const polygons = loops.map((loop) => ({
      contour: wind(lift(loop.contour.map((p) => [p.x, p.y]))),
      holes: loop.holes.map((hole) => wind(lift(hole.map((p) => [p.x, p.y])))),
    }));
    out.push({
      ...face,
      polygons,
      area: faceArea({ polygons }),
      welded: true,
    });
  }
  return out;
}
