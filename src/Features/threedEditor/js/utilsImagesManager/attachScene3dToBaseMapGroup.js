import {
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  Object3D,
} from "three";

import { acquireScene3dAssets } from "Features/scene3d/services/scene3dAssetsCache";
import { applyScene3dChunkTransform } from "Features/scene3d/js/buildScene3dChunkGeometry";
import { getScene3dDisplay3d } from "Features/scene3d/constants/scene3dConstants";

// The scan is a "decor": never raycast (click, hover, snap, camera pivot).
const noRaycast = () => {};

function markDecor(object) {
  object.userData.isDecor = true;
  object.raycast = noRaycast;
}

// Identity of the scan content attached to a base map group: rebuilt when
// it changes (reload of the scan data, display toggle).
export function getScene3dGroupKey(baseMap) {
  const scene3d = baseMap?.scene3d;
  if (!scene3d?.sceneId) return null;
  return `${scene3d.sceneId}|${getScene3dDisplay3d(baseMap)}`;
}

// Scan of a scan base map (« Scène 3D ») in the 3D editor: the textured
// mesh, streamed atlas by atlas from the shared GPU cache
// (scene3dAssetsCache), attached to the base map group so it follows the
// base map pose (position, angle, orientation).
//
// Frames (see docs/baseMaps/SCENE_3D_BASE_MAPS.md): the base-map-local frame
// IS the zone frame — scan → local: q = R(−θ)·(p − center), plane at zMin.
//   scanWrap (sibling of meshWrap: the scan does not slide with the drawing
//     offset) → pivot (rotation.z = −θ) → inner (−cx, −cy, −zMin) → chunk
//     meshes (chunk space → scan frame through applyScene3dChunkTransform).
// The base map plane stays under the mesh: it loses every depth contest
// (renderOrder −1 + polygonOffset), the mesh shows above it and the image
// shows through the holes of the mesh.
//
// Display (scene3d.display3d): MESH → the mesh; PROJECTION / HIDDEN → the
// plane only (nothing attached). Missing scan data (Krto received on
// another device) → same as PROJECTION.
//
// Every object is tagged `userData.isDecor`: the per-object passes of the
// scene (shadows, sketch edges, hover / dim material swap, vertex snap,
// section contours, scene export) skip it. Materials are unlit in every
// render mode — a photogrammetry texture already carries its lighting.
//
// Drawing on the scan (intersectScene3d): the picker works on its own CPU
// data, in the chunk space — `group.userData.scene3dPick = {sceneId, frame}`
// carries that space's world transform (the same one as every chunk mesh).
//
// options: {renderer, supportsS3tc, opacity, onLoaded}. Returns the dispose function
// (empties the wrap, releases the cache reference — the shared geometries
// and textures are never disposed here).
export default function attachScene3dToBaseMapGroup(group, baseMap, options) {
  const scene3d = baseMap?.scene3d;
  const zone = scene3d?.zone;
  const sceneBbox = scene3d?.bbox;
  if (!group || !zone || !sceneBbox?.min || !sceneBbox?.max) return null;
  if (getScene3dDisplay3d(baseMap) !== "MESH") return null;

  const scanWrap = new Group();
  scanWrap.userData.kind = "baseMapScanWrap";
  scanWrap.userData.isDecor = true;
  group.add(scanWrap);
  group.userData.scanWrap = scanWrap;

  const pivot = new Group();
  pivot.rotation.z = MathUtils.degToRad(-(zone.rotationDeg || 0));
  scanWrap.add(pivot);

  const inner = new Group();
  inner.position.set(
    -zone.center[0],
    -zone.center[1],
    -(zone.zMin ?? sceneBbox.min[2])
  );
  pivot.add(inner);

  const frame = new Object3D();
  applyScene3dChunkTransform(frame, sceneBbox);
  inner.add(frame);
  group.userData.scene3dPick = { sceneId: scene3d.sceneId, frame };

  const opacity = Number.isFinite(options?.opacity) ? options.opacity : 1;
  const materials = [];
  let disposed = false;

  const release = acquireScene3dAssets(scene3d.sceneId, {
    renderer: options?.renderer ?? null,
    supportsBc1: Boolean(options?.supportsS3tc),
    onEvent: (event) => {
      if (disposed) return;
      if (event.type === "MISSING") {
        // no scan data on this device: the plane shows the image
        delete group.userData.scene3dPick;
        return;
      }
      if (event.type !== "ATLAS") return;
      const { texture, geometries } = event.atlas;
      const transparent = opacity < 1;
      const material = texture
        ? new MeshBasicMaterial({
            map: texture,
            side: DoubleSide,
            toneMapped: false,
            transparent,
            opacity,
            depthWrite: opacity >= 1,
          })
        : new MeshNormalMaterial({
            flatShading: true,
            side: DoubleSide,
            transparent,
            opacity,
            depthWrite: opacity >= 1,
          });
      materials.push(material);
      geometries.forEach((geometry) => {
        const mesh = new Mesh(geometry, material);
        markDecor(mesh);
        mesh.userData.isScene3dScan = true;
        applyScene3dChunkTransform(mesh, sceneBbox);
        inner.add(mesh);
      });
      options?.onLoaded?.();
    },
  });

  return function disposeScene3d() {
    if (disposed) return;
    disposed = true;
    delete group.userData.scene3dPick;
    delete group.userData.scanWrap;
    group.remove(scanWrap);
    inner.clear();
    materials.forEach((material) => material.dispose());
    release();
  };
}
