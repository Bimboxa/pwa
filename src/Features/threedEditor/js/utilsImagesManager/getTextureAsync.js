import { TextureLoader, SRGBColorSpace } from "three";

export default function getTextureAsync(url) {
  return new Promise((resolve) => {
    new TextureLoader().load(url, (texture) => {
      // The basemap PNG is sRGB-encoded; tag the texture so Three.js
      // converts samples to linear for shading and re-encodes to sRGB on
      // output. Without this, the photoreal export (which uses ACES tone
      // mapping + SRGBColorSpace output) crushes the contrast and the
      // floorplan content reads as a near-white rectangle.
      texture.colorSpace = SRGBColorSpace;
      resolve(texture);
    });
  });
}
