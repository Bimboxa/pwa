import { length, normalize } from "../../threedMesh/utils/vec3Utils.js";

// The stored surface cuts of a host (annotation.surfaceCuts) follow the move
// / rotate / resize / mirror the host got in the 2D or 3D editor: their plan
// coordinates go through the same 2D affine map as the host's points
// (fitAffine2d, in image PIXELS — what commitWrapperTransform hands to
// applyAffineToMesh3d), z is shifted by dz (3D move).
//
// The plane normal goes through the inverse transpose of the map's linear
// part, expressed in the base-map-local meter frame (x right, y UP — the
// pixel frame has y down, hence the sign flips), so the mapped plane still
// holds the mapped points. A uniform scale, a rotation or a mirror keep it
// exact; z is never scaled.
//
// imageSize: {width, height} of the source base map image. targetImageSize:
// the image the result is normalized against (cross-map paste; defaults to
// imageSize).
//
// Pure: node-testable.

export default function applyAffineToSurfaceCuts(
  cuts,
  affine,
  imageSize,
  { targetImageSize = imageSize, dz = 0 } = {}
) {
  if (!Array.isArray(cuts) || !cuts.length) return cuts;
  const shiftZ = Number(dz) || 0;
  const hasAffine =
    affine &&
    imageSize?.width > 0 &&
    imageSize?.height > 0 &&
    targetImageSize?.width > 0 &&
    targetImageSize?.height > 0;
  if (!hasAffine && !shiftZ) return cuts;

  const { a, b, c, d, e, f } = hasAffine
    ? affine
    : { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };
  const width = hasAffine ? imageSize.width : 1;
  const height = hasAffine ? imageSize.height : 1;
  const targetWidth = hasAffine ? targetImageSize.width : 1;
  const targetHeight = hasAffine ? targetImageSize.height : 1;

  const mapPoint = (p) => {
    if (!Array.isArray(p)) return p;
    const [x, y, z] = p;
    const px = x * width;
    const py = y * height;
    return [
      (a * px + b * py + c) / targetWidth,
      (d * px + e * py + f) / targetHeight,
      (Number(z) || 0) + shiftZ,
    ];
  };

  // Linear part in the local meter frame: L = F·A·F with F = diag(1, -1)
  // (pixel y down → local y up) = [[a, -b], [-d, e]]; the normal takes
  // L^-T = [[e, d], [b, a]] / det, z untouched.
  const det = a * e - b * d;
  const mapNormal = (n) => {
    if (!Array.isArray(n) || !det) return n;
    const [nx, ny, nz] = n.map((v) => Number(v) || 0);
    const mapped = normalize({
      x: (e * nx + d * ny) / det,
      y: (b * nx + a * ny) / det,
      z: nz,
    });
    return length(mapped) > 0 ? [mapped.x, mapped.y, mapped.z] : n;
  };

  return cuts.map((cut) =>
    cut
      ? {
          ...cut,
          point: mapPoint(cut.point),
          seed: mapPoint(cut.seed),
          normal: mapNormal(cut.normal),
        }
      : cut
  );
}
