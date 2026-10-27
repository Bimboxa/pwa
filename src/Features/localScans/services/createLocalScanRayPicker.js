import { Matrix4, Raycaster, Vector2, Vector3 } from "three";
import { getLocalScanViews } from "./localScanViewRegistry";
import classifyScanPlaneNormal from "../utils/classifyScanPlaneNormal";

// Is the scan root displayed: attached to the scene, itself and every
// ancestor visible (a hidden base map group, chip off, tool eye off…).
function isDisplayed(root, scene) {
  for (let object = root; object; object = object.parent) {
    if (!object.visible) return false;
    if (object === scene) return true;
  }
  return false;
}

// Base map carrying the cloud (scan base map), for the cote host.
function getCarrierBaseMapId(root) {
  for (let object = root.parent; object; object = object.parent)
    if (object.userData?.kind === "baseMap")
      return object.userData.baseMapId ?? null;
  return null;
}

// Point clouds of the local scans (never raycast by the scene pickers)
// picked under a screen point, with the plane of the Scan 3D inspection
// (pickLocalScanPoint: nearest point within 6 px, RANSAC plane in a 1 m
// cube) snapped to horizontal / vertical when close. One worker per
// displayed cloud, created at its first pick and kept until dispose().
//
// pick(ndc) → Promise<{point, normal, orientation, distance, baseMapId} |
// null> (world space; normal null when no plane is supported). The ray is
// taken at call time, so the camera may move while the worker searches.
export default function createLocalScanRayPicker({ sceneManager }) {
  const workers = new Map(); // view → {worker, requests: Map(id → resolve)}
  let nextId = 0,
    disposed = false;

  function getWorker(view) {
    let entry = workers.get(view);
    if (entry) return entry;
    const worker = new Worker(
      new URL("../workers/pickLocalScan.worker.js", import.meta.url),
      { type: "module" }
    );
    entry = { worker, requests: new Map() };
    const settle = (id, value) => {
      entry.requests.get(id)?.(value);
      entry.requests.delete(id);
    };
    worker.onmessage = ({ data }) => settle(data.id, data.error ? null : data);
    worker.onerror = () => {
      entry.requests.forEach((resolve) => resolve(null));
      entry.requests.clear();
    };
    worker.postMessage({ type: "INIT", positions: view.data.positions });
    workers.set(view, entry);
    return entry;
  }

  function pickView(view, ndc) {
    const { camera, renderer } = sceneManager;
    const root = view.root;
    root.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const ray = raycaster.ray
      .clone()
      .applyMatrix4(root.matrixWorld.clone().invert());
    const matrix = new Matrix4()
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(root.matrixWorld);
    const world = root.matrixWorld.clone();
    const scale = world.getMaxScaleOnAxis();
    const canvas = renderer.domElement;
    const { worker, requests } = getWorker(view);
    const id = ++nextId;
    return new Promise((resolve) => {
      requests.set(id, (data) => {
        const result = data?.result;
        if (!result) return resolve(null);
        const point = new Vector3(...result.point).applyMatrix4(world);
        let normal = null,
          orientation = null;
        if (result.normal) {
          const fitted = new Vector3(...result.normal).transformDirection(
            world
          );
          const classified = classifyScanPlaneNormal(fitted.toArray());
          normal = new Vector3(...classified.normal);
          orientation = classified.orientation;
        }
        resolve({
          point,
          normal,
          orientation,
          distance: point.distanceTo(raycaster.ray.origin),
          baseMapId: getCarrierBaseMapId(root),
        });
      });
      worker.postMessage({
        id,
        type: "PICK",
        query: {
          matrix: matrix.elements,
          ndc: ndc.toArray(),
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          origin: ray.origin.toArray(),
          direction: ray.direction.toArray(),
          scale,
          slice: view.clipRange
            ? {
                ...view.clipRange,
                row: [1, 5, 9, 13].map((i) => world.elements[i]),
              }
            : null,
        },
      });
    });
  }

  return {
    // Whether a cloud could answer (lets callers skip the async path).
    hasDisplayedScans() {
      return getLocalScanViews().some((view) =>
        isDisplayed(view.root, sceneManager.scene)
      );
    },
    async pick(ndc = new Vector2(0, 0)) {
      if (disposed) return null;
      // Workers of clouds gone meanwhile (scan closed, base map unloaded).
      const live = new Set(getLocalScanViews());
      workers.forEach(({ worker, requests }, view) => {
        if (live.has(view)) return;
        requests.forEach((resolve) => resolve(null));
        worker.terminate();
        workers.delete(view);
      });
      const views = [...live].filter((view) =>
        isDisplayed(view.root, sceneManager.scene)
      );
      const hits = (
        await Promise.all(views.map((view) => pickView(view, ndc)))
      ).filter(Boolean);
      if (disposed || !hits.length) return null;
      return hits.reduce((best, hit) =>
        hit.distance < best.distance ? hit : best
      );
    },
    dispose() {
      disposed = true;
      workers.forEach(({ worker, requests }) => {
        requests.forEach((resolve) => resolve(null));
        worker.terminate();
      });
      workers.clear();
    },
  };
}
