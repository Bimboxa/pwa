import createImageObject, {
  attachBaseMapMesh,
  attachBaseMapPreviewMesh,
  buildBaseMapPlaneGeometry,
  createBaseMapGroup,
  removeBaseMapPreviewMesh,
} from "./utilsImagesManager/createImageObject";
import getEditorImageFromBaseMap from "./utilsImagesManager/getEditorImageFromBaseMap";
import getPreviewTextureAsync from "./utilsImagesManager/getPreviewTextureAsync";
import { FADED_IMAGE_OPACITY } from "Features/baseMaps/constants/baseMapsImageMode";
import attachScene3dToBaseMapGroup, {
  getScene3dGroupKey,
} from "./utilsImagesManager/attachScene3dToBaseMapGroup";
import attachLocalScanZMapToBaseMapGroup from "./utilsImagesManager/attachLocalScanZMapToBaseMapGroup";
import attachLocalScanToBaseMapGroup, {
  getLocalScanGroupKey,
} from "./utilsImagesManager/attachLocalScanToBaseMapGroup";
import getRendererSupportsS3tc from "./utils/getRendererSupportsS3tc";

import getBaseMapOpacityIn3d from "Features/threedEditor/utils/getBaseMapOpacityIn3d";

// Identity of a basemap mesh: texture url + version image size + version
// transform + reference frame. When any of these change (active version
// switch, version transform edit, new file), the mesh must be rebuilt.
// meterByPx is NOT part of it — scale changes are applied in place by
// updateBaseMapGeometry.
function getPlaneSignature(image) {
  const t = image?.versionTransform || {};
  const vs = image?.versionSizePx || {};
  const rs = image?.refSizePx || {};
  return [
    image?.url,
    `${vs.width}x${vs.height}`,
    `${rs.width}x${rs.height}`,
    `${t.x ?? 0},${t.y ?? 0},${t.rotation ?? 0},${t.scale ?? 1}`,
  ].join("|");
}

