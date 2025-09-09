import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useMarkers from "Features/markers/hooks/useMarkers";
import useEntity from "Features/entities/hooks/useEntity";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useAnnotations from "Features/annotations/hooks/useAnnotations";

import { Box, Button } from "@mui/material";

import SectionNoMap from "Features/mapEditor/components/SectionNoMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";
import LayerScreenCursor from "./LayerScreenCursor";
import { useRef } from "react";
import useCreateMarker from "Features/markers/hooks/useCreateMarker";

import { serializeSvgToPng } from "Features/mapEditorGeneric/utils/serializeSvgToPng";
import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function MainMapEditorV2() {
  const dispatch = useDispatch();
  const containerRef = useRef();
  const svgRef = useRef();

  // state

  const [basePoseInBg, setBasePoseInBg] = useState({ x: 40, y: 40, k: 1 });

  // data

  const entity = useEntity();
  const mainBaseMap = useMainBaseMap();

  const { value: baseMaps } = useBaseMaps();
  const bgImage = useBgImageInMapEditor();
  const markers = useMarkers({ addDemoMarkers: true });
  const annotations = useAnnotations();

  const showBgImage = useSelector((s) => s.shower.showBgImage);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // data - func

  const createEntity = useCreateEntity();
  const createMarker = useCreateMarker();

  // helpers

  const noBaseMaps = !baseMaps?.length > 0;
  const showScreenCursor = Boolean(enabledDrawingMode);

  let cursor;
  if (enabledDrawingMode) cursor = "crosshair";

  // effects

  //useAutoSelectMainBaseMap();

  if (noBaseMaps) return <SectionNoMap />;

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      if (enabledDrawingMode) {
        dispatch(setEnabledDrawingMode(null));
      }
    }
  }

  async function handleNewAnnotation(annotation) {
    if (annotation.type === "MARKER") {
      const entity = await createEntity({});
      const marker = await createMarker({
        x: annotation.x,
        y: annotation.y,
        entityId: entity?.id,
      });
      console.log("[MainMapEditor] new entity created", marker, entity);
    }
  }

  function handleAnnotationClick(annotation) {
    console.log("click on annotation", annotation);
  }

  async function handleClick() {
    console.log("click on svg", svgRef.current);
    //const dataUrl = await serializeSvgToPng(svgRef.current);

    const blob = await getImageFromSvg(svgRef.current);
    downloadBlob(blob, "map.png");
  }

  // render

  return (
    <Box
      onKeyDown={handleKeyDown}
      ref={containerRef}
      //tabIndex={0}
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        outline: "none", // Remove focus outline since this is a container
      }}
    >
      <MapEditorGeneric
        baseMapImageUrl={mainBaseMap?.image.imageUrlClient}
        baseMapPoseInBg={basePoseInBg}
        onBaseMapPoseInBgChange={setBasePoseInBg}
        bgImageUrl={bgImage?.imageUrlRemote}
        showBgImage={showBgImage}
        markers={markers}
        annotations={annotations}
        cursor={cursor}
        enabledDrawingMode={enabledDrawingMode}
        onNewAnnotation={handleNewAnnotation}
        onAnnotationClick={handleAnnotationClick}
        ref={svgRef}
      />

      <LayerMapEditor />
      {showScreenCursor && (
        <LayerScreenCursor containerEl={containerRef?.current} />
      )}

      <Button
        onClick={handleClick}
        sx={{ position: "absolute", bottom: 10, right: 10 }}
      >
        Print
      </Button>
    </Box>
  );
}
