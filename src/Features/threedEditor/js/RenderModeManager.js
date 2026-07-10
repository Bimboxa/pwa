import {
  ACESFilmicToneMapping,
  NoToneMapping,
  PCFSoftShadowMap,
  Box3,
  Vector3,
  Object3D,
  Mesh,
  ShadowMaterial,
} from "three";
import { WebGLPathTracer } from "three-gpu-pathtracer";

import buildWhiteEnvironment from "Features/photorealRender/utils/environment";
import {
  setVisibilityByPredicate,
  isBasemap,
} from "Features/photorealRender/utils/sceneVisibility";

// Viewport render modes. STANDARD is the historical unlit/Lambert look;
// REALISTIC upgrades the SAME raster pipeline to PBR + environment lighting +
// shadows + ACES; PHOTOREAL keeps the REALISTIC renderer state and adds
// progressive path tracing on top (raster fallback while the camera moves).
export const RENDER_MODE_STANDARD = "STANDARD";
export const RENDER_MODE_REALISTIC = "REALISTIC";
export const RENDER_MODE_PHOTOREAL = "PHOTOREAL";

// Light intensities. STANDARD restores the values from SceneManager's
// _add*Light. REALISTIC aims for an archviz "lit from above" look: a strong
// ambient + hemisphere fill (tops brightest, vertical faces only slightly
// darker — never black) and a SOFT near-vertical key light whose only real
// job is the subtle ground shadow. Tuned by eye under ACES tone mapping.
const STANDARD_LIGHTS = { ambient: 0.65, hemisphere: 0.9, directional: 0.6 };
const REALISTIC_LIGHTS = { ambient: 0.45, hemisphere: 1.0, directional: 0.65 };
// The white gradient environment serves two different purposes: in the raster
// REALISTIC mode it only adds a subtle PBR fill (ambient/hemisphere carry the
// lighting), while in PHOTOREAL (and the export) it IS the main light source
// of the path tracer — hence two intensities.
const ENV_INTENSITY_RASTER = 0.4;
const ENV_INTENSITY_TRACED = 1.5;
const TONE_MAPPING_EXPOSURE = 1.0;

// Near-vertical key light ("vue d'en haut"): short, discreet shadows and no
// hard-black side faces (the fill lights own the vertical surfaces).
const KEY_LIGHT_DIRECTION = new Vector3(2.5, 12, 1.8).normalize();
const SHADOW_MAP_SIZE = 2048;
const SHADOW_CATCHER_OPACITY = 0.2;

// Path tracing tuning. The tracer's own raster fallback covers camera
// interaction (rasterizeScene); samples accumulate while idle and stop at
// MAX_SAMPLES (the canvas keeps the last presented frame — zero GPU work).
// Scene mutations are debounced before the (synchronous, main-thread) BVH
// rebuild so a burst of edits triggers a single setScene.
const MAX_SAMPLES = 512;
const REBUILD_DEBOUNCE_MS = 400;
const TRACER_BOUNCES = 2;
const TRACER_TRANSMISSIVE_BOUNCES = 6;
const TRACER_MIN_SAMPLES = 3;
const TRACER_RENDER_DELAY_MS = 150;
const TRACER_FADE_DURATION_MS = 300;

