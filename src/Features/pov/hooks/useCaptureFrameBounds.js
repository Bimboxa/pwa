import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import getCaptureRectBounds from "Features/mapEditor/utils/getCaptureRectBounds";

// Live bounds of the POV capture frame (the dashed rectangle drawn by
// ImageModeOverlay): host-local `rect` + viewport-space `screenRect`.
// Measures the displayed editor's capture host (the same
// [data-image-capture-host] element captureMapAsPng snapshots) so UI can be
// anchored to the frame in both the 2D and 3D editors.
// The right panel is ignored (like everywhere in the POV flow): the frame —
// and the save bar centered on it — must not move when the panel opens.
export default function useCaptureFrameBounds() {
  // data

  const viewerMode = useSelector((s) => s.pov.viewerMode);
  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);

  const viewerKey = viewerMode === "THREED" ? "THREED" : "MAP";

  // state

  const [hostBounds, setHostBounds] = useState(null);

  useEffect(() => {
    const host = document.querySelector(
      `[data-image-capture-host="${viewerKey}"]`
    );
    if (!host) {
      setHostBounds(null);
      return;
    }

    function measure() {
      const r = host.getBoundingClientRect();
      setHostBounds((prev) =>
        prev &&
        prev.left === r.left &&
        prev.top === r.top &&
        prev.width === r.width &&
        prev.height === r.height
          ? prev
          : { left: r.left, top: r.top, width: r.width, height: r.height }
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [viewerKey]);

  // helpers

  if (!hostBounds?.width || !hostBounds?.height) return null;

  const rect = getCaptureRectBounds(
    hostBounds.width,
    hostBounds.height,
    aspectRatio
  );

  return {
    rect, // host-local (same coords as ImageModeOverlay)
    screenRect: {
      left: hostBounds.left + rect.left,
      top: hostBounds.top + rect.top,
      width: rect.width,
      height: rect.height,
    },
    hostBounds,
  };
}
