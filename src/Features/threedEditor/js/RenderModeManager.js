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

import buildWhiteEnvironment from "Features/photorealRender/utils/environment";
import loadHdrEnvironmentAsync, {
  disposeCachedHdrEnvironments,
} from "Features/photorealRender/services/loadHdrEnvironmentAsync";

// Viewport render modes. STANDARD is the historical unlit/Lambert look;
// REALISTIC upgrades the SAME raster pipeline to PBR + environment lighting +
// ACES (no cast shadows); PHOTOREAL is the full raster "archviz" state: an
// environment (see PHOTOREAL_ENVIRONMENTS) as IBL, a key light with cast
// shadows, and textured PBR materials (see material3dPresets).
export const RENDER_MODE_STANDARD = "STANDARD";
export const RENDER_MODE_REALISTIC = "REALISTIC";
export const RENDER_MODE_PHOTOREAL = "PHOTOREAL";

// PHOTOREAL environments (threedEditorSlice.environment3d).
export const ENVIRONMENT3D_STANDARD = "STANDARD";
export const ENVIRONMENT3D_EXTERIOR = "EXTERIOR";
export const ENVIRONMENT3D_INTERIOR = "INTERIOR";

// Light intensities. STANDARD restores the values from SceneManager's
// _add*Light. REALISTIC aims for an archviz "lit from above" look: a strong
// ambient + hemisphere fill (tops brightest, vertical faces only slightly
// darker — never black) and a SOFT near-vertical key light whose only real
// job is the subtle ground shadow. Tuned by eye under ACES tone mapping.
const STANDARD_LIGHTS = { ambient: 0.65, hemisphere: 0.9, directional: 0.6 };
const REALISTIC_LIGHTS = { ambient: 0.45, hemisphere: 0.7, directional: 0.9 };
const ENV_INTENSITY_RASTER = 0.3;
const TONE_MAPPING_EXPOSURE = 1.0;

// Moderately LATERAL key light: two walls meeting at 90° receive a different
// illumination, so the shared edge stays readable (a near-vertical key made
// every vertical face equal → invisible corners).
const KEY_LIGHT_DIRECTION = new Vector3(6, 9, 3.5).normalize();

// PHOTOREAL lighting — grouped here for visual tuning. The environment
// carries most of the fill (ambient/hemisphere drop to a small floor), the
// key light carries the shadows. Each environment tunes its own key light:
// - STANDARD: neutral studio (white gradient env, no background) — clean
//   archviz look without any sky.
// - EXTERIOR: HDR sky as IBL + background, warm sun roughly matching the sun
//   baked in the HDR (elevation ≈ 48°).
// - INTERIOR: indoor HDR (warehouse) as IBL, no background — for scenes like
//   parking levels where a sky would be wrong; near-vertical white key reads
//   as ceiling lighting.
const PHOTOREAL_FILL_LIGHTS = { ambient: 0.15, hemisphere: 0.25 };
const HDR_BASE_URL = `${import.meta.env.BASE_URL}photoreal/env`;
const PHOTOREAL_ENVIRONMENTS = {
  [ENVIRONMENT3D_STANDARD]: {
    hdrUrl: null,
    showBackground: false,
    envIntensity: 1.0,
    sunColor: 0xffffff,
    sunIntensity: 2.0,
    sunDirection: new Vector3(6, 8, 4).normalize(),
  },
  [ENVIRONMENT3D_EXTERIOR]: {
    hdrUrl: `${HDR_BASE_URL}/sky_1k.hdr`,
    showBackground: true,
    envIntensity: 1.0,
    sunColor: 0xfff1e0,
    sunIntensity: 2.5,
    sunDirection: new Vector3(6, 8, 4).normalize(),
  },
  [ENVIRONMENT3D_INTERIOR]: {
    hdrUrl: `${HDR_BASE_URL}/interior_1k.hdr`,
    showBackground: false,
    envIntensity: 1.0,
    sunColor: 0xffffff,
    sunIntensity: 1.2,
    sunDirection: new Vector3(1.5, 8, 1).normalize(),
  },
};

const SHADOW_MAP_SIZE = 2048;
const SHADOW_CATCHER_OPACITY = 0.15;

