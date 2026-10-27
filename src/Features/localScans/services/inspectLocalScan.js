import {
  GridHelper,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  RingGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
  DoubleSide,
} from "three";

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
  let frame = null;
  let mark = null;
  let ring = null;
  let grid = null;
  let requestMatrix = "";
  const matrices = () => {
    camera.updateMatrixWorld();
    view.root.updateMatrixWorld(true);
    return [
      ...camera.matrixWorld.elements,
      ...camera.projectionMatrix.elements,
      ...view.root.matrixWorld.elements,
    ].join(",");
  };
  function clearEffect() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    for (const object of [mark, ring, grid]) {
      object?.removeFromParent();
      object?.geometry.dispose();
      if (object) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => material.dispose());
      }
    }
    mark = ring = grid = null;
    editor.requestRender();
  }
  function pulse(result) {
    clearEffect();
    const material = () =>
      new MeshBasicMaterial({
        color: 0x00d8ff,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
    mark = new Mesh(
      new SphereGeometry(result.radius * 0.045, 12, 8),
      material()
    );
    mark.position.fromArray(result.point);
    mark.renderOrder = 10000;
    mark.raycast = () => false;
    view.root.add(mark);
    if (result.normal) {
      ring = new Mesh(new RingGeometry(0.94, 1, 64), material());
      ring.position.copy(mark.position);
      ring.quaternion.setFromUnitVectors(
        new Vector3(0, 0, 1),
        new Vector3(...result.normal)
      );
      ring.scale.setScalar(0.08 / view.root.scale.x);
      ring.renderOrder = 10000;
      ring.raycast = () => false;
      view.root.add(ring);
      // GridHelper lies in XZ. Source units are converted so the displayed
      // square is always 2 metres wide, independently of the import scale.
      grid = new GridHelper(2 / view.root.scale.x, 20, 0x00efff, 0x00a8dd);
      grid.position.copy(mark.position);
      grid.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(...result.normal)
      );
      grid.material.transparent = true;
      grid.material.opacity = 0.85;
      grid.material.depthTest = false;
      grid.material.depthWrite = false;
      grid.material.toneMapped = false;
      grid.renderOrder = 9999;
      grid.raycast = () => false;
      view.root.add(grid);
    }
    const initialScale = view.root.scale.x;
    const start = performance.now();
    const animate = (now) => {
      const t = (now - start) / 2200;
      if (disposed || t >= 1) {
        clearEffect();
        return;
      }
      mark.material.opacity = 1 - t;
      if (grid) {
        grid.material.opacity = 0.85 * (1 - t) ** 1.5;
        grid.scale.setScalar(initialScale / view.root.scale.x);
      }
      if (ring) {
        ring.scale.setScalar((0.08 + 0.92 * t) / view.root.scale.x);
        ring.material.opacity = (1 - t) * 0.9;
      }
      editor.requestRender();
      frame = requestAnimationFrame(animate);
    };
    editor.renderScene();
    frame = requestAnimationFrame(animate);
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
        pixelAngle: 2 / (camera.projectionMatrix.elements[5] * rect.height),
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
