import {
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  Object3D,
  PlaneGeometry,
} from "three";

import {
  acquireScene3dAssets,
  acquireScene3dTopViewTexture,
} from "Features/scene3d/services/scene3dAssetsCache";
import { applyScene3dChunkTransform } from "Features/scene3d/js/buildScene3dChunkGeometry";
import { getScene3dDisplay3d } from "Features/scene3d/constants/scene3dConstants";

import pixelToWorld from "./pixelToWorld";

// Lift of the flat projection above the base map plane (basemap-local Z,
// metres) so it never z-fights with the plane it lies on.
const PROJECTION_LIFT_M = 0.01;

// The scan is a "decor": never raycast (click, hover, snap, camera pivot).
const noRaycast = () => {};

function markDecor(object) {
  object.userData.isDecor = true;
  object.raycast = noRaycast;
}

// SCENE_3D annotation (3D scan) in the 3D editor.
//
// Pose = the OBJECT_3D one (createObject3DAnnotation): the outer group sits
// at the bbox centre on the base map, rotated by the 2D rotation about
// basemap-local Z; `offsetZ` lifts it. The scan frame is already Z-up like
// the basemap-local frame (no axis swap): the inner group only recentres the
// scan — footprint centre on the pivot, lowest point on the plane.
//
// Display (annotation.sceneDisplay3d):
//   MESH        the textured mesh, streamed atlas by atlas from the shared
//               GPU cache (scene3dAssetsCache);
//   PROJECTION  the top view image as a flat quad — also the fallback when
//               the scan data is not on this device (Krto imported elsewhere).
//
// Every object is tagged `userData.isDecor`: the per-object passes of the
// scene (shadows, sketch edges, hover / dim material swap, vertex snap,
// section contours, scene export) skip it. Materials are unlit in every
// render mode — a photogrammetry texture already carries its lighting.
//
// Returns the group synchronously; content arrives through
// options.onAsyncLoaded. `userData.dispose` (run by
// AnnotationsManager._disposeAnnotationObject BEFORE its generic geometry /
// material disposal) empties the group and releases the cache reference, so
// the shared geometries and textures are never disposed by the generic path.
export default function createScene3dAnnotation(annotation, baseMap, options) {
  const bbox = annotation?.bbox;
  const scene3d = annotation?.scene3d;
  const sceneBbox = scene3d?.bbox;
  if (!bbox || !sceneBbox?.min || !sceneBbox?.max) return null;

  const outer = new Group();
  const center = pixelToWorld(
    { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 },
    baseMap
  );
  outer.position.set(center.x, center.y, Number(annotation.offsetZ) || 0);
  // SVG rotation is clockwise on screen; pixelToWorld mirrors y, so it is
  // -θ about basemap-local Z (same convention as OBJECT_3D).
  outer.rotation.z = MathUtils.degToRad(-(annotation.rotation || 0));
  outer.userData.isDecor = true;

  const inner = new Group();
  inner.position.set(
    -(sceneBbox.min[0] + sceneBbox.max[0]) / 2,
    -(sceneBbox.min[1] + sceneBbox.max[1]) / 2,
    -sceneBbox.min[2]
  );
  outer.add(inner);

  const opacity = Number.isFinite(annotation.opacity) ? annotation.opacity : 1;
  const materials = [];
  const releases = [];
  let disposed = false;

  // A cache hit delivers its atlases synchronously, before the manager has
  // attached (and registered) this group: the regular post-creation pass
  // covers that case, the callback is only for late arrivals.
  const notifyLoaded = () => {
    if (outer.parent) options?.onAsyncLoaded?.();
  };

  function showProjection() {
    const fileName = scene3d.topView?.fileName;
    if (!fileName) return;
    const widthM = sceneBbox.max[0] - sceneBbox.min[0];
    const heightM = sceneBbox.max[1] - sceneBbox.min[1];
    const { promise, release } = acquireScene3dTopViewTexture(fileName);
    releases.push(release);
    promise.then((texture) => {
      if (disposed || !texture) return;
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.02,
        opacity,
        side: DoubleSide,
        toneMapped: false,
      });
      materials.push(material);
      const mesh = new Mesh(new PlaneGeometry(widthM, heightM), material);
      markDecor(mesh);
      mesh.userData.ownsGeometry = true;
      // The quad lies on the plane (z = 0 of the outer group), whatever the
      // relief of the scan.
      mesh.position.set(
        (sceneBbox.min[0] + sceneBbox.max[0]) / 2,
        (sceneBbox.min[1] + sceneBbox.max[1]) / 2,
        sceneBbox.min[2] + PROJECTION_LIFT_M
      );
      inner.add(mesh);
      notifyLoaded();
    });
  }

  function showMesh() {
    // Drawing on the scan (see intersectScene3d): the picker works on its
    // own CPU data, in the chunk space — `frame` carries that space's world
    // transform (the same one as every chunk mesh). A fully transparent
    // scan is not drawable.
    if (opacity > 0) {
      const frame = new Object3D();
      applyScene3dChunkTransform(frame, sceneBbox);
      inner.add(frame);
      outer.userData.scene3dPick = { sceneId: scene3d.sceneId, frame };
    }

    const release = acquireScene3dAssets(scene3d.sceneId, {
      supportsBc1: Boolean(options?.supportsS3tc),
      onEvent: (event) => {
        if (disposed) return;
        if (event.type === "MISSING") {
          delete outer.userData.scene3dPick;
          showProjection();
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
            })
          : new MeshNormalMaterial({
              flatShading: true,
              side: DoubleSide,
              transparent,
              opacity,
            });
        materials.push(material);
        geometries.forEach((geometry) => {
          const mesh = new Mesh(geometry, material);
          markDecor(mesh);
          applyScene3dChunkTransform(mesh, sceneBbox);
          inner.add(mesh);
        });
        notifyLoaded();
      },
    });
    releases.push(release);
  }

  if (getScene3dDisplay3d(annotation) === "PROJECTION") showProjection();
  else showMesh();

  outer.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    delete outer.userData.scene3dPick;
    inner.children.forEach((child) => {
      if (child.userData.ownsGeometry) child.geometry?.dispose();
    });
    inner.clear();
    materials.forEach((material) => material.dispose());
    releases.forEach((release) => release());
  };

  return outer;
}
