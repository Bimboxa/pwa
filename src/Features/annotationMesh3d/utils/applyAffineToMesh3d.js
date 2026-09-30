import { reverseFace } from "./mesh3dTopology.js";

// Applies a 2D affine map (fitAffine2d, expressed in image PIXELS) to the
// plan coordinates of a STORED mesh (x, y normalized, z untouched). An
// affine map keeps planar faces planar, so move / rotate / resize all stay
// valid; a mirroring map flips the face windings back outward.
//
// imageSize: { width, height } of the base map reference image the mesh is
// normalized against. targetImageSize: the image the result is normalized
// against, when the map sends the mesh onto ANOTHER base map (cross-map
// paste) — defaults to the same image.
export default function applyAffineToMesh3d(
  mesh3d,
  affine,
  imageSize,
  targetImageSize = imageSize
) {
  if (!mesh3d?.vertices || !affine || !imageSize?.width || !imageSize?.height) {
    return mesh3d;
  }
  const { a, b, c, d, e, f } = affine;
  const { width, height } = imageSize;
  const { width: targetWidth, height: targetHeight } = targetImageSize;
  const mirrored = a * e - b * d < 0;
  return {
    ...mesh3d,
    vertices: mesh3d.vertices.map(([x, y, z]) => {
      const px = x * width;
      const py = y * height;
      return [
        (a * px + b * py + c) / targetWidth,
        (d * px + e * py + f) / targetHeight,
        z,
      ];
    }),
    faces: mirrored ? mesh3d.faces.map(reverseFace) : mesh3d.faces,
  };
}
