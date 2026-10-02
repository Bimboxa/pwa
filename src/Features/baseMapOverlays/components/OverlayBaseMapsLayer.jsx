import { memo } from "react";
import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import { GlobalStyles } from "@mui/material";

import NodeBaseMapOverlay from "./NodeBaseMapOverlay";

import {
  OVERLAY_CONTENT_STYLE,
  OVERLAY_WRAPPER_ATTRIBUTE,
} from "../constants/baseMapOverlayConstants";

// The annotation nodes set their own `pointer-events` (hit bands, handles),
// which would win over the wrapper's inherited `none`: an overlaid annotation
// would then be hovered / selected / dragged by the editor as if it belonged
// to the main base map. Forced off for the whole subtree.
const nonInteractiveStyles = (
  <GlobalStyles
    styles={{
      [`[${OVERLAY_WRAPPER_ATTRIBUTE}] *`]: {
        pointerEvents: "none !important",
      },
    }}
  />
);

// Greyed content of the base maps overlaid on the main one (image and / or
// annotations of the parallel base maps switched on in the base maps list).
// Rendered by StaticMapContent INSIDE the main base map group — between its
// image and its annotations — so the coordinates are host pixels.
// Display-only: selection and move / rotate live in
// OverlayBaseMapsTransformLayer.
export default memo(function OverlayBaseMapsLayer({
  overlays,
  hostContainerK,
  visibleViewBox,
  spriteImage,
  sizeVariant,
}) {
  // data

  // The selected overlay is the one being moved: never culled (its content
  // slides under a still camera during the gesture).
  const selectedBaseMapId = useSelector((s) => {
    const item = selectSelectedItems(s)?.[0];
    return item?.type === "BASE_MAP" ? item.id : null;
  });

  // render

  if (!overlays?.length) return null;

  return (
    <g {...{ [OVERLAY_WRAPPER_ATTRIBUTE]: "" }} style={OVERLAY_CONTENT_STYLE}>
      {nonInteractiveStyles}
      {overlays.map((overlay) => (
        <NodeBaseMapOverlay
          key={overlay.baseMap.id}
          baseMap={overlay.baseMap}
          matrix={overlay.matrix}
          matrixStr={overlay.matrixStr}
          showImage={overlay.showImage}
          annotations={overlay.annotations}
          hostContainerK={hostContainerK}
          visibleViewBox={
            overlay.baseMap.id === selectedBaseMapId ? null : visibleViewBox
          }
          spriteImage={spriteImage}
          sizeVariant={sizeVariant}
        />
      ))}
    </g>
  );
});
