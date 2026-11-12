import { Vector3 } from "three";

import { getActiveMapEditor } from "Features/mapEditor/services/mapEditorRegistry";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Screen <-> scene conversions of the comment pins, for the displayed editor.
// All screen coordinates are CLIENT px (event.clientX / clientY).

export const THREED_HOST_SELECTOR = '[data-image-capture-host="THREED"]';

export function getMapHostSelector(editorKey = "MAP") {
  return `[data-image-capture-host="${editorKey}"]`;
}

export function getEditorHostRect(selector) {
  const host = document.querySelector(selector);
  const rect = host?.getBoundingClientRect();
  return rect?.width && rect?.height ? rect : null;
}

// 2D: screen = camera.x + camera.k * (basePose.x + basePose.k * imagePx)
// (same relation as snapshotPovViewService / viewerCameraSync).

export function clientToBaseMapNormalized({
  clientX,
  clientY,
  hostRect,
  basePose,
  imageSize,
}) {
  const m = getActiveMapEditor()?.getCameraMatrix?.();
  if (!m?.k || !basePose?.k || !imageSize?.width || !imageSize?.height)
    return null;
  const imgX =
    ((clientX - hostRect.left - m.x) / m.k - basePose.x) / basePose.k;
  const imgY = ((clientY - hostRect.top - m.y) / m.k - basePose.y) / basePose.k;
  return { x: imgX / imageSize.width, y: imgY / imageSize.height };
}

export function baseMapNormalizedToClient({
  point,
  hostRect,
  basePose,
  imageSize,
}) {
  const m = getActiveMapEditor()?.getCameraMatrix?.();
  if (!point || !m?.k || !basePose?.k || !imageSize?.width) return null;
  return {
    x:
      hostRect.left +
      m.x +
      m.k * (basePose.x + basePose.k * point.x * imageSize.width),
    y:
      hostRect.top +
      m.y +
      m.k * (basePose.y + basePose.k * point.y * imageSize.height),
  };
}

// 3D: projection of a world point through the live camera. Null when the
// point is behind the camera or outside the clip range.
const _projected = new Vector3();

export function worldToClient({ worldPosition, hostRect }) {
  const camera = getActiveThreedEditor()?.sceneManager?.camera;
  if (!camera || !worldPosition) return null;
  _projected
    .set(worldPosition.x, worldPosition.y, worldPosition.z)
    .project(camera);
  if (_projected.z < -1 || _projected.z > 1) return null;
  return {
    x: hostRect.left + ((_projected.x + 1) / 2) * hostRect.width,
    y: hostRect.top + ((1 - _projected.y) / 2) * hostRect.height,
  };
}
