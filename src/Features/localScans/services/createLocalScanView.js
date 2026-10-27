import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from "three";
import applyLocalScanPlacement from "../utils/applyLocalScanPlacement";
import { DEFAULT_LOCAL_SCAN_PLACEMENT } from "../constants/localScanPlacement";
import readLocalScanInWorker from "./readLocalScanInWorker";
import { registerLocalScanView } from "./localScanViewRegistry";

// One independently owned scene root. Never enters the existing annotation,
// mesh picking, clipping or export registries. The host renderer is unchanged.
// editor: {sceneManager, requestRender}. With `parent` (the wrap of a scan
// base map, which carries the pose) the root joins it untransformed instead
// of the scene: setPlacement is then left to the tool's own view.
export default function createLocalScanView(editor, data, { parent } = {}) {
  const manager = editor.sceneManager;
  const root = new Group();
  root.name = "Local scan";
  root.userData.isDecor = true;
  // Three.js honors false to stop recursive raycasting at this root.
  root.raycast = () => false;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
  geometry.setAttribute("color", new BufferAttribute(data.colors, 3, true));
  const material = new PointsMaterial({
    size: 2,
    sizeAttenuation: false,
    vertexColors: true,
    toneMapped: false,
  });
  const sliceUniforms = {
    scanSliceEnabled: { value: false },
    scanSliceLower: { value: 0 },
    scanSliceUpper: { value: 0 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sliceUniforms);
    shader.vertexShader = `uniform bool scanSliceEnabled; uniform float scanSliceLower; uniform float scanSliceUpper;
${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      float scanZ = (modelMatrix * vec4(position, 1.0)).y;
      if (scanSliceEnabled && (scanZ < scanSliceLower || scanZ > scanSliceUpper)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    `
    );
  };
  material.customProgramCacheKey = () => "local-scan-slice-v1";
  const points = new Points(geometry, material);
  points.raycast = () => false;
  points.userData.isDecor = true;
  root.add(points);
  (parent ?? manager.scene).add(root);
  let disposed = false;
  let clipRange = null,
    splatClipEdit = null,
    splatClipPlanes = null;
  let splat = null;
  let spark = null;
  let loading = null;
  const decodeController = new AbortController();
  let mode = "POINTS";
  let placement = DEFAULT_LOCAL_SCAN_PLACEMENT;
  const requestRender = () => {
    if (!disposed) editor.requestRender();
  };

  function setPlacement(next) {
    placement = next;
    applyLocalScanPlacement(root, next);
    requestRender();
  }
  function setSliceClip(range) {
    if (disposed) return;
    clipRange = range;
    sliceUniforms.scanSliceEnabled.value = Boolean(range);
    if (range) {
      sliceUniforms.scanSliceLower.value = range.lower;
      sliceUniforms.scanSliceUpper.value = range.upper;
    }
    if (splat && splatClipEdit) {
      if (range) {
        splatClipPlanes[0].position.y = range.lower;
        splatClipPlanes[1].position.y = range.upper;
        splatClipPlanes.forEach((plane) => plane.updateMatrixWorld(true));
      }
      splat.edits = range ? [splatClipEdit] : [];
      splat.needsUpdate = true;
    }
    requestRender();
  }
  function fit() {
    const box = new Box3(
      new Vector3(...data.bounds.min),
      new Vector3(...data.bounds.max)
    );
    root.updateMatrixWorld(true);
    box.applyMatrix4(root.matrixWorld);
    return manager.controlsManager.fitToBox3FromAngles({
      box,
      azimuthRad: Math.PI / 4,
      polarRad: Math.PI / 3,
    });
  }
  async function loadSplats(file) {
    // The engine and its workers are loaded only for a requested splat view.
    const { SplatMesh, SparkRenderer, PackedSplats, SplatEdit, SplatEditSdf } =
      await import("@sparkjsdev/spark");
    if (disposed) return;
    const packed = await readLocalScanInWorker(file, {
      signal: decodeController.signal,
      decodeSplats: true,
    });
    if (disposed) return;
    const candidate = new SplatMesh({
      packedSplats: new PackedSplats(packed),
      raycastable: false,
      editable: true,
    });
    try {
      await candidate.initialized;
      if (disposed) {
        candidate.dispose();
        return;
      }
      spark = new SparkRenderer({
        renderer: manager.renderer,
        onDirty: requestRender,
      });
      spark.raycast = () => false;
      spark.userData.isDecor = true;
      // Explicit renderer avoids Spark's implicit renderer creation/leaks.
      manager.scene.add(spark);
      splat = candidate;
      splatClipPlanes = [-Math.PI / 2, Math.PI / 2].map((rotation) => {
        const plane = new SplatEditSdf({ type: "plane", opacity: 0 });
        plane.rotation.x = rotation;
        return plane;
      });
      // Explicit per-mesh edits never affect other Spark models in the scene.
      splatClipEdit = new SplatEdit({ sdfs: splatClipPlanes });
      setSliceClip(clipRange);
      root.add(splat);
      splat.visible = mode === "SPLAT";
      points.visible = mode !== "SPLAT";
      requestRender();
    } catch (error) {
      candidate.dispose();
      throw error;
    }
  }
  async function setMode(next, file) {
    mode = next;
    if (next === "SPLAT" && !splat) {
      loading ??= loadSplats(file).finally(() => {
        loading = null;
      });
      await loading;
    }
    if (disposed) return;
    points.visible = mode === "POINTS" || !splat;
    if (splat) splat.visible = mode === "SPLAT";
    if (spark) spark.visible = root.visible && mode === "SPLAT";
    requestRender();
  }
  if (!parent) setPlacement(placement);
  let unregister = null;
  const view = {
    root,
    pointGeometry: geometry,
    setSliceClip,
    get clipRange() {
      return clipRange;
    },
    data,
    fit,
    setMode,
    setVisible(visible) {
      if (disposed) return;
      root.visible = visible;
      if (spark) spark.visible = visible && mode === "SPLAT";
      requestRender();
    },
    setPlacement,
    setPointSize(size) {
      material.size = size;
      requestRender();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unregister?.();
      decodeController.abort();
      root.removeFromParent();
      splat?.dispose();
      spark?.removeFromParent();
      spark?.dispose();
      geometry.dispose();
      material.dispose();
      root.clear();
      if (manager.renderer.domElement.isConnected) editor.requestRender();
    },
  };
  unregister = registerLocalScanView(view);
  return view;
}
