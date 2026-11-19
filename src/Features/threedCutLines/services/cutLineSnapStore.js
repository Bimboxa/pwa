import { Vector3 } from "three";

import {
  getCutLinesVersion,
  getCutLinesWorldPolylines,
} from "./cutLineObjectsStore";

// Snap adjacency of the rendered cut lines (their VISIBLE run, stops
// applied): the cote / ruler draw of the 3D editor snaps onto their vertices
// and segments (DrawingOverlayThreed). Same shape as meshGraphStore —
// Map<key, { position: Vector3, neighbors: Set<key>, nodeIds: Set<id> }> —
// so findNearestVertexSnapInAdjacency / findNearestEdgeSnap read it
// unchanged. Rebuilt lazily, cached on the cutLineObjectsStore version.

let _adjacency = new Map();
let _builtVersion = -1;

function build() {
  const adjacency = new Map();
  for (const { id, points } of getCutLinesWorldPolylines()) {
    let previousKey = null;
    points.forEach((p, index) => {
      // Per-line keys: two lines crossing at a point stay two nodes (no
      // segment is ever merged across lines).
      const key = `${id}:${index}`;
      adjacency.set(key, {
        position: new Vector3(p.x, p.y, p.z),
        neighbors: new Set(),
        nodeIds: new Set([id]),
      });
      if (previousKey) {
        adjacency.get(previousKey).neighbors.add(key);
        adjacency.get(key).neighbors.add(previousKey);
      }
      previousKey = key;
    });
  }
  return adjacency;
}

export function getCutLineSnapAdjacency() {
  const version = getCutLinesVersion();
  if (version !== _builtVersion) {
    _adjacency = build();
    _builtVersion = version;
  }
  return _adjacency;
}
