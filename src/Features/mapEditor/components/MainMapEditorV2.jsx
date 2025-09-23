import { useRef } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  setEnabledDrawingMode,
  setMainBaseMapIsSelected,
  setBaseMapPoseInBg,
  setClickInBgPosition,
  setSelectedNode,
  setLegendFormat,
} from "../mapEditorSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";
import { setSelectedEntityId } from "Features/entities/entitiesSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useMarkers from "Features/markers/hooks/useMarkers";
import useEntity from "Features/entities/hooks/useEntity";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useAnnotations from "Features/annotations/hooks/useAnnotations";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";
//import useCreateMarker from "Features/markers/hooks/useCreateMarker";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import { Box, Button } from "@mui/material";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import ScreenNoBaseMap from "Features/mapEditor/components/ScreenNoBaseMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";
import LayerScreenCursor from "./LayerScreenCursor";

import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

export default function MainMapEditorV2() {
  const dispatch = useDispatch();
  const containerRef = useRef();
  const svgRef = useRef();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = useSelector((s) => s.listings.selectedListingId);

  const annotationSpriteImage = useAnnotationSpriteImage();
  const tempAnnotationTemplateLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );
  const mainBaseMap = useMainBaseMap();
  const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);

  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });

  console.log("[MainMapEditorV2] baseMaps", baseMaps);

  const entity = useEntity();
  const bgImage = useBgImageInMapEditor();
  //const markers = useMarkers({ addDemoMarkers: false });
  const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
  });

  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const selectedAnnotationId = useSelector(
    (s) => s.annotations.selectedAnnotationId
  );

  const baseMapIsSelected = useSelector(
    (s) => s.mapEditor.mainBaseMapIsSelected
  );

  const legendItems = useLegendItems();
  const legendFormat = useSelector((s) => s.mapEditor.legendFormat);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  // data - func

  const createEntity = useCreateEntity();
  //const createMarker = useCreateMarker();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const noBaseMaps = !baseMaps?.length > 0;
  const showScreenCursor = Boolean(enabledDrawingMode);

  let cursor;
  if (enabledDrawingMode) cursor = "crosshair";

  // helpers - selection

  const selectedAnnotationIds = selectedAnnotationId
    ? [selectedAnnotationId]
    : [];

  // effects

  useAutoSelectMainBaseMap();

  if (noBaseMaps) return <ScreenNoBaseMap />;

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      console.log("ESCAPE");
      if (enabledDrawingMode) {
        dispatch(setEnabledDrawingMode(null));
      } else {
        dispatch(setSelectedAnnotationId(null));
        dispatch(setMainBaseMapIsSelected(false));
      }
    }
  }

  async function handleNewAnnotation(annotation) {
    if (annotation.type === "MARKER") {
      const entity = await createEntity({});
      const _annotation = await createAnnotation(
        {
          ...newAnnotation,
          x: annotation.x,
          y: annotation.y,
          entityId: entity?.id,
          listingId: listingId,
          baseMapId: mainBaseMap?.id,
          type: "MARKER",
        },
        { tempAnnotationTemplateLabel }
      );
      console.log("[MainMapEditor] new entity created", _annotation, entity);

      //
    } else if (annotation.type === "TEXT") {
      const entity = await createEntity({});
      const _annotation = await createAnnotation({
        ...newAnnotation,
        x: annotation.x,
        y: annotation.y,
        textValue: newAnnotation?.text ?? "Texte",
        entityId: entity?.id,
        listingId: listingId,
        baseMapId: mainBaseMap?.id,
      });
      dispatch(setEnabledDrawingMode(null));
    }
  }

  async function handleAnnotationChange(_annotation) {
    try {
      console.log("annotation change", _annotation);
      await updateAnnotation(_annotation);
    } catch (e) {
      console.log("error handling annotation", e);
    }
  }

  function handleAnnotationClick(annotation) {
    console.log("click on annotation", annotation);
    dispatch(setSelectedAnnotationId(annotation.id));

    if (annotation.listingId === listingId) {
      dispatch(setSelectedEntityId(annotation.entityId));
    }
  }

  function handleNodeClick(node) {
    dispatch(setSelectedNode(node.id === selectedNode?.id ? null : node));
  }

  async function handleClick() {
    console.log("click on svg", svgRef.current);
    //const dataUrl = await serializeSvgToPng(svgRef.current);

    const blob = await getImageFromSvg(svgRef.current);
    downloadBlob(blob, "map.png");
  }

  function handleBaseMapSelectionChange(isSelected) {
    dispatch(setMainBaseMapIsSelected(isSelected));
  }

  function handleClickInBg(p) {
    dispatch(setClickInBgPosition(p));
  }

  function handleLegendFormatChange(newLegendFormat) {
    dispatch(setLegendFormat(newLegendFormat));
  }

  // render

  return (
    <Box
      onKeyDown={handleKeyDown}
      ref={containerRef}
      tabIndex={0}
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
        baseMapImageUrl={mainBaseMap?.image?.imageUrlClient}
        baseMapPoseInBg={basePoseInBg}
        onBaseMapPoseInBgChange={(pose) => dispatch(setBaseMapPoseInBg(pose))}
        baseMapIsSelected={baseMapIsSelected}
        onBaseMapSelectionChange={handleBaseMapSelectionChange}
        bgImageUrl={bgImage?.url}
        showBgImage={showBgImage}
        //markers={markers}
        annotations={annotations}
        cursor={cursor}
        enabledDrawingMode={enabledDrawingMode}
        onNewAnnotation={handleNewAnnotation}
        selectedNode={selectedNode}
        onNodeClick={handleNodeClick}
        onAnnotationClick={handleAnnotationClick}
        onAnnotationChange={handleAnnotationChange}
        annotationSpriteImage={annotationSpriteImage}
        selectedAnnotationIds={selectedAnnotationIds}
        onClickInBg={handleClickInBg}
        legendItems={legendItems}
        legendFormat={legendFormat}
        onLegendFormatChange={handleLegendFormatChange}
        ref={svgRef}
      />

      <LayerMapEditor svgElement={svgRef.current} />
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
