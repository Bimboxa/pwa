import { PlaneGeometry } from "three";

import createImageObject, {
  attachBaseMapMesh,
} from "./utilsImagesManager/createImageObject";

export default class ImagesManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    this.scene = this.sceneManager.scene;
    // Each entry is a THREE.Group wrapping the basemap mesh + its annotations.
    // Annotations look up their parent group here at attach time.
    this.imagesMap = {};
    this.baseMapsMap = {}; // Store original baseMaps for annotations
  }

  createImagesObjects(images, baseMaps) {
    console.log("[ImagesManager] createImagesObjects", images);
    // Store baseMaps if provided
    if (baseMaps) {
      baseMaps.forEach((baseMap) => {
        this.baseMapsMap[baseMap.id] = baseMap;
      });
    }
    images.forEach((image) => this.addImageObject(image));
  }

  // Create + add a single basemap group. Idempotent on the group itself: if a
  // group for this basemap already exists, only retry a failed texture load
  // (blob URL that resolved late after a Krto import) instead of recreating —
  // annotations may already be attached as children of the existing group.
  addImageObject(image, baseMap) {
    if (!image) return;
    if (baseMap) this.baseMapsMap[baseMap.id] = baseMap;
    if (this.imagesMap[image.id]) {
      this.retryImageTexture(image);
      return;
    }
    const { group, ready } = createImageObject(image);
    group.userData.textureStatus = "pending";
    this.imagesMap[image.id] = group;
    this.scene.add(group);
    // Re-render once the texture is in. The group is already in the scene
    // graph so any annotations attached in the meantime are rendered too.
    ready
      .then(() => {
        group.userData.textureStatus = "loaded";
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        group.userData.textureStatus = "failed";
        console.warn("[ImagesManager] texture load failed", e);
      });
  }

  // Attach the missing basemap mesh into an existing group whose texture load
  // failed (e.g. the image url wasn't ready yet). No-op while pending/loaded.
  retryImageTexture(image) {
    const group = this.imagesMap[image?.id];
    if (!group || !image?.url) return;
    if (group.userData.textureStatus !== "failed") return;
    group.userData.textureStatus = "pending";
    attachBaseMapMesh(group, image)
      .then(() => {
        group.userData.textureStatus = "loaded";
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        group.userData.textureStatus = "failed";
        console.warn("[ImagesManager] texture retry failed", e);
      });
  }

  hasImageObject(baseMapId) {
    return Boolean(this.imagesMap[baseMapId]);
  }

  // True only when the basemap group exists AND its texture is loaded or
  // still loading. A "failed" group exists but should be repairable, so the
  // lazy-load guards must not treat it as done.
  hasTexturedImageObject(baseMapId) {
    const status = this.imagesMap[baseMapId]?.userData?.textureStatus;
    return status === "loaded" || status === "pending";
  }

  // Toggle a cached basemap group's visibility without removing it from the
  // scene, so re-showing it later is a cheap flag flip (no texture reload).
  // Note: the group hosts both the image (meshWrap) AND the annotations, so
  // this gates everything for the basemap. Use `setBaseMapImageVisible` to
  // toggle only the image while keeping annotations rendered.
  setBaseMapVisible(baseMapId, visible) {
    const group = this.imagesMap[baseMapId];
    if (group) group.visible = visible;
  }

  // Toggle only the basemap image (the meshWrap child) while leaving the
  // group — and therefore its attached annotation objects — visible. Lets a
  // basemap's annotations show in 3D even when its image is hidden.
  setBaseMapImageVisible(baseMapId, visible) {
    const meshWrap = this.imagesMap[baseMapId]?.userData?.meshWrap;
    if (meshWrap) meshWrap.visible = visible;
  }

  // Look up a basemap's group (parent for annotations attached to that map).
  getGroup(baseMapId) {
    return this.imagesMap[baseMapId] ?? null;
  }

  // The inner mesh wrapper carrying the live `drawingOffset` translation
  // along the plane's local normal. Annotations stay outside of it.
  getMeshWrap(baseMapId) {
    return this.imagesMap[baseMapId]?.userData?.meshWrap ?? null;
  }

  // Ids of the basemap groups currently in the scene. Used by the live
  // transform-apply hook to only refresh maps that are actually loaded.
  getLoadedBaseMapIds() {
    return Object.keys(this.imagesMap);
  }

  // Rebuild a loaded basemap's plane geometry in place (after a `meterByPx`
  // change). Disposes the old PlaneGeometry and swaps in a new one; the mesh,
  // material/texture and the group transform are untouched.
  updateBaseMapGeometry(baseMapId, { widthInM, heightInM }) {
    const group = this.imagesMap[baseMapId];
    if (!group || !Number.isFinite(widthInM) || !Number.isFinite(heightInM)) {
      return;
    }
    group.traverse?.((child) => {
      if (child.userData?.isBasemap) {
        child.geometry?.dispose?.();
        child.geometry = new PlaneGeometry(widthInM, heightInM);
      }
    });
  }

  deleteAllImagesObjects() {
    try {
      console.log("[ImagesManager] deleteAllImagesObjects");
      Object.values(this.imagesMap).forEach((group) => {
        // The group can carry annotations as siblings of the mesh wrapper;
        // dispose only the basemap's own mesh resources, not the
        // annotations' (AnnotationsManager owns those). Walk into the
        // meshWrap to find the basemap mesh.
        this.scene.remove(group);
        group.traverse?.((child) => {
          if (child.userData?.isBasemap) {
            child.geometry?.dispose?.();
            child.material?.dispose?.();
          }
        });
      });
      this.imagesMap = {};
      this.baseMapsMap = {};
    } catch (e) {
      console.log("Error", e);
    }
  }
}
