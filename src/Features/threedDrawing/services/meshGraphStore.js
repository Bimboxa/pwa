// Module-level holder for the mesh-edge adjacency map built when drawing
// mode activates. detectClosedFace pulls it on each click so the cycle BFS
// can traverse existing mesh geometry as candidate face borders.
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
