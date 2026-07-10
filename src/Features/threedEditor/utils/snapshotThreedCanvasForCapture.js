import { getActiveThreedEditor } from "../services/threedEditorRegistry";

// prepareHost step for captureMapAsPng when the host is the 3D viewer.
//
// html-to-image clones <canvas> elements asynchronously (toDataURL inside the
// clone traversal) — by then the WebGL drawing buffer is cleared (the renderer
// has no preserveDrawingBuffer), so the scene would come out blank. Instead we
// render + read the canvas synchronously in the same task, and overlay the
// snapshot as a `data-capture-keep` <img> that html-to-image captures like any
// other node. The live WebGL canvas is hidden by the whitelist pass.
export default async function snapshotThreedCanvasForCapture(
  host,
  { pixelRatio = 2 } = {}
) {
  const sceneManager = getActiveThreedEditor()?.sceneManager;
  const renderer = sceneManager?.renderer;
  const canvasEl = renderer?.domElement;
  if (!canvasEl || !host.contains(canvasEl)) {
    console.warn("[snapshotThreedCanvasForCapture] no active 3D canvas");
    return () => {};
  }

  // Render at the export pixelRatio so the snapshot matches html-to-image's
  // output resolution (setPixelRatio re-runs setSize on the buffer only).
  const prevRatio = renderer.getPixelRatio();
  let dataUrl;
  try {
    if (pixelRatio !== prevRatio) renderer.setPixelRatio(pixelRatio);
    sceneManager.renderScene();
    dataUrl = canvasEl.toDataURL("image/png");
  } finally {
    if (renderer.getPixelRatio() !== prevRatio) {
      renderer.setPixelRatio(prevRatio);
      sceneManager.renderScene();
    }
  }

  const hostRect = host.getBoundingClientRect();
  const canvasRect = canvasEl.getBoundingClientRect();

  const img = document.createElement("img");
  img.setAttribute("data-capture-keep", "");
  img.src = dataUrl;
  Object.assign(img.style, {
    position: "absolute",
    left: `${canvasRect.left - hostRect.left}px`,
    top: `${canvasRect.top - hostRect.top}px`,
    width: `${canvasRect.width}px`,
    height: `${canvasRect.height}px`,
    pointerEvents: "none",
    zIndex: 0, // below the ImageModeOverlay svg (zIndex 5)
  });
  host.appendChild(img);
  try {
    await img.decode();
  } catch {
    // decode failure is non-fatal: html-to-image re-reads img.src anyway
  }

  return () => img.remove();
}