export default class RenderModeManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.mode = RENDER_MODE_STANDARD;
    this.isPathTracing = false;

    this.tracer = null;
    this._env = null;
    this._lightTarget = null;
    this._shadowCatchers = [];
    this._savedPixelRatio = null;
    this._savedBackground = null;
    this._sceneDirty = false;
    this._sceneDirtyAt = 0;
    this._tracerFailed = false;
  }

  ///////////   PUBLIC   ///////////

  setMode = (mode) => {
    if (mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    if (mode === RENDER_MODE_PHOTOREAL) {
      this._applyRealisticRenderer();
      this._enterPathTracing();
    } else if (mode === RENDER_MODE_REALISTIC) {
      this._exitPathTracing(prev);
      this._applyRealisticRenderer();
    } else {
      this._exitPathTracing(prev);
      this._applyStandardRenderer();
    }
    this.sceneManager.renderScene();
  };

  // Called by ThreedEditor after basemaps / annotations are (re)loaded, next
  // to clippingManager.reapply(): refit the shadow frustum + shadow catchers
  // to the new scene extent. The tracer invalidation comes for free from the
  // renderScene() call that follows (see SceneManager.renderScene).
  onSceneStructureChanged = () => {
    if (this.mode === RENDER_MODE_STANDARD) return;
    this._fitDirectionalShadow();
    this._addShadowCatchers();
  };

  // Every explicit render request while path tracing means the scene changed
  // (camera moves never go through SceneManager.renderScene in PHOTOREAL —
  // ControlsManager handles them via onCameraChange).
  markSceneDirty = () => {
    this._sceneDirty = true;
    this._sceneDirtyAt = performance.now();
  };

  // Convenience for SceneManager.renderScene: invalidate only when the
  // tracer actually owns the canvas.
  markSceneDirtyIfPathTracing = () => {
    if (this.isPathTracing) this.markSceneDirty();
  };

  // Camera moved (orbit/pan/zoom) or resized: reset the sample accumulation.
  onCameraChange = () => {
    if (!this.isPathTracing || !this.tracer) return;
    if (this._sceneDirty) return; // setScene will re-sync the camera anyway
    this.tracer.updateCamera();
  };

  // One frame of the PHOTOREAL loop (called every rAF by ControlsManager).
  renderFrame = () => {
    const { renderer, scene, camera } = this.sceneManager;
    if (!this.tracer || this._tracerFailed) {
      renderer.render(scene, camera);
      return;
    }
    if (this._sceneDirty) {
      // Live raster view while the BVH is stale — the user sees edits
      // instantly, and the debounce coalesces edit bursts into one rebuild.
      renderer.render(scene, camera);
      if (performance.now() - this._sceneDirtyAt > REBUILD_DEBOUNCE_MS) {
        this._rebuildTracerScene();
      }
      return;
    }
    if (this.tracer.samples < MAX_SAMPLES) this.tracer.renderSample();
  };

  dispose = () => {
    this.isPathTracing = false;
    if (this.tracer) {
      // dispose() is fixed in three-gpu-pathtracer 0.0.24 (0.0.23 referenced
      // an undefined property and threw) — keep the guard for safety.
      try {
        this.tracer.dispose();
      } catch (e) {
        console.error("[RenderModeManager] tracer dispose failed", e);
      }
      this.tracer = null;
    }
    this._removeShadowCatchers();
    if (this._env) {
      this._env.dispose();
      this._env = null;
    }
  };

  ///////////   RENDERER STATE (REALISTIC)   ///////////

  _applyRealisticRenderer() {
    const { renderer, scene, ambiantLight, hemisphereLight, directionalLight } =
      this.sceneManager;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    if (!this._env) this._env = buildWhiteEnvironment();
    scene.environment = this._env;
    scene.environmentIntensity = ENV_INTENSITY_RASTER;

    ambiantLight.intensity = REALISTIC_LIGHTS.ambient;
    hemisphereLight.intensity = REALISTIC_LIGHTS.hemisphere;
    directionalLight.intensity = REALISTIC_LIGHTS.directional;
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.02;

    this._fitDirectionalShadow();
    this._addShadowCatchers();
    this._forceMaterialsRecompile();
  }

  _applyStandardRenderer() {
    const { renderer, scene, ambiantLight, hemisphereLight, directionalLight } =
      this.sceneManager;
    renderer.toneMapping = NoToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;

    scene.environment = null;
    scene.environmentIntensity = 1;

    ambiantLight.intensity = STANDARD_LIGHTS.ambient;
    hemisphereLight.intensity = STANDARD_LIGHTS.hemisphere;
    directionalLight.intensity = STANDARD_LIGHTS.directional;
    directionalLight.castShadow = false;
    // Restore the exact STANDARD light direction: position (8, 15, 6) aiming
    // at the origin (the fitted target may sit at the scene center).
    directionalLight.position.set(8, 15, 6);
    if (this._lightTarget) this._lightTarget.position.set(0, 0, 0);

    this._removeShadowCatchers();
    this._forceMaterialsRecompile();
  }

  // Changing renderer.toneMapping / shadowMap.enabled does NOT recompile
  // already-compiled programs — without this, toggling the mode silently does
  // nothing on materials that already rendered once.
  _forceMaterialsRecompile() {
    this.sceneManager.scene.traverse((child) => {
      const mat = child.material;
      if (!mat) return;
      if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
      else mat.needsUpdate = true;
    });
  }

  ///////////   SHADOWS   ///////////

  // Union of basemap groups + annotation objects (same union as
  // ClippingManager._computeSceneBox). null when the scene is empty.
  _computeSceneBox() {
    const box = new Box3();
    box.makeEmpty();
    let hasAny = false;

    const addRoot = (root) => {
      if (!root) return;
      const b = new Box3().setFromObject(root);
      if (!b.isEmpty() && isFinite(b.min.x)) {
        box.union(b);
        hasAny = true;
      }
    };

    const images = this.sceneManager.imagesManager?.imagesMap || {};
    Object.values(images).forEach(addRoot);
    const annotations =
      this.sceneManager.annotationsManager?.annotationsObjectsMap || {};
    Object.values(annotations).forEach(addRoot);

    return hasAny ? box : null;
  }

  // Size the directional light's ortho shadow frustum to the scene so the
  // 2048px shadow map covers exactly what's visible (no peter-panning from an
  // oversized frustum, no clipped shadows from an undersized one).
  _fitDirectionalShadow() {
    const { directionalLight, scene } = this.sceneManager;
    if (!directionalLight?.castShadow) return;
    const box = this._computeSceneBox();
    if (!box) return;

    const center = new Vector3();
    box.getCenter(center);
    const r = Math.max(box.getSize(new Vector3()).length() / 2, 1);

    if (!this._lightTarget) {
      this._lightTarget = new Object3D();
      scene.add(this._lightTarget);
    }
    this._lightTarget.position.copy(center);
    directionalLight.target = this._lightTarget;
    directionalLight.position
      .copy(center)
      .addScaledVector(KEY_LIGHT_DIRECTION, 2 * r);

    const cam = directionalLight.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = 4 * r;
    cam.updateProjectionMatrix();
    // Force the shadow map to re-render with the new frustum.
    directionalLight.shadow.needsUpdate = true;
  }

  // Basemap planes stay crisp unlit MeshBasicMaterial (which cannot receive
  // shadows) — overlay each with a coplanar ShadowMaterial "shadow catcher"
  // so annotations still cast onto the floorplan. Attached as a child of the
  // basemap mesh so it inherits the exact transform; disposal is covered by
  // the images cleanup traverse (per-catcher material, shared geometry).
  _addShadowCatchers() {
    this._removeShadowCatchers();
    if (this.mode === RENDER_MODE_STANDARD) return;
    this.sceneManager.scene.traverse((obj) => {
      if (!obj.isMesh || !obj.userData?.isBasemap) return;
      const catcher = new Mesh(
        obj.geometry,
        new ShadowMaterial({
          opacity: SHADOW_CATCHER_OPACITY,
          transparent: true,
          depthWrite: false,
        })
      );
      catcher.receiveShadow = true;
      catcher.renderOrder = (obj.renderOrder ?? 0) + 1;
      catcher.userData.isShadowCatcher = true;
      obj.add(catcher);
      this._shadowCatchers.push(catcher);
    });
  }

  _removeShadowCatchers() {
    this._shadowCatchers.forEach((catcher) => {
      catcher.parent?.remove(catcher);
      catcher.material.dispose(); // geometry is the basemap's — not ours
    });
    this._shadowCatchers = [];
  }

  ///////////   PATH TRACING (PHOTOREAL)   ///////////

  _enterPathTracing() {
    const { renderer, scene } = this.sceneManager;
    this._savedPixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);

    if (!this.tracer) {
      this.tracer = new WebGLPathTracer(renderer);
      this.tracer.bounces = TRACER_BOUNCES;
      this.tracer.transmissiveBounces = TRACER_TRANSMISSIVE_BOUNCES;
      this.tracer.tiles.set(2, 2);
      this.tracer.minSamples = TRACER_MIN_SAMPLES;
      this.tracer.renderDelay = TRACER_RENDER_DELAY_MS;
      this.tracer.fadeDuration = TRACER_FADE_DURATION_MS;
      // Built-in fallback: renderSample() rasterizes the full scene while the
      // traced layer hasn't converged / the camera is moving.
      this.tracer.rasterizeScene = true;
      this.tracer.renderToCanvas = true;
      this.tracer.renderToCanvasCallback = this._compositeToCanvas;
    }

    // Transparent traced background (backgroundAlpha = 0) so the composite
    // can raster the crisp basemap underneath — same recipe as the export.
    this._savedBackground = scene.background;
    scene.background = null;
    // The tracer ignores ambient/hemisphere fills: the environment carries
    // the lighting there (setMode restores the raster value on exit via
    // _applyRealisticRenderer / _applyStandardRenderer).
    scene.environmentIntensity = ENV_INTENSITY_TRACED;

    this._tracerFailed = false;
    this._sceneDirty = true;
    this._sceneDirtyAt = 0; // force an immediate first build in the loop
    this.isPathTracing = true;
  }

  _exitPathTracing(prevMode) {
    if (prevMode !== RENDER_MODE_PHOTOREAL) return;
    this.isPathTracing = false;
    this._sceneDirty = false;
    const { renderer, scene } = this.sceneManager;
    if (this._savedPixelRatio) renderer.setPixelRatio(this._savedPixelRatio);
    scene.background = this._savedBackground ?? null;
    // Keep the tracer instance for the session — rebuilding it is expensive
    // and re-entering PHOTOREAL is cheap this way. Freed in dispose().
  }

  // Rebuild the tracer's BVH from the current scene, tracing annotation
  // solids only: basemaps are composited as a raster underlay (crisp texture),
  // and helpers/gizmos/sprites/lines must not leak into the trace. Synchronous
  // (main-thread) build — the preceding raster frames keep the view live.
  _rebuildTracerScene() {
    const { scene, camera, annotationsManager } = this.sceneManager;
    const roots = new Set(
      Object.values(annotationsManager?.annotationsObjectsMap || {}).filter(
        Boolean
      )
    );
    const keep = (obj) => {
      if (!obj.isMesh) return false; // lines / sprites / points never trace
      if (obj.isLine2 || obj.isLineSegments2) return false; // fat lines extend Mesh
      if (obj.userData?.isHoverOverlay) return false;
      if (obj.userData?.isShadowCatcher) return false;
      let p = obj;
      while (p) {
        if (roots.has(p)) return true;
        p = p.parent;
      }
      return false;
    };
    const restore = setVisibilityByPredicate(scene, keep);
    try {
      this.tracer.setScene(scene, camera);
      this._sceneDirty = false;
    } catch (e) {
      console.error("[RenderModeManager] path tracer setScene failed", e);
      // Fall back to plain raster frames for the rest of the session.
      this._tracerFailed = true;
      this._sceneDirty = false;
    } finally {
      restore();
    }
  }

  // Replaces the tracer's default canvas blit. While the traced layer is
  // still fading in, renderSample() has just rastered the FULL scene under
  // it — keep the default blit so the crossfade reads seamlessly. Once fully
  // faded in, re-raster only the basemaps (crisp texture) and blit the traced
  // annotations on top (alpha where only the basemap shows).
  _compositeToCanvas = (target, renderer, quad) => {
    if (quad.material.opacity >= 1) {
      const { scene, camera } = this.sceneManager;
      const restore = setVisibilityByPredicate(scene, isBasemap);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
      restore();
    }
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    quad.render(renderer);
    renderer.autoClear = prevAutoClear;
  };
}
