// Declarative classification of host parts (buildHostPartIndex islands) into
// metering categories, driven by a per-role rule table — the pure core of
// the procedure-driven « Quantités clé » (paints written as if brushed).
//
// Frame: every host is expressed in ONE z-up frame (the plan's: meters, z =
// world up). Islands of an OPEN host (a shell without its top face, a low
// wall without its base, a swept sheet) carry CANONICAL normals, not outward
// ones: the rule's `orient` fixes them first —
//   "INTERIOR": the viewer stands inside (the water of the pool shell / the
//               pit): floors point up, vertical faces toward the host's plan
//               centre;
//   "EXTERIOR": the viewer stands outside (a low wall, a podium): tops up,
//               bottoms down, vertical faces away from the plan centre;
//   "UP":       non-vertical faces point up (a deck sheet).
// A vertical face whose plane passes through the centre keeps its canonical
// normal.
// A CLOSED host (`isClosed`: a prism, a stepped prism with its podiums)
// already carries OUTWARD normals from buildHostPartIndex — the only reliable
// ones on a non-convex solid (a podium riser faces its neighbour, not the
// host centre): they are kept for EXTERIOR and all flipped for INTERIOR.
//
// Rule fields (all optional):
//   vertical: category key of the vertical faces (|nz| < VERTICAL_NZ_MAX);
//   nonVertical: category key of every other face;
//   top: category key of the faces with oriented nz > TOP_NZ_MIN (wins over
//        nonVertical); slopedTop: same with SLOPED_TOP_NZ_MIN;
//   levelOnly: keep only the up-facing faces whose every vertex sits at
//              |z| ≤ LEVEL_TOL_M (the surface part of a gutter);
//   ignore: { levelZero, top, bottom } — drop the non-vertical faces at
//           z ≈ 0, at the host's box top plane, at its bottom plane;
//   weld: "FOOTPRINT" | "SUPPORT" | [..] (see weldSupportFootprints);
//   angles: "INTRA" | "BASE" | ["INTRA", "BASE"] | null (see
//           findReentrantChains / findBaseEdgesOnSupports);
//   anglesNeedVertical: keep only the re-entrant edges bordered by a
//           vertical face (meterHostParts) — drops the breaks of slope
//           between two floor faces.
//
// Pure (no three.js), node-testable.

import { normalize, scale } from "../../threedMesh/utils/vec3Utils.js";

import { faceArea, flipFace } from "./meshPaintGeometry.js";

export const DEFAULT_QTES_THRESHOLDS = {
  VERTICAL_NZ_MAX: 0.1,
  TOP_NZ_MIN: 0.9,
  SLOPED_TOP_NZ_MIN: 0.5,
  LEVEL_TOL_M: 0.005,
  PLANE_TOL_M: 0.005,
};

const ORIENT_EPS = 1e-6;

const boxCentre = (box) =>
  box
    ? {
        x: (box.min.x + box.max.x) / 2,
        y: (box.min.y + box.max.y) / 2,
        z: (box.min.z + box.max.z) / 2,
      }
    : { x: 0, y: 0, z: 0 };

const islandPoints = (island) =>
  (island.polygons || []).flatMap((polygon) => [
    ...(polygon.contour || []),
    ...(polygon.holes || []).flat(),
  ]);

export const meanZ = (island) => {
  const points = islandPoints(island);
  if (!points.length) return 0;
  return points.reduce((sum, p) => sum + p.z, 0) / points.length;
};

export const isVerticalNormal = (n, thresholds = DEFAULT_QTES_THRESHOLDS) =>
  Math.abs(n.z) < thresholds.VERTICAL_NZ_MAX;

