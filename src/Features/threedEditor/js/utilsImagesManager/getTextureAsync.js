import { TextureLoader, SRGBColorSpace } from "three";

export default function getTextureAsync(url) {
  return new Promise((resolve, reject) => {
    // Reject instead of hanging: TextureLoader.load never settles on a
    // missing url, which used to leave the basemap group mesh-less forever
    // (blob URL not yet resolved from db.files right after a Krto import).
    if (!url) {
      reject(new Error("getTextureAsync: missing texture url"));
      return;
    }
    new TextureLoader().load(
      url,
      (texture) => {
        // The basemap PNG is sRGB-encoded; tag the texture so Three.js
        // converts samples to linear for shading and re-encodes to sRGB on
        // output. Without this, the photoreal export (which uses ACES tone
        // mapping + SRGBColorSpace output) crushes the contrast and the
        // floorplan content reads as a near-white rectangle.
        texture.colorSpace = SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`getTextureAsync: failed to load ${url}`))
    );
  });
}