export default class ImagesManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;

    this.scene = this.sceneManager.scene;
    // Each entry is a THREE.Group wrapping the basemap mesh + its annotations.
    // Annotations look up their parent group here at attach time.
    this.imagesMap = {};
    this.baseMapsMap = {}; // Store original baseMaps for annotations
    // Desired visibilities, mirrored from redux by useApplyBaseMapVisibilityIn3d
    // (setBaseMapVisibilities batch). Stored so groups created LATER (initial
    // loadMaps, lazy ensureBaseMapLoaded) start with the right visibility
    // instead of flashing visible until the next visibility pass.
    this.groupVisibleByBaseMapId = {};
    this.imageVisibleByBaseMapId = {};
    // Scan mesh of a scan base map (scanWrap): image eye AND the "3D" button
    // of the base maps list (hiddenScene3dBaseMapIdsIn3d). Same contract.
    this.scanVisibleByBaseMapId = {};
    // Desired 3D opacity, mirrored from redux by useApplyBaseMapOpacityIn3d.
    // Same "record the desired state" contract as the visibility maps above,
    // and for the same reason: the basemap mesh is attached ASYNCHRONOUSLY
    // (texture load), so the value must be stored until the mesh exists
    // instead of being pushed once. Shape mirrors `state.threedEditor` so
    // getBaseMapOpacityIn3d resolves override ?? global for any basemap,
    // including those not created yet.
    this.opacityState = { baseMapOpacityIn3d: 1, opacityByBaseMapIdIn3d: {} };
    // Base maps displayed grey (faded opacity + desaturated image) — the
    // sheets of the Dessin module's 3D base maps grid whose image eye is
    // off (BaseMapsGridManager). Same record-then-apply contract as the
    // opacity: applied after every async mesh attach.
    this.fadedBaseMapIds = new Set();
    // Preview textures of the 3D base maps grid (down-scaled images, see
    // ensureBaseMapPreview), kept for the session: id → { signature,
    // promise }.
    this.previewTextureById = {};
    // Point clouds of the base maps projected from a local scan, mirrored
    // from redux by useApplyBaseMapsScanModeIn3d (bottom bar « Scan 3D »)
    // and from the Scan 3D tool: display mode, resource shown by the tool
    // itself (its base maps then stay empty), main base map (preferred
    // carrier when several base maps share one scan).
    this.localScanState = {
      mode: "NONE",
      toolResourceId: null,
      mainBaseMapId: null,
      // « 3D » chip off in the base maps list
      hiddenBaseMapIds: [],
      // bottom bar « Zmap »: the height map meshes of the scan base maps
      zMap: false,
      // bumped when a height map is rebuilt (localScanHeightMapService)
      zMapTick: 0,
    };
  }

  // Resolve + apply one basemap's desired opacity to its mesh material.
  // Called after EVERY async mesh attach, so a mesh born after the last
  // opacity change (texture still in flight, active version switch, late blob
  // url repair) never keeps a stale value. A faded base map (grid) is
  // capped at the faded opacity and desaturated (createBaseMapMaterial).
  applyBaseMapOpacity(baseMapId) {
    const group = this.imagesMap[baseMapId];
    if (!group) return;
    const faded = this.fadedBaseMapIds.has(baseMapId);
    const desired = getBaseMapOpacityIn3d(this.opacityState, baseMapId);
    const opacity = faded ? Math.min(desired, FADED_IMAGE_OPACITY) : desired;
    group.traverse?.((child) => {
      // The scan of a scan base map follows the base map opacity too.
      if (child.userData?.isScene3dScan && child.material) {
        child.material.opacity = opacity;
        child.material.transparent = opacity < 1;
        child.material.depthWrite = opacity >= 1;
        child.material.needsUpdate = true;
        return;
      }
      if (child.userData?.isBasemap && child.material) {
        // Never touch `transparent` — the mesh is created with
        // `transparent: true` once and stays in that queue, so dragging
        // through 1.0 doesn't trigger a render-queue swap. `depthWrite`
        // toggles with opacity===1 so that a translucent basemap doesn't
        // occlude what sits behind it (see createImageObject for the full
        // rationale).
        child.material.opacity = opacity;
        child.material.depthWrite = opacity >= 1;
        const desaturate = child.material.userData?.uDesaturate;
        if (desaturate) desaturate.value = faded ? 1 : 0;
      }
    });
  }

  // Batch mirror from redux — one call per opacity pass. Records the desired
  // state (used by basemaps created later) and applies it to the groups
  // already in the scene.
  setBaseMapOpacities(opacityState) {
    if (opacityState) this.opacityState = opacityState;
    Object.keys(this.imagesMap).forEach((id) => this.applyBaseMapOpacity(id));
  }

  // Grey display of one base map's image (3D base maps grid of the Dessin
  // module, image eye off): recorded, then applied like the opacity.
  setBaseMapFaded(baseMapId, faded) {
    const was = this.fadedBaseMapIds.has(baseMapId);
    if (faded) this.fadedBaseMapIds.add(baseMapId);
    else this.fadedBaseMapIds.delete(baseMapId);
    if (was !== Boolean(faded)) this.applyBaseMapOpacity(baseMapId);
  }

  // Down-scaled texture of a base map image, loaded once per image
  // (signature) and kept for the session — a few MB whatever the plan.
  getPreviewTexture(baseMapId, url, signature) {
    const cached = this.previewTextureById[baseMapId];
    if (cached?.signature === signature) return cached.promise;
    cached?.promise.then((texture) => texture.dispose()).catch(() => {});
    const promise = getPreviewTextureAsync(url);
    this.previewTextureById[baseMapId] = { signature, promise };
    return promise;
  }

  // Preview mesh of a base map on the table of the 3D base maps grid
  // (Dessin module): a sheet whose base map does not take part in the scene
  // shows a down-scaled image instead of loading the full one (memory).
  // Creates the texture-less group when needed; no-op when the full image is
  // there or on its way, or when the current preview matches the image.
  ensureBaseMapPreview(baseMap) {
    const group = this.ensureBaseMapGroup(baseMap);
    if (!group || this.hasTexturedImageObject(baseMap.id)) return;
    const image = getEditorImageFromBaseMap(baseMap);
    if (!image?.url) return;
    const signature = getPlaneSignature(image);
    if (group.userData.previewSignature === signature) return;
    removeBaseMapPreviewMesh(group);
    // Same stash refresh as attachBaseMapMesh (the group may predate a
    // version switch).
    group.userData.planePx = {
      refSizePx: image.refSizePx,
      versionSizePx: image.versionSizePx,
      versionTransform: image.versionTransform,
    };
    const stashedM = group.userData.meterByPx;
    if (!(Number.isFinite(stashedM) && stashedM > 0)) {
      group.userData.meterByPx = image.meterByPx;
    }
    group.userData.previewSignature = signature;
    this.getPreviewTexture(baseMap.id, image.url, signature)
      .then((texture) => {
        // dropped, re-imaged, fully textured or superseded meanwhile
        if (this.imagesMap[baseMap.id] !== group) return;
        if (group.userData.previewSignature !== signature) return;
        if (this.hasTexturedImageObject(baseMap.id)) return;
        if (!attachBaseMapPreviewMesh(group, texture, signature)) return;
        this.applyBaseMapOpacity(baseMap.id);
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        if (group.userData.previewSignature === signature) {
          delete group.userData.previewSignature;
        }
        console.warn("[ImagesManager] preview texture load failed", e);
      });
  }

  // Drops the preview mesh of a base map (its texture stays cached).
  removeBaseMapPreview(baseMapId) {
    const group = this.imagesMap[baseMapId];
    if (!group) return;
    if (removeBaseMapPreviewMesh(group)) this.sceneManager.renderScene();
    else delete group.userData.previewSignature;
  }

  // Releases the cached preview textures (scene teardown).
  releasePreviewTextures() {
    Object.values(this.previewTextureById).forEach(({ promise }) =>
      promise.then((texture) => texture.dispose()).catch(() => {})
    );
    this.previewTextureById = {};
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
  // group for this basemap already exists, only rebuild its mesh when needed
  // (failed texture load, active version switch) instead of recreating —
  // annotations may already be attached as children of the existing group.
  addImageObject(image, baseMap) {
    if (!image) return;
    if (baseMap) this.baseMapsMap[baseMap.id] = baseMap;
    if (this.imagesMap[image.id]) {
      this.ensureImageTexture(image);
      this.syncScene3d(image.id);
      this.syncLocalScans();
      return;
    }
    const { group, ready } = createImageObject(image);
    group.userData.textureStatus = "pending";
    group.userData.planeSignature = getPlaneSignature(image);
    this.imagesMap[image.id] = group;
    // Start from the desired visibilities recorded BEFORE creation, so a
    // basemap whose image must be hidden (Viewer landing) never renders it,
    // even though the texture attaches asynchronously.
    const groupVisible = this.groupVisibleByBaseMapId[image.id];
    if (groupVisible !== undefined) group.visible = groupVisible;
    const imageVisible = this.imageVisibleByBaseMapId[image.id];
    if (imageVisible !== undefined && group.userData.meshWrap) {
      group.userData.meshWrap.visible = imageVisible;
    }
    this.scene.add(group);
    // syncScene3d applies the recorded scan visibility to the scanWrap.
    this.syncScene3d(image.id);
    this.syncLocalScans();
    // Base maps grid open: a group created meanwhile joins its sheet pose.
    this.sceneManager.baseMapsGridManager?.onGroupCreated(image.id, group);
    // Re-render once the texture is in. The group is already in the scene
    // graph so any annotations attached in the meantime are rendered too.
    ready
      .then(() => {
        group.userData.textureStatus = "loaded";
        // The material only exists now — push the desired opacity before the
        // first draw so the mesh never flashes at full opacity.
        this.applyBaseMapOpacity(image.id);
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        group.userData.textureStatus = "failed";
        console.warn("[ImagesManager] texture load failed", e);
      });
  }

  // Texture-less basemap group (3D base maps grid): the posed group, its mesh
  // wrapper and stashes, but NO mesh and NO texture load. Status "none" falls
  // through every lazy-load guard (hasTexturedImageObject /
  // hasCurrentImageObject), so the regular ensureBaseMapLoaded →
  // ensureImageTexture path attaches the mesh in place when the base map is
  // shown. No-op (returns the group) when it already exists.
  ensureBaseMapGroup(baseMap) {
    if (!baseMap?.id || baseMap.isPhoto) return null;
    const existing = this.imagesMap[baseMap.id];
    if (existing) return existing;
    const image = getEditorImageFromBaseMap(baseMap);
    const group = createBaseMapGroup(image);
    group.userData.textureStatus = "none";
    group.userData.planeSignature = null;
    this.imagesMap[baseMap.id] = group;
    this.baseMapsMap[baseMap.id] = baseMap;
    const groupVisible = this.groupVisibleByBaseMapId[baseMap.id];
    if (groupVisible !== undefined) group.visible = groupVisible;
    const imageVisible = this.imageVisibleByBaseMapId[baseMap.id];
    if (imageVisible !== undefined) {
      group.userData.meshWrap.visible = imageVisible;
    }
    this.scene.add(group);
    return group;
  }

  // Scan base map (« Scène 3D »): (re)attach the scan mesh to the group when
  // the base map's scan content changed (first load, reload of the scan
  // data, display toggle) — no-op otherwise. The registry (baseMapsMap)
  // must hold the base map first.
  syncScene3d(baseMapId) {
    const group = this.imagesMap[baseMapId];
    const baseMap = this.baseMapsMap[baseMapId];
    if (!group) return;
    const key = getScene3dGroupKey(baseMap);
    if (group.userData.scene3dKey === key) return;
    group.userData.disposeScene3d?.();
    delete group.userData.disposeScene3d;
    group.userData.scene3dKey = key;
    if (!key) return;
    const dispose = attachScene3dToBaseMapGroup(group, baseMap, {
      renderer: this.sceneManager.renderer,
      supportsS3tc: getRendererSupportsS3tc(this.sceneManager.renderer),
      opacity: getBaseMapOpacityIn3d(this.opacityState, baseMapId),
      onLoaded: () => {
        this.sceneManager.clippingManager?.reapply?.();
        this.sceneManager.renderScene();
      },
    });
    if (dispose) group.userData.disposeScene3d = dispose;
    // A scan hidden before its (re)attach — image eye off, "3D" button off,
    // display3d toggled back to MESH — must not pop back in.
    const scanVisible = this.scanVisibleByBaseMapId[baseMapId];
    if (scanVisible !== undefined && group.userData.scanWrap) {
      group.userData.scanWrap.visible = scanVisible;
    }
  }

  // Scan base maps projected from a local point cloud: one carrier per
  // resource — the main base map when it carries the scan, otherwise the
  // first visible loaded one — so several slices of one scan never show it
  // twice. Re-run whenever the mode, the tool, the main base map, the
  // visibilities or the loaded groups change.
  setLocalScanState(patch) {
    Object.assign(this.localScanState, patch);
    this.syncLocalScans();
  }

  syncLocalScans() {
    const {
      mode,
      toolResourceId,
      mainBaseMapId,
      hiddenBaseMapIds,
      zMap,
      zMapTick,
    } = this.localScanState;
    const carriers = {};
    if (mode !== "NONE")
      Object.keys(this.imagesMap)
        .sort()
        .forEach((id) => {
          const baseMap = this.baseMapsMap[id];
          if (!getLocalScanGroupKey(baseMap)) return;
          if (this.groupVisibleByBaseMapId[id] === false) return;
          if (hiddenBaseMapIds.includes(id)) return;
          const { resourceId } = baseMap.localScan;
          if (resourceId === toolResourceId) return;
          if (!carriers[resourceId] || id === mainBaseMapId)
            carriers[resourceId] = id;
        });
    Object.entries(this.imagesMap).forEach(([id, group]) => {
      const baseMap = this.baseMapsMap[id];
      const resourceId = baseMap?.localScan?.resourceId;
      const key =
        resourceId && carriers[resourceId] === id
          ? getLocalScanGroupKey(baseMap)
          : null;
      if (group.userData.localScanKey !== key) {
        group.userData.localScan?.dispose();
        delete group.userData.localScan;
        group.userData.localScanKey = key;
        if (key)
          group.userData.localScan = attachLocalScanToBaseMapGroup(
            group,
            baseMap,
            {
              sceneManager: this.sceneManager,
              mode,
              onLoaded: () => {
                this.sceneManager.clippingManager?.reapply?.();
                this.sceneManager.renderScene();
              },
            }
          );
      }
      group.userData.localScan?.setMode(mode);
      // Zmap: one mesh per scan base map (its own height map), independent
      // of the points carrier; hidden with the group or its « 3D » chip.
      // Attached whenever shown or, with the base map's « Zmap pour le
      // raycaster » switch on (default), always: the raycaster — the 3D
      // altimetry — meets the relief even while the Zmap is not rendered.
      const zMapRaycast = baseMap?.localScan?.zMapRaycast !== false;
      const zMapKey =
        (zMap || zMapRaycast) &&
        baseMap?.localScan?.resourceId &&
        this.groupVisibleByBaseMapId[id] !== false &&
        !hiddenBaseMapIds.includes(id)
          ? `${id}|${zMapTick}`
          : null;
      if (group.userData.localScanZMapKey !== zMapKey) {
        group.userData.localScanZMapHandle?.dispose();
        delete group.userData.localScanZMapHandle;
        group.userData.localScanZMapKey = zMapKey;
        if (zMapKey)
          group.userData.localScanZMapHandle =
            attachLocalScanZMapToBaseMapGroup(group, baseMap, {
              sceneManager: this.sceneManager,
              shown: zMap,
              raycast: zMapRaycast,
              onLoaded: () => {
                this.sceneManager.clippingManager?.reapply?.();
                this.sceneManager.renderScene();
              },
            });
      }
      group.userData.localScanZMapHandle?.setShown(zMap);
      group.userData.localScanZMapHandle?.setRaycast(zMapRaycast);
    });
  }

  // Editor teardown: release every scan reference so the shared cache can
  // evict the resources uploaded to this renderer (kept otherwise — with
  // their CPU copies released — and replayed on the next renderer, which
  // cannot upload them: see scene3dAssetsCache).
  releaseScene3dAssets() {
    Object.values(this.imagesMap).forEach((group) => {
      group.userData.disposeScene3d?.();
      delete group.userData.disposeScene3d;
      delete group.userData.scene3dKey;
      group.userData.localScan?.dispose();
      delete group.userData.localScan;
      delete group.userData.localScanKey;
      group.userData.localScanZMapHandle?.dispose();
      delete group.userData.localScanZMapHandle;
      delete group.userData.localScanZMapKey;
    });
  }

  // Drop a group that never got a mesh (grid placeholder) — it would
  // otherwise inflate the scene boxes read by the clipping / shadow managers.
  // Groups carrying a mesh or annotation objects are left alone.
  removeUntexturedGroup(baseMapId) {
    const group = this.imagesMap[baseMapId];
    if (!group || group.userData.textureStatus !== "none") return false;
    const meshWrap = group.userData.meshWrap;
    const scanWrap = group.userData.scanWrap;
    const localScanWrap = group.userData.localScanWrap;
    if (
      group.children.some(
        (child) =>
          child !== meshWrap && child !== scanWrap && child !== localScanWrap
      )
    )
      return false;
    // a preview of the table is not a texture
    removeBaseMapPreviewMesh(group);
    group.userData.disposeScene3d?.();
    group.userData.localScan?.dispose();
    this.scene.remove(group);
    delete this.imagesMap[baseMapId];
    delete this.baseMapsMap[baseMapId];
    return true;
  }

  // (Re)attach the basemap mesh of an existing group when its texture load
  // failed (blob URL that resolved late after a Krto import) OR when the
  // image changed (active version switch, version transform edit). No-op
  // while a load is in flight or when the mesh already matches the image.
  ensureImageTexture(image) {
    const group = this.imagesMap[image?.id];
    if (!group || !image?.url) return;
    const status = group.userData.textureStatus;
    if (status === "pending") return;
    const signature = getPlaneSignature(image);
    if (status === "loaded" && group.userData.planeSignature === signature) {
      return;
    }
    // Drop the current mesh (if any) — geometry AND texture may both change.
    // A preview of the table goes too (its texture stays cached).
    removeBaseMapPreviewMesh(group);
    const meshWrap = group.userData.meshWrap;
    meshWrap?.children
      .filter((c) => c.userData?.isBasemap)
      .forEach((mesh) => {
        meshWrap.remove(mesh);
        mesh.geometry?.dispose?.();
        mesh.material?.map?.dispose?.();
        mesh.material?.dispose?.();
      });
    group.userData.textureStatus = "pending";
    group.userData.planeSignature = signature;
    attachBaseMapMesh(group, image)
      .then(() => {
        group.userData.textureStatus = "loaded";
        // Fresh material (the old one was disposed above) — re-push the
        // desired opacity, otherwise a version switch silently resets the
        // basemap to fully opaque.
        this.applyBaseMapOpacity(image.id);
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        group.userData.textureStatus = "failed";
        console.warn("[ImagesManager] texture reload failed", e);
      });
  }

  // True when the group exists AND its mesh matches this image (texture
  // loaded, or load in flight) — the lazy-load guard. A "failed" group or a
  // mesh built for another version must fall through to ensureImageTexture.
  hasCurrentImageObject(baseMapId, image) {
    const group = this.imagesMap[baseMapId];
    if (!group) return false;
    const status = group.userData.textureStatus;
    if (status === "pending") return true;
    return (
      status === "loaded" &&
      group.userData.planeSignature === getPlaneSignature(image)
    );
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
  // The desired state is recorded even when the group doesn't exist yet —
  // addImageObject applies it at creation.
  setBaseMapVisible(baseMapId, visible) {
    this.groupVisibleByBaseMapId[baseMapId] = visible;
    // Base maps grid open: every sheet stays displayed (placeholder outline
    // when hidden). The recorded state is restored when the grid closes.
    if (this.sceneManager.baseMapsGridManager?.isSheet(baseMapId)) return;
    const group = this.imagesMap[baseMapId];
    if (group) group.visible = visible;
  }

  // Toggle only the basemap image (the meshWrap child) while leaving the
  // group — and therefore its attached annotation objects — visible. Lets a
  // basemap's annotations show in 3D even when its image is hidden.
  // Same record-before-creation contract as setBaseMapVisible.
  setBaseMapImageVisible(baseMapId, visible) {
    this.imageVisibleByBaseMapId[baseMapId] = visible;
    // Base maps grid open: the manager drives the image of its sheets
    // (BaseMapsGridManager.setImageOnById); the recorded state is restored
    // when the sheet is released.
    if (this.sceneManager.baseMapsGridManager?.isSheet(baseMapId)) return;
    const group = this.imagesMap[baseMapId];
    const meshWrap = group?.userData?.meshWrap;
    if (meshWrap) meshWrap.visible = visible;
  }

  // Toggle only the scan mesh (the scanWrap child) of a scan base map. The
  // caller (useApplyBaseMapVisibilityIn3d) folds the image eye into the
  // value: the scan is part of the base map "image", plus its own opt-out.
  // Same record-before-creation contract — syncScene3d applies it when the
  // scanWrap gets (re)attached.
  setBaseMapScanVisible(baseMapId, visible) {
    this.scanVisibleByBaseMapId[baseMapId] = visible;
    const scanWrap = this.imagesMap[baseMapId]?.userData?.scanWrap;
    if (scanWrap) scanWrap.visible = visible;
  }

  // Batch apply — one call per visibility pass. Records every desired state
  // (including for basemaps not created yet) and applies them to the groups
  // already in the scene.
  setBaseMapVisibilities({
    groupVisibleById = {},
    imageVisibleById = {},
    scanVisibleById = {},
  }) {
    Object.entries(groupVisibleById).forEach(([id, visible]) =>
      this.setBaseMapVisible(id, visible)
    );
    Object.entries(imageVisibleById).forEach(([id, visible]) =>
      this.setBaseMapImageVisible(id, visible)
    );
    Object.entries(scanVisibleById).forEach(([id, visible]) =>
      this.setBaseMapScanVisible(id, visible)
    );
    // The carrier of a shared scan is the first VISIBLE base map.
    this.syncLocalScans();
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
  // change) from the pixel-space placement stashed on the group — no image
  // re-resolve needed, so it works with raw db records too. The mesh,
  // material/texture and the group transform are untouched. The new scale is
  // recorded even when the mesh isn't attached yet: attachBaseMapMesh reads
  // it when the texture finally lands.
  updateBaseMapGeometry(baseMapId, { meterByPx }) {
    const group = this.imagesMap[baseMapId];
    if (!group || !Number.isFinite(meterByPx) || meterByPx <= 0) return;
    group.userData.meterByPx = meterByPx;
    const planePx = group.userData.planePx;
    if (!planePx) return;
    group.traverse?.((child) => {
      if (child.userData?.isBasemap) {
        child.geometry?.dispose?.();
        child.geometry = buildBaseMapPlaneGeometry({ ...planePx, meterByPx });
      }
    });
  }

  // Same as updateBaseMapGeometry, but also accepts a missing / invalid scale
  // (0-sized plane, as built for a base map created without a scale). Used
  // by the 3D base maps grid, which lends a scale to the scale-less sheets
  // while they lie on the table and gives the real one back afterwards.
  setBaseMapPlaneScale(baseMapId, meterByPx) {
    const group = this.imagesMap[baseMapId];
    if (!group) return;
    group.userData.meterByPx = meterByPx;
    const planePx = group.userData.planePx;
    if (!planePx) return;
    group.traverse?.((child) => {
      if (child.userData?.isBasemap) {
        child.geometry?.dispose?.();
        child.geometry = buildBaseMapPlaneGeometry({ ...planePx, meterByPx });
      }
    });
  }

  deleteAllImagesObjects() {
    try {
      console.log("[ImagesManager] deleteAllImagesObjects");
      // The grid decorations are children of the groups dropped below.
      this.sceneManager.baseMapsGridManager?.onGroupsDeleted();
      this.fadedBaseMapIds.clear();
      this.releasePreviewTextures();
      Object.values(this.imagesMap).forEach((group) => {
        // The group can carry annotations as siblings of the mesh wrapper;
        // dispose only the basemap's own mesh resources, not the
        // annotations' (AnnotationsManager owns those). Walk into the
        // meshWrap to find the basemap mesh.
        group.userData.disposeScene3d?.();
        group.userData.localScan?.dispose();
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
