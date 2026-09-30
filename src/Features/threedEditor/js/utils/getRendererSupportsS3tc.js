// Scan base maps store BC1 (S3TC) textures: true when the GPU can sample
// them directly (sRGB variant included), else they are decoded to RGBA
// (scene3dAssetsCache).
export default function getRendererSupportsS3tc(renderer) {
  const extensions = renderer?.extensions;
  return Boolean(
    extensions?.has("WEBGL_compressed_texture_s3tc") &&
    extensions?.has("WEBGL_compressed_texture_s3tc_srgb")
  );
}
