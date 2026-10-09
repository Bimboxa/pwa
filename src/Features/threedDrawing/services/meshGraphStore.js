// Module-level holder for the mesh-edge adjacency map built when drawing
// mode activates. Read by the snap / alignment helpers (vertex alignment in
// computeSnapTarget, rotation overlays) — never to close a drawn shape.
//
// Shape: Map<vertexKey, { position: THREE.Vector3, neighbors: Set<key> }>

let _adjacency = new Map();

export function setMeshAdjacency(adj) {
  _adjacency = adj || new Map();
}

export function getMeshAdjacency() {
  return _adjacency;
}

export function clearMeshAdjacency() {
  _adjacency = new Map();
}
