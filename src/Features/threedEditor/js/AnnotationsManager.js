import { Vector2 } from "three";

import createAnnotationObject3D from "./utilsAnnotationsManager/createAnnotationObject3D";
import createPhotoPlanObject3D from "./utilsAnnotationsManager/createPhotoPlanObject3D";
import diffAnnotationsForBuild, {
  getBuildEpochKey,
} from "./utilsAnnotationsManager/diffAnnotationsForBuild";
import createMeshCellLabelSprite from "./utilsAnnotationsManager/createMeshCellLabelSprite";
import subtractAnnotationGeometries from "./utilsAnnotationsManager/subtractAnnotationGeometries";
import buildAnnotationSolidObjectsAsync from "./utilsAnnotationsManager/buildAnnotationSolidObjectsAsync";
import buildResolvedSourceObjectAsync from "./utilsAnnotationsManager/buildResolvedSourceObjectAsync";
import getSolidMeshFromObject3D from "./utilsAnnotationsManager/getSolidMeshFromObject3D";

import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import applyWorldBoxUVs from "Features/photorealRender/utils/applyWorldBoxUVs";
import ensureMaterial3dMaps from "Features/photorealRender/utils/ensureMaterial3dMaps";
import { applySketchEdges } from "./postfx/aquarelleMaterials";

