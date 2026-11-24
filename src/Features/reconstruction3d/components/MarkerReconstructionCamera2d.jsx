import { useEffect, useRef } from "react";

import { Box } from "@mui/material";
import NavigationIcon from "@mui/icons-material/Navigation";

import {
  getActiveMapEditor,
  subscribeMapEditorCamera,
} from "Features/mapEditor/services/mapEditorRegistry";

const SIZE = 26;

// Camera of the reconstruction player on the 2D plan: an arrow at the
// position of the camera, turned along its line of sight. Laid out in the
// frame of the editors' floating panels (its offset parent) from the client
// position given by the 2D editor; follows the pans / zooms of the plan
// through the camera bus, without a React render per frame.
// `camera`: {position: {x, y} stored px, headingDeg | null}
// (getReconstructionCameraOnBaseMap).
export default function MarkerReconstructionCamera2d({ camera }) {
  // state

  const ref = useRef(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // helpers

  function layout() {
    const element = ref.current;
    if (!element) return;
    const current = cameraRef.current;
    const mapEditor = getActiveMapEditor();
    const client = current
      ? mapEditor?.imagePxToClient?.(current.position)
      : null;
    const viewport = mapEditor?.getViewportRect?.();
    const parent = element.offsetParent?.getBoundingClientRect?.();
    const inside =
      client &&
      viewport &&
      parent &&
      client.x >= viewport.left &&
      client.x <= viewport.right &&
      client.y >= viewport.top &&
      client.y <= viewport.bottom;
    if (!inside) {
      element.style.visibility = "hidden";
      return;
    }
    // the icon points up: heading 0 = +x of the image
    const turnDeg = current.headingDeg == null ? 0 : current.headingDeg + 90;
    element.style.visibility = "visible";
    element.style.transform = `translate(${client.x - parent.left - SIZE / 2}px, ${
      client.y - parent.top - SIZE / 2
    }px) rotate(${turnDeg}deg)`;
    element.style.opacity = current.headingDeg == null ? "0.6" : "1";
  }

  // effects

  useEffect(() => {
    layout();
  });

  useEffect(() => {
    const unsubscribe = subscribeMapEditorCamera(layout);
    window.addEventListener("resize", layout);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", layout);
    };
  }, []);

  // render

  return (
    <Box
      ref={ref}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        zIndex: 1,
        visibility: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "secondary.main",
        filter: "drop-shadow(0 0 2px rgba(255,255,255,0.9))",
        // the frame of the floating panels gives the mouse to its children
        pointerEvents: "none !important",
      }}
    >
      <NavigationIcon sx={{ fontSize: SIZE }} />
    </Box>
  );
}
