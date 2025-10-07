import { useRef, useEffect } from "react";

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
import { setNewAnnotation } from "Features/annotations/annotationsSlice";
import { setOpenBaseMapSelector } from "Features/mapEditor/mapEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setDrawingPolylinePoints } from "../mapEditorSlice";

import { clearDrawingPolylinePoints } from "Features/mapEditor/mapEditorSlice";

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
import useAutoBgImageRawTextAnnotations from "Features/bgImage/hooks/useAutoBgImageRawTextAnnotations";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useSelectedAnnotationTemplateInMapEditor from "../hooks/useSelectedAnnotationTemplateInMapEditor";

import { Box } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import ScreenNoBaseMap from "Features/mapEditor/components/ScreenNoBaseMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";
import LayerScreenCursor from "./LayerScreenCursor";

import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";

import db from "App/db/db";

export default function MainMapEditorV2() {
  const dispatch = useDispatch();
  const containerRef = useRef();
  const svgRef = useRef();

  // data

  const openBaseMapSelector = useSelector(
    (s) => s.mapEditor.openBaseMapSelector
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const { value: listing } = useSelectedListing();
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  console.log("[MainMapEditor] hiddenListingsIds", hiddenListingsIds);

  const annotationSpriteImage = useAnnotationSpriteImage();

  const tempAnnotationTemplateLabel = useSelector(
    (s) => s.annotations.tempAnnotationTemplateLabel
  );
  const annotationTemplate = useSelectedAnnotationTemplateInMapEditor();

  const mainBaseMap = useMainBaseMap();
  const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);

  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });

  const entity = useEntity();
  const bgImage = useBgImageInMapEditor();
  //const markers = useMarkers({ addDemoMarkers: false });
  const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    addBgImageTextAnnotations: true,
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

  // state - edited polyline

  const drawingPolylinePoints = useSelector(
    (s) => s.mapEditor.drawingPolylinePoints
  );

  function handlePolylineComplete(points) {
    dispatch(setDrawingPolylinePoints(points));
  }

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
  useAutoBgImageRawTextAnnotations();

  // handlers

  // global listeners like the dot variant
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        console.log("ESCAPE");
        if (enabledDrawingMode) {
          dispatch(setEnabledDrawingMode(null));
          dispatch(setNewAnnotation({}));
          dispatch(setSelectedNode(null));
          dispatch(clearDrawingPolylinePoints());
        } else {
          dispatch(setSelectedAnnotationId(null));
          dispatch(setMainBaseMapIsSelected(false));
          dispatch(setSelectedNode(null));
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabledDrawingMode]);

  async function handleNewAnnotation(annotation) {
    if (annotation.type === "MARKER") {
      // edge
      if (
        !newAnnotation.iconKey ||
        !newAnnotation.fillColor ||
        !tempAnnotationTemplateLabel
      )
        return;

      // main
      const entity = await createEntity({});
      console.log("[MainMapEditor] create entity", entity);
      const _annotation = await createAnnotation(
        {
          ...newAnnotation,
          x: annotation.x,
          y: annotation.y,
          entityId: entity?.id,
          listingId: listingId,
          baseMapId: mainBaseMap?.id,
          type: "MARKER",
          annotationTemplateId: annotationTemplate?.id,
        },
        {
          tempAnnotationTemplateLabel: annotationTemplate
            ? null
            : tempAnnotationTemplateLabel,
          listingKey: listing.id,
          updateAnnotationTemplateId: !Boolean(annotationTemplate?.id),
        }
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
    // dispatch(setSelectedAnnotationId(annotation.id));

    // if (annotation.listingId === listingId) {
    //   dispatch(setSelectedEntityId(annotation.entityId));
    // }
  }

  async function handleNodeClick(node) {
    node = node?.id === selectedNode?.id ? null : node;

    // disable baseMap selection if !showBgImage
    if (node.nodeType === "BASE_MAP" && !showBgImage) return;

    dispatch(setSelectedNode(node));
    if (node?.nodeType === "ANNOTATION") {
      dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
      const annotation = await db.annotations.get(node?.id);
      console.log("[CLICK] on annotation", annotation);
      const entityId = annotation.entityId;
      if (entityId) {
        //dispatch(setSelectedListingId(node.listingId));
        dispatch(setSelectedEntityId(entityId));
      }
    }
  }

  // Add polyline completion handler
  async function handlePolylineComplete(points) {
    if (points.length < 2) return;

    try {
      // Create entity for the polyline
      const entity = await createEntity({});

      // Create annotation with polyline data
      const annotation = await createAnnotation({
        ...newAnnotation,
        type: "POLYLINE",
        points, // Store the points array
        entityId: entity?.id,
        listingId: listingId,
        baseMapId: mainBaseMap?.id,
        annotationTemplateId: annotationTemplate?.id,
      });

      console.log("[MainMapEditor] new polyline created", annotation, entity);

      // Reset drawing mode
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      dispatch(setSelectedNode(null));
      dispatch(clearDrawingPolylinePoints()); // Clear polyline points
    } catch (error) {
      console.error("Error creating polyline:", error);
    }
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

  if (noBaseMaps) return <ScreenNoBaseMap />;

  if (openBaseMapSelector)
    return (
      <BoxCenter>
        <SectionCreateBaseMapFullscreen
          onClose={() => dispatch(setOpenBaseMapSelector(false))}
        />
      </BoxCenter>
    );

  // render

  return (
    <Box
      ref={containerRef}
      tabIndex={-1}
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
        // polyline
        drawingPolylinePoints={drawingPolylinePoints}
        onPolylineComplete={handlePolylineComplete}
        newPolylineProps={{ ...(newAnnotation ?? {}) }}
        ref={svgRef}
      />

      <LayerMapEditor svgElement={svgRef.current} />
      {showScreenCursor && (
        <LayerScreenCursor containerEl={containerRef?.current} />
      )}

      {/* <Button
        onClick={handleClick}
        sx={{ position: "absolute", bottom: 10, right: 10 }}
      >
        Print
      </Button> */}
    </Box>
  );
}
