// Pure pipeline of the procedure-driven metering: hosts (parts in ONE z-up
// frame, with their role) → classified faces (classifyHostPartsByRules) →
// welded faces (weldSupportFootprints) → re-entrant edges (findReentrantChains
// within a host, findBaseEdgesOnSupports between a host and its supports).
//
// Shared by the procedure entry (real hosts) and the node tests (synthetic
// soups). Node-testable.

import classifyHostPartsByRules, {
  DEFAULT_QTES_THRESHOLDS,
} from "./classifyHostPartsByRules.js";
import findBaseEdgesOnSupports from "./findBaseEdgesOnSupports.js";
import findReentrantChains from "./findReentrantChains.js";
import { edgeLength, faceArea } from "./meshPaintGeometry.js";
import weldSupportFootprints from "./weldSupportFootprints.js";

const hasWeld = (rule, kind) =>
  Array.isArray(rule?.weld) ? rule.weld.includes(kind) : rule?.weld === kind;

/**
 * @param {object} args
 * @param {Array<{hostId, role, islands, chains, box}>} args.hosts
 * @param {object} args.rules { [role]: rule } (see classifyHostPartsByRules)
 * @param {string} [args.edgesCategory="angles"] category key of the edges
 * @param {object} [args.thresholds]
 * @returns {{ faces: Array<{hostId, role, category, polygons, normal, area}>,
 *   edges: Array<{hostId, category, points, sides, length}>,
 *   totals: Object<string, number> }} totals by category (m² for faces, m
 *   for edges)
 */
export default function meterHostParts({
  hosts,
  rules,
  edgesCategory = "angles",
  thresholds = DEFAULT_QTES_THRESHOLDS,
}) {
  const classified = classifyHostPartsByRules({ hosts, rules, thresholds });
  const faces = weldSupportFootprints({
    faces: classified.faces,
    hosts: classified.hosts,
    rules,
    thresholds,
  });

  const supports = classified.hosts.filter((host) =>
    hasWeld(rules?.[host.role], "SUPPORT")
  );
  const edges = [];
  for (const host of classified.hosts) {
    const rule = rules?.[host.role];
    const found =
      rule?.angles === "INTRA"
        ? findReentrantChains({ host, thresholds })
        : rule?.angles === "BASE"
          ? findBaseEdgesOnSupports({ host, supports, thresholds })
          : [];
    for (const edge of found) {
      edges.push({ ...edge, role: host.role, category: edgesCategory });
    }
  }

  const totals = {};
  for (const face of faces) {
    totals[face.category] = (totals[face.category] ?? 0) + faceArea(face);
  }
  for (const edge of edges) {
    totals[edge.category] = (totals[edge.category] ?? 0) + edgeLength(edge);
  }
  return { faces, edges, totals };
}
