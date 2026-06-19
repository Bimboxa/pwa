import { getActiveThreedEditor } from "./threedEditorRegistry";
import getImageFromElement from "Features/misc/utils/getImageFromElement";

// DOM id carried by the 3D legend overlay (ThreedPopperLegend) so the capture
// can locate and composite it onto the rendered scene image.
export const THREED_LEGEND_CAPTURE_ID = "threed-legend-capture";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Captures the live 3D canvas exactly as shown (basemap + annotations + grid),
// then composites the legend overlay (if visible) on top at its on-screen
// position so the user gets a single ready-to-paste image.
//
// The renderer has no preserveDrawingBuffer and renders on-demand, so the
// render + readback must happen synchronously in the same task — otherwise
// toDataURL() returns a blank/transparent image. We therefore grab the scene
// data URL first, then do the (async) legend rasterization + compositing.
export default async function captureSceneScreenshotService() {
  const editor = getActiveThreedEditor();
  const sceneManager = editor?.sceneManager;
  if (!sceneManager?.renderer) {
    throw new Error("[captureSceneScreenshotService] no active 3D scene");
  }
  sceneManager.renderScene();
  const canvasEl = sceneManager.renderer.domElement;
  const sceneDataUrl = canvasEl.toDataURL("image/png");

  const legendEl = document.getElementById(THREED_LEGEND_CAPTURE_ID);
  if (!legendEl) return sceneDataUrl;

  try {
    // Scale between the canvas drawing buffer (image pixels) and its CSS size.
    const canvasRect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / canvasRect.width;
    const scaleY = canvasEl.height / canvasRect.height;

    const legendRect = legendEl.getBoundingClientRect();
    const dx = (legendRect.left - canvasRect.left) * scaleX;
    const dy = (legendRect.top - canvasRect.top) * scaleY;
    const dw = legendRect.width * scaleX;
    const dh = legendRect.height * scaleY;

    const { url: legendUrl } = await getImageFromElement(legendEl);
    if (!legendUrl) return sceneDataUrl;

    const out = document.createElement("canvas");
    out.width = canvasEl.width;
    out.height = canvasEl.height;
    const ctx = out.getContext("2d");

    const [sceneImg, legendImg] = await Promise.all([
      loadImage(sceneDataUrl),
      loadImage(legendUrl),
    ]);
    ctx.drawImage(sceneImg, 0, 0, out.width, out.height);
    ctx.drawImage(legendImg, dx, dy, dw, dh);

    return out.toDataURL("image/png");
  } catch (e) {
    console.error("[captureSceneScreenshotService] legend composite failed", e);
    return sceneDataUrl;
  }
}
