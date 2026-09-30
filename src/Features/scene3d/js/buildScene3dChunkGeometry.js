import { Box3, BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three";

// GEOMETRY row of db.scene3dAssets → BufferGeometry.
// Positions are Uint16 normalized on the scene grid: the geometry lives in
// [0..1]³ and the mesh carries the dequantization (position = scene bbox
// min, scale = scene bbox size — see applyScene3dChunkTransform).
//
// releaseAfterUpload: drop the CPU copy of each attribute once it is on the
// GPU (the scan is a "decor": never raycast, never edited). The bounds are
// set from the row, three.js never needs the arrays again.
export default function buildScene3dChunkGeometry(row, options) {
  const geometry = new BufferGeometry();
  const attributes = [];

  const position = new BufferAttribute(row.positions, 3, true);
  geometry.setAttribute("position", position);
  attributes.push(position);

  if (row.uvs) {
    const uv = new BufferAttribute(row.uvs, 2, row.uvs instanceof Uint16Array);
    geometry.setAttribute("uv", uv);
    attributes.push(uv);
  }

  const index = new BufferAttribute(row.index, 1);
  geometry.setIndex(index);
  attributes.push(index);

  geometry.boundingBox = new Box3(
    new Vector3(...row.boundsMin),
    new Vector3(...row.boundsMax)
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
    new Sphere()
  );

  if (options?.releaseAfterUpload) {
    attributes.forEach((attribute) => {
      attribute.onUpload(function releaseArray() {
        this.array = null;
      });
    });
  }

  return geometry;
}

// bbox: {min: [x, y, z], max: [x, y, z]} — the scene bbox (quantization grid).
export function applyScene3dChunkTransform(mesh, bbox) {
  mesh.position.set(bbox.min[0], bbox.min[1], bbox.min[2]);
  mesh.scale.set(
    Math.max(bbox.max[0] - bbox.min[0], 1e-6),
    Math.max(bbox.max[1] - bbox.min[1], 1e-6),
    Math.max(bbox.max[2] - bbox.min[2], 1e-6)
  );
}
