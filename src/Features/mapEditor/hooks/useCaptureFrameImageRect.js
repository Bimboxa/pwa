import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import useCaptureFrameBounds from "Features/pov/hooks/useCaptureFrameBounds";
import {
  getActiveMapEditor,
  subscribeMapEditorCamera,
} from "../services/mapEditorRegistry";

const CAMERA_DEBOUNCE_MS = 100;

// Capture frame expressed in the base map's REFERENCE image px, for the 2D
// hosts (MAP / BASE_MAPS): inverse of the camera + base pose chain used by
// useImageModeLabelsLayout (screen = cam.xy + cam.k * (pose.xy + pose.k *
// img)). Refreshed on every camera change through the registry bus
// (debounced), so the cartouche's "frame == print zone" test follows pans
// and zooms without any MainMapEditorV3 re-render. null when the frame or
// the camera is unavailable (3D host, unmeasured host).
export default function useCaptureFrameImageRect(hostViewerKey) {
  const frameBounds = useCaptureFrameBounds(hostViewerKey);
  const basePose = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  const is2dHost = hostViewerKey === "MAP" || hostViewerKey === "BASE_MAPS";

  const [imageRect, setImageRect] = useState(null);
  const rectRef = useRef(frameBounds?.rect ?? null);
  rectRef.current = frameBounds?.rect ?? null;
  const poseRef = useRef(basePose);
  poseRef.current = basePose;

  useEffect(() => {
    if (!is2dHost) {
      setImageRect(null);
      return;
    }

    let timer = null;

    const compute = () => {
      const rect = rectRef.current;
      const pose = poseRef.current;
      const cam = getActiveMapEditor()?.getCameraMatrix?.();
      if (!rect?.width || !cam || !pose) {
        setImageRect(null);
        return;
      }
      const camK = cam.k || 1;
      const poseK = pose.k || 1;
      const toImage = (vx, vy) => ({
        x: ((vx - cam.x) / camK - (pose.x || 0)) / poseK,
        y: ((vy - cam.y) / camK - (pose.y || 0)) / poseK,
      });
      const p0 = toImage(rect.left, rect.top);
      const p1 = toImage(rect.left + rect.width, rect.top + rect.height);
      const next = {
        x: p0.x,
        y: p0.y,
        width: p1.x - p0.x,
        height: p1.y - p0.y,
      };
      setImageRect((prev) =>
        prev &&
        Math.abs(prev.x - next.x) < 0.5 &&
        Math.abs(prev.y - next.y) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next
      );
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        compute();
      }, CAMERA_DEBOUNCE_MS);
    };

    compute();
    const unsubscribe = subscribeMapEditorCamera(schedule);
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
    // frame rect / pose changes (resize, ratio switch, base map switch) also
    // recompute — the deps below carry them.
  }, [
    is2dHost,
    frameBounds?.rect?.left,
    frameBounds?.rect?.top,
    frameBounds?.rect?.width,
    frameBounds?.rect?.height,
    basePose?.x,
    basePose?.y,
    basePose?.k,
  ]);

  return imageRect;
}
