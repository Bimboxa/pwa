import { getActiveThreedEditor } from "./threedEditorRegistry";

// Captures the live 3D canvas exactly as shown (basemap + annotations + grid).
// The renderer has no preserveDrawingBuffer and renders on-demand, so we must
// render synchronously and read the buffer back in the same task — otherwise
// toDataURL() returns a blank/transparent image.
export default function captureSceneScreenshotService() {
  const editor = getActiveThreedEditor();
  const sceneManager = editor?.sceneManager;
  if (!sceneManager?.renderer) {
    throw new Error("[captureSceneScreenshotService] no active 3D scene");
  }
  sceneManager.renderScene();
  return sceneManager.renderer.domElement.toDataURL("image/png");
}
