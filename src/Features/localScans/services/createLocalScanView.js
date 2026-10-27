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
import readLocalScanInWorker from "./readLocalScanInWorker";

// One independently owned scene root. Never enters the existing annotation,
// mesh picking, clipping or export registries. The host renderer is unchanged.
export default function createLocalScanView(editor, data) {
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
  const points = new Points(geometry, material);
  points.raycast = () => false;
  root.add(points);
  manager.scene.add(root);
  let disposed = false;
  let splat = null;
  let spark = null;
  let loading = null;
  const decodeController = new AbortController();
  let mode = "POINTS";
  let placement = { up: "Z", scale: 1, origin: [0, 0, 0] };
  const requestRender = () => {
    if (!disposed) editor.requestRender();
  };

  function setPlacement(next) {
    placement = next;
    applyLocalScanPlacement(root, next);
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
    const { SplatMesh, SparkRenderer, PackedSplats } =
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
      editable: false,
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
    if (spark) spark.visible = mode === "SPLAT";
    requestRender();
  }
  setPlacement(placement);
  return {
    root,
    data,
    fit,
    setMode,
    setPlacement,
    setPointSize(size) {
      material.size = size;
      requestRender();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
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
}
