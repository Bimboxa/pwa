// Module-level holder for the clipping-plane section-contour adjacency map,
// rebuilt by SectionContourManager whenever the cut plane moves (or is
// enabled/disabled). The dimension ("cote") snap reads it so the cursor can
// snap onto the cut contour — vertices and edges — in priority over the full
// mesh geometry.
//
// Shape: Map<vertexKey, { position: THREE.Vector3, neighbors: Set<key> }>
// (same shape as meshGraphStore, so findNearestEdgeSnap works unchanged).

let _adjacency = new Map();

export function setSectionContourAdjacency(adj) {
  _adjacency = adj || new Map();
}

export function getSectionContourAdjacency() {
  return _adjacency;
}

export function clearSectionContourAdjacency() {
  _adjacency = new Map();
}