export default class AnnotationsManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.annotationsObjectsMap = {};
    this._annotationReadyCallbacks = new Set();
    // Build provenance for the incremental diff: id -> { sourceRef (the
    // resolved annotation the object was built from — reference-stable across
    // runs thanks to stabilizeAnnotationsIdentity), epochKey (build options),
    // baseMapKey (registry metrics the geometry was projected with) }.
    this._buildStateById = new Map();
  }

  // Key of the basemap metrics an annotation was built against. The resolved
  // annotation identity does not cover the registry entry (orientation, a
  // late-set meterByPx), so it is tracked separately. Mirrors the
  // baseMapForRender fields computed in _createAnnotationsObjectsCore.
  _getAnnotationBaseMapKey(annotation) {
    // Photo-plan reconstructions have no baseMap group: the build frame is
    // the photoPlan's world pose (a recalibration also changes _photoPlan3D,
    // hence the annotation identity — this key is belt and braces).
    if (annotation._photoPlan3D?.pose) {
      const { origin, uDir } = annotation._photoPlan3D.pose;
      return ["photoPlan", origin.x, origin.y, origin.z, uDir.x, uDir.z].join(
        ":"
      );
    }
    const baseMap =
      this.sceneManager.imagesManager.baseMapsMap[annotation.baseMapId];
    if (!baseMap) return null;
    const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
    return [
      refSize?.width || 1,
      refSize?.height || 1,
      baseMap.meterByPx || 0.01,
      baseMap.orientation || "",
    ].join(":");
  }

  // Split an incoming emission into { toCreate, toRemove } against the built
  // scene — unchanged annotations keep their existing Object3D untouched.
  diffAnnotations(annotations, options) {
    return diffAnnotationsForBuild({
      annotations,
      buildStateById: this._buildStateById,
      epochKey: getBuildEpochKey(options),
      getBaseMapKey: (a) => this._getAnnotationBaseMapKey(a),
    });
  }

  // Subscribe to "annotation ready" notifications. The callback receives the
  // ready ids as an ARRAY: the whole batch for a bulk createAnnotationsObjects
  // pass, a single id for async completions (GLB load, CSG carve) — so
  // full-scene subscribers (clipping reapply, full renders) pay once per load
  // instead of once per annotation. Returns an unsubscribe function.
  subscribeAnnotationReady(callback) {
    this._annotationReadyCallbacks.add(callback);
    return () => this._annotationReadyCallbacks.delete(callback);
  }

  _notifyAnnotationReady(id) {
    // Inside a bulk create, buffer: createAnnotationsObjects flushes once
    // with every created id after the loop.
    if (this._bulkReadyIds) {
      this._bulkReadyIds.add(id);
      return;
    }
    this._notifyAnnotationsReady([id]);
  }

  _notifyAnnotationsReady(ids) {
    this._annotationReadyCallbacks.forEach((cb) => {
      try {
        cb(ids);
      } catch (e) {
        console.error(
          "[AnnotationsManager] annotation-ready listener threw",
          e
        );
      }
    });
  }

  createAnnotationsObjects(annotations, options) {
    if (!annotations) return;
    // Buffer the per-annotation ready notifications for the whole pass —
    // subscribers doing full-scene work must run once per load, not once per
    // annotation (O(N²) wall clock at hundreds of shapes). Async completions
    // (GLB, carve) land after this returns and flow through the single-id
    // path. finally: a throw mid-loop must not leave the buffer armed.
    const isOuterBulk = !this._bulkReadyIds;
    if (isOuterBulk) this._bulkReadyIds = new Set();
    try {
      this._createAnnotationsObjectsCore(annotations, options);
    } finally {
      if (isOuterBulk) {
        const ids = [...this._bulkReadyIds];
        this._bulkReadyIds = null;
        if (ids.length) this._notifyAnnotationsReady(ids);
      }
    }
  }

  _createAnnotationsObjectsCore(annotations, options) {
    const epochKey = getBuildEpochKey(options);

    // Canvas pixel size, needed by screen-space fat lines (LineMaterial) such as
    // the POINT vertical "trait". Captured at build time, mirroring
    // DrawingOverlayThreed.getCanvasResolution.
    const dom = this.sceneManager.renderer?.domElement;
    const resolution = dom
      ? new Vector2(dom.clientWidth, dom.clientHeight)
      : new Vector2(1, 1);

    // Per-root finishing pass for the realistic render modes. Grid / gizmos /
    // lines / hover overlays never get the flags. Re-run on async loads (GLB /
    // profile sweeps) and after a CSG carve so late children / swapped
    // geometry are covered too.
    // - castShadow: REALISTIC + PHOTOREAL (only PHOTOREAL enables the shadow
    //   map, so it stays inert in REALISTIC).
    // - receiveShadow: PHOTOREAL only — annotation-on-annotation shadows are
    //   a large part of the archviz look (the basemap keeps its ShadowMaterial
    //   catcher, see RenderModeManager).
    // - world-box UVs: meshes whose material3d preset is textured (the flag is
    //   set synchronously at material creation); the carve strips the uv
    //   attribute, so the post-carve call re-projects it.
    const applyShadowFlags = (root) => {
      if (!options?.realisticShading || !root) return;
      root.traverse?.((child) => {
        if (!child.isMesh || child.userData?.isHoverOverlay) return;
        child.castShadow = true;
        if (options?.photorealShading) child.receiveShadow = true;
        if (child.material?.userData?.material3dNeedsBoxUvs) {
          applyWorldBoxUVs(child);
          // Covers material clones created before the async textures landed
          // (e.g. the ramp-surface clone) — no-op once maps are attached.
          ensureMaterial3dMaps(child.material, () =>
            this.sceneManager.renderScene()
          );
        }
      });
    };

    // AQUARELLE ink edges follow the same per-root finishing lifecycle as the
    // shadow flags: rebuilt from the CURRENT geometry on async loads and
    // after a CSG carve, so the lines always match the displayed mesh.
    const finishRoot = (root) => {
      applyShadowFlags(root);
      if (options?.aquarelleShading) applySketchEdges(root, { resolution });
    };

    annotations.forEach((annotation) => {
      // Photo-baseMap annotations attached to a calibrated photoPlan: built
      // in the plane's own world frame (posed wrapper Group) and added to
      // the scene root — photo baseMaps have no group in the scene, so the
      // generic path below would (rightly) bail on them.
      if (annotation._photoPlan3D) {
        const object = createPhotoPlanObject3D(annotation, {
          ...options,
          resolution,
        });
        if (!object) return;
        finishRoot(object);
        this.annotationsObjectsMap[annotation.id] = object;
        this._buildStateById.set(annotation.id, {
          sourceRef: annotation,
          epochKey,
          baseMapKey: this._getAnnotationBaseMapKey(annotation),
        });
        object.userData.baseMapId = annotation.baseMapId;
        object.userData.soloDimmed = Boolean(annotation._soloDimmed);
        this.scene.add(object);
        this._notifyAnnotationReady(annotation.id);
        return;
      }

      const baseMap =
        this.sceneManager.imagesManager.baseMapsMap[annotation.baseMapId];
      if (!baseMap) return;

      // Position/rotation are now carried by the parent basemap Group, so we
      // only need the metrics required to project pixel coords into the
      // basemap-local meter frame. Annotation pixel coords are resolved in
      // the REFERENCE frame (BaseMap.getImageSize = refWidth/refHeight for
      // versioned maps), NOT the active version's image size — using the
      // version size here would shift every annotation when the active
      // version's pixel size differs from the original image.
      const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
      const baseMapForRender = {
        imageWidth: refSize?.width || 1,
        imageHeight: refSize?.height || 1,
        meterByPx: baseMap.meterByPx || 0.01,
        // Needed by REVOLUTION: the revolution axis is the base map normal,
        // which is local +Z for HORIZONTAL and +Y for VERTICAL base maps.
        orientation: baseMap.orientation,
      };

      const object = createAnnotationObject3D(annotation, baseMapForRender, {
        ...options,
        resolution,
        onAsyncLoaded: () => {
          // Late-arriving children (GLB scene, async profile sweep) — the map
          // holds the current root (it may have been swapped by a carve).
          // Coalesced render: many GLBs resolving in one frame = one draw.
          finishRoot(this.annotationsObjectsMap[annotation.id]);
          this.sceneManager.requestRender();
          this._notifyAnnotationReady(annotation.id);
        },
      });
      if (!object) return;
      finishRoot(object);

      // Mesh cells carry an in-scene card (name + surface). Only cells reach
      // this builder when "Afficher les mailles" is on, so keying off
      // `isMeshCell` is enough — no extra toggle. Attached as a child of the
      // cell object so it inherits the basemap group transform and is freed by
      // the cleanup traverse in deleteAllAnnotationsObjects (texture disposed
      // via the sprite's userData.dispose hook).
      if (annotation.isMeshCell) {
        const label = createMeshCellLabelSprite(annotation, baseMapForRender);
        if (label) object.add(label);
      }

      // 3D subtraction: carve the source mesh with each target's derived solid.
      // Targets come from `subtractionTargets` (resolved annotations attached by
      // useAnnotationsV2 BEFORE the hidden-filter), so a subtraction is kept even
      // when the target's template is hidden. Target objects are attached to the
      // SAME basemap group as the source so both share a world frame, then
      // removed after the carve (they keep rendering as their own annotations
      // only when visible). EXTRUSION_PROFILE solids resolve asynchronously.
      // Glued openings (relAnnotationOpenings, resolved by useAnnotationsV2 as
      // `annotation.openings` BEFORE the hidden filter) pierce the host mesh
      // too: each opening becomes a band solid — width along the wall ×
      // strokeWidth thickness × opening height — subtracted like a regular
      // target, even when the opening's template is hidden in 2D.
      const openingSolids = (annotation.openings || [])
        .filter((o) => o?.points?.length === 2 && Number(o.height) > 0)
        .map((o) => ({
          id: `opening-solid-${o.id}`,
          type: "POLYLINE",
          points: o.points,
          // Slightly thicker than the stored band so the boolean fully
          // pierces the wall instead of leaving coplanar CSG faces.
          strokeWidth: (Number(o.strokeWidth) || 20) * 1.2,
          strokeWidthUnit: o.strokeWidthUnit ?? "CM",
          height: o.height,
          // Opening base at its own allège height when set (same absolute
          // Z frame as the rendered opening band), else at the host's base.
          offsetZ: o.offsetZ ?? annotation.offsetZ ?? 0,
          baseMapId: annotation.baseMapId,
        }));

      const subtractionTargets = [
        ...(annotation.subtractionTargets || []),
        ...openingSolids,
      ];
      if (subtractionTargets.length > 0) {
        (async () => {
          try {
            const targetObjects = (
              await Promise.all(
                subtractionTargets.map((targetAnnotation) =>
                  buildAnnotationSolidObjectsAsync(
                    targetAnnotation,
                    baseMapForRender,
                    options
                  )
                )
              )
            )
              .flat()
              .filter(Boolean);
            if (targetObjects.length === 0) return;
            // Skip if the source object was meanwhile replaced/removed.
            if (this.annotationsObjectsMap[annotation.id] !== object) return;

            // The source mesh may resolve asynchronously (EXTRUSION_PROFILE
            // renders an async swept surface). When the synchronously-added
            // object has no solid mesh yet, build a fully-resolved display
            // object and swap it in before carving — so the boolean cuts
            // openings into the resolved surface.
            let carveTarget = object;
            if (!getSolidMeshFromObject3D(object)) {
              const resolved = await buildResolvedSourceObjectAsync(
                annotation,
                baseMapForRender,
                options
              );
              if (!resolved || !getSolidMeshFromObject3D(resolved)) return;
              if (this.annotationsObjectsMap[annotation.id] !== object) return;
              resolved.userData = {
                ...(resolved.userData ?? {}),
                nodeId: annotation.id,
                nodeType: "ANNOTATION",
                annotationType: annotation.type,
                listingId: annotation.listingId,
                annotationTemplateId: annotation.annotationTemplateId,
              };
              const parent = object.parent;
              object.traverse?.((child) => {
                try {
                  child.userData?.dispose?.();
                } catch (e) {
                  /* ignore */
                }
              });
              object.parent?.remove(object);
              object.traverse?.((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
              });
              (parent ?? this.scene).add(resolved);
              this.annotationsObjectsMap[annotation.id] = resolved;
              carveTarget = resolved;
            }

            // Attach the target solids to the same parent as the source so their
            // matrixWorld matches the source's frame, then carve, then remove.
            const parent = carveTarget.parent ?? this.scene;
            targetObjects.forEach((o) => parent.add(o));
            parent.updateMatrixWorld(true);

            // Open-surface sources (swept EXTRUSION_PROFILE) must use a hollow
            // subtraction so the boolean only clips the surface and doesn't add
            // the target's cap faces (stray triangles in the source material).
            const hollow =
              getShape3DKey(annotation.shape3D) === "EXTRUSION_PROFILE";
            subtractAnnotationGeometries(carveTarget, targetObjects, {
              hollow,
            });

            targetObjects.forEach((o) => {
              o.parent?.remove(o);
              o.traverse?.((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
              });
            });

            // The carve may have swapped in a freshly-built source object.
            finishRoot(this.annotationsObjectsMap[annotation.id]);
            this.sceneManager.requestRender();
            this._notifyAnnotationReady(annotation.id);
          } catch (e) {
            console.error("[AnnotationsManager] subtraction carve failed", e);
          }
        })();
      }

      this.annotationsObjectsMap[annotation.id] = object;
      // Build provenance consumed by diffAnnotations — the async carve may
      // later swap the object in the map, but it derives from the same
      // resolved annotation, so the provenance stays valid.
      this._buildStateById.set(annotation.id, {
        sourceRef: annotation,
        epochKey,
        baseMapKey: this._getAnnotationBaseMapKey(annotation),
      });
      // Remember the owning basemap so the display controller can tell main vs
      // other-basemap annotations apart (per-basemap NORMAL/DIMMED rendering).
      if (object) {
        if (!object.userData) object.userData = {};
        object.userData.baseMapId = annotation.baseMapId;
        // Solo mode (3D): non-soloed annotations are tagged by useAnnotationsV2
        // so ThreedSelectionDimmer renders them translucent.
        object.userData.soloDimmed = Boolean(annotation._soloDimmed);
      }
      // Attach to the basemap's group so transforms applied to the basemap
      // (translate/rotate from the BASEMAP_POSITION editor mode) propagate to
      // the annotations for free.
      const group = this.sceneManager.imagesManager.getGroup(
        annotation.baseMapId
      );
      (group ?? this.scene).add(object);
      this._notifyAnnotationReady(annotation.id);
    });
  }

  _disposeAnnotationObject(object) {
    if (!object) return;
    // Custom cleanup hook (e.g. EXTRUSION_PROFILE Dexie liveQuery
    // subscriptions). Run BEFORE GPU-resource disposal so the callback can
    // still touch the object if needed.
    object.traverse?.((child) => {
      try {
        child.userData?.dispose?.();
      } catch (e) {
        console.error("[AnnotationsManager] dispose hook threw", e);
      }
    });
    // The parent is the basemap group when it exists, the scene otherwise.
    object.parent?.remove(object);
    object.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  deleteAnnotationsObjects(ids) {
    ids.forEach((id) => {
      this._disposeAnnotationObject(this.annotationsObjectsMap[id]);
      delete this.annotationsObjectsMap[id];
      this._buildStateById.delete(id);
    });
  }

  deleteAllAnnotationsObjects() {
    this.deleteAnnotationsObjects(Object.keys(this.annotationsObjectsMap));
    this._buildStateById.clear();
  }
}