export default class RenderModeManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.mode = RENDER_MODE_STANDARD;
    this.envKey = ENVIRONMENT3D_EXTERIOR;

    this._env = null;
    this._hdrTextures = {}; // url → resolved texture (avoids a fallback frame)
    this._lightTarget = null;
    this._shadowCatchers = [];
    this._savedBackground = null;
    this._appliedBackground = null;
  }

  ///////////   PUBLIC   ///////////

  setMode = (mode) => {
    if (mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    if (prev === RENDER_MODE_PHOTOREAL) this._restoreBackground();
    if (mode === RENDER_MODE_PHOTOREAL) {
      this._applyPhotorealRenderer();
    } else if (mode === RENDER_MODE_REALISTIC) {
      this._applyRealisticRenderer();
    } else {
      this._applyStandardRenderer();
    }
    this.sceneManager.renderScene();
  };

  // PHOTOREAL environment (Standard / Extérieur / Intérieur). Stored even
  // outside PHOTOREAL so entering the mode later picks it up.
  setEnvironment = (envKey) => {
    if (envKey === this.envKey) return;
    this.envKey = envKey;
    if (this.mode !== RENDER_MODE_PHOTOREAL) return;
    this._applyPhotorealRenderer();
    this.sceneManager.renderScene();
  };

  // Called by ThreedEditor after basemaps / annotations are (re)loaded, next
  // to clippingManager.reapply(): refit the shadow frustum + shadow catchers
  // to the new scene extent.
  onSceneStructureChanged = () => {
    if (!this._shadowsEnabled()) return;
    this._fitDirectionalShadow();
    this._addShadowCatchers();
  };

  dispose = () => {
    this._removeShadowCatchers();
    if (this._env) {
      this._env.dispose();
      this._env = null;
    }
    this._hdrTextures = {};
    disposeCachedHdrEnvironments();
  };

  ///////////   RENDERER STATES   ///////////

  _shadowsEnabled() {
    return this.mode === RENDER_MODE_PHOTOREAL;
  }

  _envConfig() {
    return (
      PHOTOREAL_ENVIRONMENTS[this.envKey] ??
      PHOTOREAL_ENVIRONMENTS[ENVIRONMENT3D_EXTERIOR]
    );
  }

  _sunDirection() {
    return this.mode === RENDER_MODE_PHOTOREAL
      ? this._envConfig().sunDirection
      : KEY_LIGHT_DIRECTION;
  }

  _applyRealisticRenderer() {
    const { renderer, scene, ambiantLight, hemisphereLight, directionalLight } =
      this.sceneManager;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    renderer.shadowMap.enabled = false;

    if (!this._env) this._env = buildWhiteEnvironment();
    scene.environment = this._env;
    scene.environmentIntensity = ENV_INTENSITY_RASTER;

    ambiantLight.intensity = REALISTIC_LIGHTS.ambient;
    hemisphereLight.intensity = REALISTIC_LIGHTS.hemisphere;
    directionalLight.intensity = REALISTIC_LIGHTS.directional;
    directionalLight.color.set(0xffffff);
    directionalLight.castShadow = false;
    // Key light direction (a DirectionalLight only uses position → target;
    // the default target sits at the origin).
    directionalLight.position.copy(KEY_LIGHT_DIRECTION).multiplyScalar(20);
    if (this._lightTarget) this._lightTarget.position.set(0, 0, 0);

    this._removeShadowCatchers();
    this._forceMaterialsRecompile();
  }

  // The sponza-like raster state: ACES + environment IBL + key light with
  // cast shadows. The environment (studio / HDR sky / HDR interior) comes
  // from this.envKey — see PHOTOREAL_ENVIRONMENTS.
  _applyPhotorealRenderer() {
    const { renderer, ambiantLight, hemisphereLight, directionalLight } =
      this.sceneManager;
    const cfg = this._envConfig();

    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

    this._applyPhotorealEnvironment(cfg);

    ambiantLight.intensity = PHOTOREAL_FILL_LIGHTS.ambient;
    hemisphereLight.intensity = PHOTOREAL_FILL_LIGHTS.hemisphere;
    directionalLight.intensity = cfg.sunIntensity;
    directionalLight.color.set(cfg.sunColor);
    directionalLight.position.copy(cfg.sunDirection).multiplyScalar(20);
    if (this._lightTarget) this._lightTarget.position.set(0, 0, 0);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.02;
    this._fitDirectionalShadow();
    this._addShadowCatchers();

    this._forceMaterialsRecompile();
  }

  // Environment + background for the current PHOTOREAL env config. HDRs load
  // async — the white gradient fills in until the texture lands so the first
  // frame is never black.
  _applyPhotorealEnvironment(cfg) {
    const { scene } = this.sceneManager;

    if (!cfg.hdrUrl) {
      if (!this._env) this._env = buildWhiteEnvironment();
      scene.environment = this._env;
      scene.environmentIntensity = cfg.envIntensity;
      this._restoreBackground();
      return;
    }

    const cached = this._hdrTextures[cfg.hdrUrl];
    if (cached) {
      this._applyHdrEnvironment(cached, cfg);
      return;
    }

    if (!this._env) this._env = buildWhiteEnvironment();
    scene.environment = this._env;
    scene.environmentIntensity = ENV_INTENSITY_RASTER;
    this._restoreBackground();
    const requestedEnvKey = this.envKey;
    loadHdrEnvironmentAsync(cfg.hdrUrl)
      .then((texture) => {
        this._hdrTextures[cfg.hdrUrl] = texture;
        // Stale if the user left PHOTOREAL or switched environment meanwhile.
        if (this.mode !== RENDER_MODE_PHOTOREAL) return;
        if (this.envKey !== requestedEnvKey) return;
        this._applyHdrEnvironment(texture, cfg);
        this.sceneManager.renderScene();
      })
      .catch((e) => {
        // Offline / missing asset: PHOTOREAL keeps the white-gradient IBL.
        console.error("[RenderModeManager] HDR environment failed", e);
      });
  }

  _applyHdrEnvironment(texture, cfg) {
    const { scene } = this.sceneManager;
    scene.environment = texture;
    scene.environmentIntensity = cfg.envIntensity;
    if (!cfg.showBackground) {
      this._restoreBackground();
      return;
    }
    if (scene.background !== texture) {
      // Save the pre-PHOTOREAL background only once (an env switch would
      // otherwise capture our own HDR as the value to restore).
      if (this._appliedBackground === null) {
        this._savedBackground = scene.background;
      }
      scene.background = texture;
      this._appliedBackground = texture;
    }
  }

  _restoreBackground() {
    const { scene } = this.sceneManager;
    if (this._appliedBackground === null) return;
    if (scene.background === this._appliedBackground) {
      scene.background = this._savedBackground ?? null;
    }
    this._savedBackground = null;
    this._appliedBackground = null;
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
    directionalLight.color.set(0xffffff);
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
      .addScaledVector(this._sunDirection(), 2 * r);

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
    if (!this._shadowsEnabled()) return;
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
}
