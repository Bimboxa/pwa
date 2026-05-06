// Single source of truth for a baseMap's 3D transform. The defaults match the
// pre-existing render-time fallbacks in the 3D editor:
//   - position: origin
//   - rotation: -π/2 around X, so the plane lays flat as a floor
// Existing baseMaps in IndexedDB never had these fields populated, so the
// defaults preserve the historical visual.
const DEFAULT_POSITION = { x: 0, y: 0, z: 0 };
const DEFAULT_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };

export default function getBaseMapTransform(baseMap) {
  const position = baseMap?.position ?? DEFAULT_POSITION;
  const rotation = baseMap?.rotation ?? DEFAULT_ROTATION;
  return {
    position: { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
    rotation: {
      x: rotation.x ?? DEFAULT_ROTATION.x,
      y: rotation.y ?? DEFAULT_ROTATION.y,
      z: rotation.z ?? DEFAULT_ROTATION.z,
    },
  };
}

export { DEFAULT_POSITION, DEFAULT_ROTATION };
