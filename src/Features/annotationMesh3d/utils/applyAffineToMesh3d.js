import { reverseFace } from "./mesh3dTopology.js";

// Applies a 2D affine map (fitAffine2d, expressed in image PIXELS) to the
// plan coordinates of a STORED mesh (x, y normalized, z untouched). An
// affine map keeps planar faces planar, so move / rotate / resize all stay
// valid; a mirroring map flips the face windings back outward.
//
// imageSize: { width, height } of the base map reference image.
export default function applyAffineToMesh3d(mesh3d, affine, imageSize) {
  if (!mesh3d?.vertices || !affine || !imageSize?.width || !imageSize?.height) {
    return mesh3d;
  }
  const { a, b, c, d, e, f } = affine;
  const { width, height } = imageSize;
  const mirrored = a * e - b * d < 0;
  return {
    ...mesh3d,
    vertices: mesh3d.vertices.map(([x, y, z]) => {
      const px = x * width;
      const py = y * height;
      return [(a * px + b * py + c) / width, (d * px + e * py + f) / height, z];
    }),
    faces: mirrored ? mesh3d.faces.map(reverseFace) : mesh3d.faces,
  };
}