// Flips an island (loops + normal) so its normal follows the rule's side:
// non-vertical faces point up for INTERIOR (a water volume has floors, no
// ceiling: the pit's top is ignored by its rule) and UP; for EXTERIOR they
// point away from the host's centre level (tops up, bottoms down). Vertical
// faces are judged in plan: toward (INTERIOR) / away from (EXTERIOR) the
// host's plan centre.
function orientIsland(island, orient, centre, thresholds) {
  const n = island.normal;
  let wanted = 0; // +1 keep, −1 flip, 0 undecided
  if (isVerticalNormal(n, thresholds)) {
    if (orient === "INTERIOR" || orient === "EXTERIOR") {
      const toCentre = {
        x: centre.x - island.centroid.x,
        y: centre.y - island.centroid.y,
      };
      const d = n.x * toCentre.x + n.y * toCentre.y;
      if (Math.abs(d) > ORIENT_EPS) {
        wanted = d > 0 === (orient === "INTERIOR") ? 1 : -1;
      }
    }
  } else if (orient === "INTERIOR" || orient === "UP") {
    wanted = n.z > 0 ? 1 : -1;
  } else if (orient === "EXTERIOR") {
    const above = meanZ(island) - centre.z;
    if (Math.abs(above) > ORIENT_EPS) {
      wanted = above > 0 === n.z > 0 ? 1 : -1;
    }
  }
  if (wanted >= 0) return island;
  const flipped = flipFace({ polygons: island.polygons, normal: n });
  return { ...island, polygons: flipped.polygons, normal: flipped.normal };
}

/**
 * Orients the islands of a host by its rule (see header).
 * @returns {{islands, chains, box}} a new host object
 */
export function orientHostByRole(
  host,
  rule,
  thresholds = DEFAULT_QTES_THRESHOLDS
) {
  const orient = rule?.orient;
  if (host.isClosed && (orient === "EXTERIOR" || orient === "INTERIOR")) {
    if (orient === "EXTERIOR") return { ...host };
    return {
      ...host,
      islands: (host.islands || []).map((island) => {
        const flipped = flipFace({
          polygons: island.polygons,
          normal: island.normal,
        });
        return {
          ...island,
          polygons: flipped.polygons,
          normal: flipped.normal,
        };
      }),
    };
  }
  const centre = boxCentre(host.box);
  return {
    ...host,
    islands: (host.islands || []).map((island) =>
      orientIsland(island, orient, centre, thresholds)
    ),
  };
}

function categoryOfIsland(island, host, rule, thresholds) {
  const n = normalize(island.normal);
  if (isVerticalNormal(n, thresholds)) return rule.vertical ?? null;

  const z = meanZ(island);
  const ignore = rule.ignore ?? {};
  if (ignore.levelZero && Math.abs(z) < thresholds.LEVEL_TOL_M) return null;
  if (
    ignore.top &&
    host.box &&
    Math.abs(z - host.box.max.z) < thresholds.PLANE_TOL_M
  ) {
    return null;
  }
  if (
    ignore.bottom &&
    host.box &&
    Math.abs(z - host.box.min.z) < thresholds.PLANE_TOL_M
  ) {
    return null;
  }
  if (rule.levelOnly) {
    const level = islandPoints(island).every(
      (p) => Math.abs(p.z) <= thresholds.LEVEL_TOL_M
    );
    if (!level || n.z < thresholds.TOP_NZ_MIN) return null;
  }
  if (rule.top && n.z > thresholds.TOP_NZ_MIN) return rule.top;
  if (rule.slopedTop && n.z > thresholds.SLOPED_TOP_NZ_MIN)
    return rule.slopedTop;
  return rule.nonVertical ?? null;
}

/**
 * @param {object} args
 * @param {Array<{hostId, role, islands, chains, box, isClosed?}>} args.hosts
 *   parts in the common frame (transformHostParts)
 * @param {object} args.rules { [role]: rule }
 * @param {object} [args.thresholds]
 * @returns {{ faces: Array<{hostId, role, category, polygons, normal, area}>,
 *   hosts: Array }} faces = classified islands (category = rule key, e.g.
 *   "sol"), hosts = the oriented hosts (every island, classified or not)
 */
export default function classifyHostPartsByRules({
  hosts,
  rules,
  thresholds = DEFAULT_QTES_THRESHOLDS,
}) {
  const faces = [];
  const oriented = [];
  for (const host of hosts || []) {
    const rule = rules?.[host.role];
    if (!rule) continue;
    const orientedHost = orientHostByRole(host, rule, thresholds);
    oriented.push(orientedHost);
    for (const island of orientedHost.islands) {
      const category = categoryOfIsland(island, orientedHost, rule, thresholds);
      if (!category) continue;
      const face = { polygons: island.polygons, normal: island.normal };
      faces.push({
        hostId: host.hostId,
        role: host.role,
        category,
        polygons: island.polygons,
        normal: scale(normalize(island.normal), 1),
        area: faceArea(face),
      });
    }
  }
  return { faces, hosts: oriented };
}
