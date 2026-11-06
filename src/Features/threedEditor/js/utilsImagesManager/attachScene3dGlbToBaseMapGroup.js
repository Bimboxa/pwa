import { Group, MathUtils } from "three";

import { acquireScene3dGlb } from "Features/scene3d/services/scene3dGlbCache";
import {
  cloneScene3dGlbModel,
  createScene3dGlbBasicMaterial,
} from "Features/scene3d/js/parseScene3dGlb";

// GLB scene of a scan base map (scene3d.format "GLB") in the 3D editor: the
// model kept as is, attached to the base map group so it follows the base
// map pose. Same wraps as a PLY scan (attachScene3dToBaseMapGroup):
//   scanWrap → pivot (rotation.z = −θ) → inner (−cx, −cy, −zMin) → a clone
//   of the parsed model (scan frame, Z up — parseScene3dGlb), geometries
//   shared with the cache (scene3dGlbCache: one parse per file).
//
// Unlike a PLY scan the meshes keep their CPU geometry and their default
// raycast: the hover highlights the planar face under the cursor
// (MainThreedEditor) and the « Pinceau » paints it (meshBrushPick, scene
// target). They are still tagged `userData.isDecor` — every per-object pass
// skips them (vertex snap index, lasso, shadows, hover / dim material swap,
// section contours, scene export, walk collisions) — plus:
//   userData.isScene3dScan  follows the base map 3D opacity;
//   userData.isScene3dGlb   a face of a GLB scene (hover, brush);
//   userData.baseMapId      its base map.
//
// Materials: unlit copies of the model's (colour, texture, vertex colours),
// or the model's own PBR materials in the realistic render modes
// (options.realisticShading — the group key carries it, a mode toggle
// re-attaches). `userData.sourceOpacity` keeps the model's own transparency
// under the base map opacity (ImagesManager.applyBaseMapOpacity).
//
// options: {opacity, realisticShading, onLoaded}. Returns the dispose
// function (the shared geometries are never disposed here).
export default function attachScene3dGlbToBaseMapGroup(
  group,
  baseMap,
  options
) {
  const scene3d = baseMap?.scene3d;
  const zone = scene3d?.zone;
  if (!group || !zone || !scene3d?.glbFileName) return null;

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
    -(zone.zMin ?? scene3d.bbox?.min?.[2] ?? 0)
  );
  pivot.add(inner);

  const opacity = Number.isFinite(options?.opacity) ? options.opacity : 1;
  let materials = [];
  let disposed = false;

  const { promise, release } = acquireScene3dGlb(scene3d.glbFileName);
  promise.then(
    (model) => {
      // null: the file is not on this device — the plane shows the image
      if (disposed || !model) return;
      const cloned = cloneScene3dGlbModel(model, (source, { vertexColors }) => {
        const material =
          options?.realisticShading && source?.clone
            ? source.clone()
            : createScene3dGlbBasicMaterial(source, { vertexColors });
        const sourceOpacity = material.transparent ? material.opacity : 1;
        material.userData.sourceOpacity = sourceOpacity;
        material.opacity = opacity * sourceOpacity;
        material.transparent = material.opacity < 1;
        material.depthWrite = material.opacity >= 1;
        return material;
      });
      materials = cloned.materials;
      cloned.object.traverse((child) => {
        child.userData.isDecor = true;
        if (!child.isMesh) return;
        child.userData.isScene3dScan = true;
        child.userData.isScene3dGlb = true;
        child.userData.baseMapId = baseMap.id;
      });
      inner.add(cloned.object);
      options?.onLoaded?.();
    },
    (error) => {
      console.error("[scene3d] failed to load the GLB scene", error);
    }
  );

  return function disposeScene3dGlb() {
    if (disposed) return;
    disposed = true;
    delete group.userData.scanWrap;
    group.remove(scanWrap);
    inner.clear();
    materials.forEach((material) => material.dispose());
    release();
  };
}
