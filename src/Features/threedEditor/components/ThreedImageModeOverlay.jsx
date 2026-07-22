import { useSelector } from "react-redux";

import useMeasure from "react-use-measure";

import { Box } from "@mui/material";

import ImageModeOverlay from "Features/mapEditor/components/ImageModeOverlay";
import ButtonCloseImageMode from "Features/mapEditor/components/ButtonCloseImageMode";
import useThreedLegendItems from "../hooks/useThreedLegendItems";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import {
  selectIsPovViewer,
  selectPovFramingActive,
} from "Features/viewers/utils/effectiveViewerKey";

// 3D counterpart of the 2D image-mode mount in MainMapEditorV3: capture mask +
// draggable legend + exit button, driven by the same mapEditor.imageMode*
// state as the 2D viewer (the Export panel controls both).
//
// Kept as a child component so its hooks (useSelector, useMeasure) re-render
// only this overlay — MainThreedEditor re-renders destroy/recreate the 3D
// annotation objects and must stay untouched by capture-mode state or resizes.
export default function ThreedImageModeOverlay({ annotations }) {
  // data

  const imageModeEnabled = useSelector((s) => s.mapEditor.imageModeEnabled);
  // The POV viewer arms the framing on demand (without the exit button — the
  // save bar carries its own).
  const isPovViewer = useSelector(selectIsPovViewer);
  const povFramingActive = useSelector(selectPovFramingActive);

  const { legendItems, qtiesById } = useThreedLegendItems(annotations);
  const spriteImage = useAnnotationSpriteImage();

  // Measures the wrapper Box, which fills MainThreedEditor's relative
  // container — same dimensions as the WebGL canvas viewport.
  const [measureRef, bounds] = useMeasure();

  // render

  if (!imageModeEnabled && !povFramingActive) return null;

  return (
    <Box
      ref={measureRef}
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <ImageModeOverlay
        viewportWidth={bounds.width}
        viewportHeight={bounds.height}
        legendItems={legendItems}
        spriteImage={spriteImage}
        qtiesById={qtiesById}
      />
      {imageModeEnabled && !isPovViewer && <ButtonCloseImageMode />}
    </Box>
  );
}
