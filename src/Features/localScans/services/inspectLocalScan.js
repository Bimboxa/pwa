import { Matrix4, Raycaster, Vector2, Vector3 } from "three";
import createScanPlanePulse from "./createScanPlanePulse";

// A transparent input surface isolates inspection from drawing/selection.
// Camera-controls temporarily follows that surface, preserving normal drags.
export default function inspectLocalScan(editor, view, surface, onResult) {
  const { camera, renderer, controlsManager } = editor.sceneManager;
  const controls = controlsManager.cameraControls;
  const worker = new Worker(
    new URL("../workers/pickLocalScan.worker.js", import.meta.url),
    { type: "module" }
  );
  worker.postMessage({ type: "INIT", positions: view.data.positions });
  const raycaster = new Raycaster();
  let down = null;
  let multi = false;
  const pointers = new Set();
  let busy = false;
  let disposed = false;
  let requestMatrix = "";
  const matrices = () => {
    camera.updateMatrixWorld();
    view.root.updateMatrixWorld(true);
    return [
      ...camera.matrixWorld.elements,
      ...camera.projectionMatrix.elements,
      ...view.root.matrixWorld.elements,
      view.clipRange?.lower ?? "",
      view.clipRange?.upper ?? "",
    ].join(",");
  };
  let stopPulse = null;
  function clearEffect() {
    stopPulse?.();
    stopPulse = null;
  }
  function pulse(result) {
    clearEffect();
    view.root.updateMatrixWorld(true);
    stopPulse = createScanPlanePulse({
      parent: editor.sceneManager.scene,
      renderer: editor.sceneManager.renderer,
      requestRender: editor.requestRender,
      point: new Vector3(...result.point).applyMatrix4(view.root.matrixWorld),
      normal: result.normal
        ? new Vector3(...result.normal).transformDirection(
            view.root.matrixWorld
          )
        : null,
    });
  }
  worker.onmessage = ({ data }) => {
    if (disposed) return;
    busy = false;
    if (matrices() !== requestMatrix) {
      onResult(null, "La vue a bougé : cliquez à nouveau.");
      return;
    }
    if (data.error) {
      onResult(null, "Impossible de relever ce point.");
      return;
    }
    onResult(
      data.result,
      data.result ? null : "Aucun point du scan à cet endroit."
    );
    if (data.result) pulse(data.result);
  };
  worker.onerror = () => {
    busy = false;
    onResult(null, "Le calcul a échoué. Désactivez puis réactivez le relevé.");
  };
  const onDown = (event) => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      multi = true;
      down = null;
    }
    if (event.button !== 0 || !event.isPrimary || multi) return;
    down = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };
  const onMove = (event) => {
    if (
      down?.id === event.pointerId &&
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4
    )
      down.moved = true;
  };
  const onUp = (event) => {
    const start = down;
    pointers.delete(event.pointerId);
    if (!pointers.size) multi = false;
    down = null;
    if (
      !start ||
      start.id !== event.pointerId ||
      start.moved ||
      busy ||
      event.type === "pointercancel" ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
    )
      return;
    const rect = surface.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      return;
    const ndc = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2
    );
    requestMatrix = matrices();
    raycaster.setFromCamera(ndc, camera);
    const inverse = view.root.matrixWorld.clone().invert();
    const ray = raycaster.ray.clone().applyMatrix4(inverse);
    const matrix = new Matrix4()
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(view.root.matrixWorld);
    busy = true;
    clearEffect();
    onResult(null, "Recherche du point et du plan local…");
    worker.postMessage({
      type: "PICK",
      query: {
        matrix: matrix.elements,
        ndc: ndc.toArray(),
        width: rect.width,
        height: rect.height,
        origin: ray.origin.toArray(),
        direction: ray.direction.toArray(),
        scale: view.root.scale.x,
        slice: view.clipRange
          ? {
              ...view.clipRange,
              row: [1, 5, 9, 13].map((i) => view.root.matrixWorld.elements[i]),
            }
          : null,
      },
    });
  };
  const onBlur = () => {
    down = null;
    pointers.clear();
    multi = false;
  };
  surface.addEventListener(
    "pointerdown",
    controlsManager._onPointerDownCapture,
    true
  );
  surface.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", onUp, true);
  window.addEventListener("pointercancel", onUp, true);
  window.addEventListener("blur", onBlur);
  controls.disconnect();
  controls.connect(surface);
  return () => {
    disposed = true;
    worker.terminate();
    clearEffect();
    surface.removeEventListener(
      "pointerdown",
      controlsManager._onPointerDownCapture,
      true
    );
    surface.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    window.removeEventListener("pointercancel", onUp, true);
    window.removeEventListener("blur", onBlur);
    controls.disconnect();
    if (renderer.domElement.isConnected && !controlsManager._disposed)
      controls.connect(renderer.domElement);
  };
}
