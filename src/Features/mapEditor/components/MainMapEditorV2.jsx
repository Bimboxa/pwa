import { useRef, useEffect, useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  setEnabledDrawingMode,
  setMainBaseMapIsSelected,
  setBaseMapPoseInBg,
  setClickInBgPosition,
  setClickInBaseMapPosition,
  setSelectedNode,
  setLegendFormat,
  setScaleInPx,
  setAnchorPositionScale,
  setScaleAnnotationId,
  setFilesDrop,
} from "../mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";
import {
  setSelectedEntityId,
  setOpenDialogCreateEntity,
  setIsEditingEntity,
  setEditedEntity,
} from "Features/entities/entitiesSlice";
import {
  setNewAnnotation,
  setTempAnnotations,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import {
  setOpencvPreviewUrl,
  addSelectedColor,
} from "Features/opencv/opencvSlice";
import { setOpenBaseMapSelector } from "Features/mapEditor/mapEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  setDrawingPolylinePoints,
  setDrawingRectanglePoints,
  setDrawingSegmentPoints,
} from "../mapEditorSlice";

import {
  clearDrawingPolylinePoints,
  clearDrawingRectanglePoints,
  clearDrawingSegmentPoints,
} from "Features/mapEditor/mapEditorSlice";
import { setOpenDialogDeleteSelectedItem } from "Features/selection/selectionSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";

import {
  setAnchorPosition,
  setClickedNode,
} from "Features/contextMenu/contextMenuSlice";
import { updateTempAnnotation } from "Features/annotations/annotationsSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useInitDefaultNewAnnotation from "Features/annotations/hooks/useInitDefaultNewAnnotation";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useAutoShowBgImage from "Features/bgImage/hooks/useAutoShowBgImage";
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
import useAutoResetBaseMapPose from "Features/bgImage/hooks/useAutoResetBaseMapPose";

import { Box } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import ScreenNoBaseMap from "Features/mapEditor/components/ScreenNoBaseMap";
import MapEditorGeneric from "Features/mapEditorGeneric/components/MapEditorGeneric";
import LayerMapEditor from "./LayerMapEditor";
import LayerScreenCursor from "./LayerScreenCursor";
import BlockEntityMarker from "Features/markers/components/BlockEntityMarker";
import PopperEditScale from "./PopperEditScale";
import PopperContextMenu from "Features/contextMenu/component/PopperContextMenu";

import DialogDeleteSelectedItem from "Features/selection/components/DialogDeleteSelectedItem";
import DialogAutoSelectAnnotationTemplateToCreateEntity from "Features/entities/components/DialogAutoSelectAnnotationTemplateToCreateEntity";
import DialogAutoCreateEntity from "Features/entities/components/DialogAutoCreateEntity";
import DialogAutoSetNewAnnotationFromFilesDrop from "Features/annotations/components/DialogAutoSetNewAnnotationFromFilesDrop";

import downloadBlob from "Features/files/utils/downloadBlob";
import getImageFromSvg from "Features/mapEditorGeneric/utils/getImageFromSvg";
import base64ToBlob from "Features/images/utils/base64ToBlob";

import db from "App/db/db";
import editor from "App/editor";
import cv from "Features/opencv/services/opencvService";
import cleanPolylinePoints from "Features/geometry/utils/cleanPolylinePoints";
import theme from "Styles/theme";
import doesPolylineCutClosedPolyline from "Features/geometry/utils/doesPolylineCutClosedPolyline";
import { nanoid } from "@reduxjs/toolkit";
import getPolylinesFromContours from "Features/annotations/utils/getPolylinesFromContours";

export default function MainMapEditorV2() {
  const dispatch = useDispatch();
  const containerRef = useRef();
  const svgRef = useRef();

  useEffect(() => {
    editor.mapEditorSvgElement = svgRef.current;
  }, [svgRef.current]);

  // data

  const isMobile = useIsMobile();

  const openBaseMapSelector = useSelector(
    (s) => s.mapEditor.openBaseMapSelector
  );
  const openedPanel = useSelector((s) => s.listings.openedPanel);

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const { value: listing } = useSelectedListing();
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  const annotationSpriteImage = useAnnotationSpriteImage();

  const tempAnnotationTemplateLabel =
    useSelector((s) => s.annotations.tempAnnotationTemplateLabel) ?? "-?-";
  const annotationTemplate = useSelectedAnnotationTemplateInMapEditor();

  const mainBaseMap = useMainBaseMap();
  const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
  //const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
  //const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);
  const baseMapOpacity = mainBaseMap?.opacity;
  const baseMapGrayScale = mainBaseMap?.grayScale;

  console.log("debug_411_baseMapOpacity", baseMapOpacity);

  const centerBaseMapTriggeredAt = useSelector(
    (s) => s.mapEditor.centerBaseMapTriggeredAt
  );
  const zoomTo = useSelector((s) => s.mapEditor.zoomTo);

  const { value: baseMaps } = useBaseMaps({ filterByProjectId: projectId });

  const entity = useEntity();
  const newEntity = useNewEntity();

  const bgImage = useBgImageInMapEditor();
  //const markers = useMarkers({ addDemoMarkers: false });
  const annotations = useAnnotations({
    addDemoAnnotations: false,
    filterByBaseMapId: mainBaseMap?.id,
    excludeListingsIds: hiddenListingsIds,
    addBgImageTextAnnotations: true,
    withEntity: true,
    withLabel: true,
  });

  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const opencvClickMode = useSelector((s) => s.opencv.opencvClickMode);
  const bboxDims = useSelector((s) => s.opencv.bboxDims);
  const selectedColors = useSelector((s) => s.opencv.selectedColors);

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

  const selectedItem = useSelector((s) => s.selection.selectedItem);

  // state - edited polyline

  const drawingPolylinePoints = useSelector(
    (s) => s.mapEditor.drawingPolylinePoints
  );

  const handlePolylineCompleteRef = useRef();

  // state - edited rectangle

  const drawingRectanglePoints = useSelector(
    (s) => s.mapEditor.drawingRectanglePoints
  );

  // state - edited segment

  const drawingSegmentPoints = useSelector(
    (s) => s.mapEditor.drawingSegmentPoints
  );

  // data - func

  const createEntity = useCreateEntity();
  //const createMarker = useCreateMarker();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const initDefaultNewAnnotation = useInitDefaultNewAnnotation();

  // state - escape

  const [escapeTriggeredAt, setEscapeTriggeredAt] = useState(null);

  // effet - init newAnnotation

  useEffect(() => {
    if (!newAnnotation?.type && annotationSpriteImage)
      initDefaultNewAnnotation();
  }, [newAnnotation?.type, annotationSpriteImage]);

  // helpers

  const noBaseMaps = !baseMaps?.length > 0;
  const showScreenCursor = Boolean(enabledDrawingMode);

  let cursor;
  if (enabledDrawingMode) cursor = "crosshair";

  // helpers - selection

  const selectedAnnotationIds = selectedAnnotationId
    ? [selectedAnnotationId]
    : [];

  // helpers - baseMapUrl

  const opencvPreviewUrl = useSelector((s) => s.opencv.opencvPreviewUrl);
  const showOpencvPreview = useSelector((s) => s.opencv.showOpencvPreview);
  let baseMapImageUrl =
    mainBaseMap?.showEnhanced && mainBaseMap?.imageEnhanced
      ? mainBaseMap.imageEnhanced.imageUrlClient ??
        mainBaseMap.imageEnhanced.imageUrlRemote
      : mainBaseMap?.image?.imageUrlClient ??
        mainBaseMap?.image?.imageUrlRemote;
  if (opencvPreviewUrl && showOpencvPreview) baseMapImageUrl = opencvPreviewUrl;

  // effects

  useAutoSelectMainBaseMap();
  useAutoBgImageRawTextAnnotations();
  useAutoResetBaseMapPose();
  useAutoShowBgImage();

  // handlers
  // right-click context menu
  function handleContextMenu(e) {
    e.preventDefault();

    // Detect if clicking on a node
    const nativeTarget = e.nativeEvent?.target || e.target;
    const hit = nativeTarget.closest?.("[data-node-type]");

    if (hit) {
      const { nodeId, nodeListingId, nodeType, annotationType, pointIndex } =
        hit.dataset;
      dispatch(
        setClickedNode({
          id: nodeId,
          nodeListingId,
          nodeType,
          annotationType,
          pointIndex,
        })
      );
    } else {
      dispatch(setClickedNode(null));
    }

    // Use client coordinates for Popper anchor
    dispatch(
      setAnchorPosition({
        x: e.clientX,
        y: e.clientY,
      })
    );
  }

  // global listeners like the dot variant
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        console.log("ESCAPE");
        setEscapeTriggeredAt(Date.now());
        if (enabledDrawingMode) {
          if (
            enabledDrawingMode === "POLYLINE" &&
            drawingPolylinePoints?.length >= 2
          ) {
            handlePolylineCompleteRef.current?.(drawingPolylinePoints);
          }
          dispatch(setEnabledDrawingMode(null));
          dispatch(setNewAnnotation({}));
          dispatch(setSelectedNode(null));
          dispatch(clearDrawingPolylinePoints());
          dispatch(clearDrawingRectanglePoints());
          dispatch(clearDrawingSegmentPoints());
        } else {
          dispatch(setSelectedAnnotationId(null));
          dispatch(setMainBaseMapIsSelected(false));
          dispatch(setSelectedNode(null));
          dispatch(setSelectedItem(null));
          dispatch(setSelectedEntityId(null));
          dispatch(setIsEditingEntity(false));
          dispatch(setEditedEntity(null));
          dispatch(setNewAnnotation(null));
          dispatch(setAnchorPosition(null));
        }
      } else if (e.key === "Enter") {
        if (
          enabledDrawingMode === "POLYLINE" &&
          drawingPolylinePoints?.length >= 2
        ) {
          handlePolylineCompleteRef.current?.(drawingPolylinePoints); // /!\ triggered when Enter from "Section Next Points"
        }
      } else if (
        selectedItem?.type === "ENTITY" &&
        (e.key === "Delete" || e.key === "Backspace") &&
        !enabledDrawingMode
      ) {
        dispatch(setOpenDialogDeleteSelectedItem(true));
      }
    };
    document.addEventListener("keydown", onKeyDown, { passive: false });

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabledDrawingMode, selectedItem?.type, drawingPolylinePoints]);

  function handleFilesDrop(filesDrop) {
    console.log("file drop", filesDrop);
    dispatch(setFilesDrop({ ...filesDrop, baseMapId: mainBaseMap?.id }));
  }

  async function handleNewAnnotation(annotation) {
    dispatch(setEnabledDrawingMode(null));

    if (annotation.type === "MARKER") {
      const _annotation = {
        ...newAnnotation,
        ...annotation,
        baseMapId: mainBaseMap?.id,
      };
      dispatch(setNewAnnotation(_annotation));
      dispatch(setOpenDialogCreateEntity(true));

      // Prepare entity data - include image if dropped
      // const entityData = { ...newEntity };
      // if (annotation.imageFile) {
      //   entityData.image = { file: annotation.imageFile };
      // }

      // main
      // const entity = await createEntity(entityData);
      // console.log("[MainMapEditor] create entity", entity, entityData);
      // console.log("[MainMapEditor] create annotation", newAnnotation);
      // const _annotation = await createAnnotation({
      //   ...newAnnotation,
      //   x: annotation.x,
      //   y: annotation.y,
      //   entityId: entity?.id,
      //   listingId: listingId,
      //   listingTable: listing?.table,
      //   baseMapId: mainBaseMap?.id,
      //   type: "MARKER",
      //   annotationTemplateId:
      //     annotation.annotationTemplateId ?? newAnnotation.annotationTemplateId,
      // });
      // console.log("[MainMapEditor] new entity created", _annotation, entity);

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
        listingTable: listing?.table,
        baseMapId: mainBaseMap?.id,
      });
      dispatch(setEnabledDrawingMode(null));
    } else if (annotation.type === "IMAGE") {
      // Create entity - image will be stored in entity
      const entity = await createEntity({});

      // Create annotation - dimensions will be computed from scale factors in NodeImageAnnotation
      const _annotation = await createAnnotation({
        ...newAnnotation,
        type: "IMAGE",
        x: annotation.x, // center position
        y: annotation.y,
        //rotation: 0,
        entityId: entity?.id,
        listingId: listingId,
        listingTable: listing?.table,
        baseMapId: mainBaseMap?.id,
        // width and height will be computed from image.meterByPx and baseMap.meterByPx
      });
      console.log(
        "[MainMapEditor] new image annotation created",
        _annotation,
        entity
      );
      dispatch(setEnabledDrawingMode(null));
    }
  }

  async function handleAnnotationChange(_annotation) {
    try {
      console.log("annotation change", _annotation);

      if (_annotation?.isTemp) {
        dispatch(updateTempAnnotation(_annotation));
        return;
      }
      await updateAnnotation(_annotation);

      // Handle cutHost updates: if this is a cutHost polyline and its points changed,
      // detect the hosts and update their cuts
      if (
        _annotation.type === "POLYLINE" &&
        Array.isArray(_annotation.points) &&
        _annotation.points.length >= 2 &&
        _annotation.baseMapId
      ) {
        // Check if annotationTemplate has cutHost property
        let annotationTemplateCutHost = false;
        if (_annotation.annotationTemplateId) {
          const annotationTemplate = await db.annotationTemplates.get(
            _annotation.annotationTemplateId
          );
          annotationTemplateCutHost = annotationTemplate?.cutHost === true;
        }

        const isCutHost =
          _annotation.cutHost === true || annotationTemplateCutHost;

        if (isCutHost && mainBaseMap) {
          const imageSize =
            mainBaseMap.imageEnhanced?.imageSize ??
            mainBaseMap.image?.imageSize;

          if (imageSize?.width && imageSize?.height) {
            // Find all annotations on the same baseMap
            const allAnnotations = await db.annotations
              .where("baseMapId")
              .equals(_annotation.baseMapId)
              .toArray();

            // Update existing cuts that reference this cutHost (update points)
            for (const ann of allAnnotations) {
              if (ann.cuts && Array.isArray(ann.cuts) && ann.cuts.length > 0) {
                const hasCutHost = ann.cuts.some(
                  (cut) => cut.cutHostId === _annotation.id
                );

                if (hasCutHost) {
                  // Update the cut's points
                  const updatedCuts = ann.cuts.map((cut) =>
                    cut.cutHostId === _annotation.id
                      ? { ...cut, points: _annotation.points }
                      : cut
                  );

                  await db.annotations.update(ann.id, {
                    cuts: updatedCuts,
                  });
                }
              }
            }

            // Re-check which closed polylines now contain this cutHost
            const closedPolylines = allAnnotations.filter(
              (ann) =>
                ann.type === "POLYLINE" &&
                ann.id !== _annotation.id &&
                ann.closeLine === true &&
                Array.isArray(ann.points) &&
                ann.points.length >= 3
            );

            for (const closedPolyline of closedPolylines) {
              const containsCutHost = doesPolylineCutClosedPolyline(
                _annotation.points, // cutHost points
                closedPolyline.points, // closed polyline points
                { w: imageSize.width, h: imageSize.height }
              );

              const existingCuts = closedPolyline.cuts || [];
              const cutExists = existingCuts.some(
                (cut) => cut.cutHostId === _annotation.id
              );

              if (containsCutHost && !cutExists) {
                // Add cut to this polyline (closed polyline contains the cutHost)
                const newCut = {
                  id: nanoid(),
                  cutHostId: _annotation.id,
                  points: _annotation.points,
                  closeLine: true,
                };

                await db.annotations.update(closedPolyline.id, {
                  cuts: [...existingCuts, newCut],
                });
              } else if (!containsCutHost && cutExists) {
                // Remove cut from this polyline (closed polyline no longer contains the cutHost)
                const updatedCuts = existingCuts.filter(
                  (cut) => cut.cutHostId !== _annotation.id
                );

                await db.annotations.update(closedPolyline.id, {
                  cuts: updatedCuts.length > 0 ? updatedCuts : undefined,
                });
              }
            }
          }
        }
      }
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
    console.log("click on node", node);
    node = node?.id === selectedNode?.id ? null : node;
    const activeListingType = listing?.entityModel?.type;

    // disable baseMap selection if !showBgImage
    if (node?.nodeType === "BASE_MAP" && !showBgImage) {
      return;
      // dispatch(
      //   setSelectedItem({
      //     type: "ENTITY",
      //     id: mainBaseMap?.id,
      //     listingId: mainBaseMap?.listingId,
      //   })
      // );
    }

    // diable click in blueprint edition
    if (activeListingType === "BLUEPRINT" && node?.nodeType === "ANNOTATION")
      return;

    dispatch(setSelectedNode(node));
    if (node?.nodeType === "ANNOTATION") {
      //dispatch(setSelectedMenuItemKey("NODE_FORMAT"));
      const annotation = await db.annotations.get(node?.id);
      console.log("[CLICK] on annotation", annotation);
      const entityId = annotation?.entityId;
      if (entityId) {
        //dispatch(setSelectedListingId(node.listingId));
        dispatch(setSelectedEntityId(entityId));
        dispatch(
          setSelectedItem({
            type: "ENTITY",
            id: entityId,
            listingId: annotation.listingId,
          })
        );
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
      const createdAnnotation = await createAnnotation({
        ...newAnnotation,
        type: "POLYLINE",
        points, // Store the points array
        entityId: entity?.id,
        listingId: listingId,
        baseMapId: mainBaseMap?.id,
        annotationTemplateId: annotationTemplate?.id,
        // Pass cutHost from annotationTemplate if it exists
        ...(annotationTemplate?.cutHost === true ? { cutHost: true } : {}),
      });

      // Handle cutHost: if this polyline has cutHost from annotationTemplate,
      // detect which closed polylines contain it and add it as a cut
      // Wrap in try-catch to ensure cleanup always happens even if detection fails
      const isCutHost =
        createdAnnotation?.cutHost === true ||
        annotationTemplate?.cutHost === true;
      if (
        createdAnnotation &&
        isCutHost &&
        Array.isArray(points) &&
        points.length >= 2 &&
        mainBaseMap?.id
      ) {
        try {
          // Get baseMap for image size
          if (mainBaseMap) {
            const imageSize =
              mainBaseMap.imageEnhanced?.imageSize ??
              mainBaseMap.image?.imageSize;

            if (imageSize?.width && imageSize?.height) {
              // Find all closed polylines on the same baseMap
              const allAnnotations = await db.annotations
                .where("baseMapId")
                .equals(mainBaseMap.id)
                .toArray();

              const closedPolylines = allAnnotations.filter(
                (ann) =>
                  ann.type === "POLYLINE" &&
                  ann.id !== createdAnnotation.id &&
                  ann.closeLine === true &&
                  Array.isArray(ann.points) &&
                  ann.points.length >= 3
              );

              // Check each closed polyline to see if it contains the cutHost
              for (const closedPolyline of closedPolylines) {
                try {
                  const containsCutHost = doesPolylineCutClosedPolyline(
                    points, // cutHost points
                    closedPolyline.points, // closed polyline points
                    { w: imageSize.width, h: imageSize.height }
                  );

                  if (containsCutHost) {
                    // Add this cutHost as a cut to the closed polyline
                    const existingCuts = closedPolyline.cuts || [];

                    // Check if this cut already exists (by cutHost id)
                    const cutExists = existingCuts.some(
                      (cut) => cut.cutHostId === createdAnnotation.id
                    );

                    if (!cutExists) {
                      // Create a new cut entry referencing the cutHost
                      const newCut = {
                        id: nanoid(),
                        cutHostId: createdAnnotation.id, // Reference to the cutHost annotation
                        points: points, // Copy of points
                        closeLine: true, // Cuts should always be closed
                      };

                      await db.annotations.update(closedPolyline.id, {
                        cuts: [...existingCuts, newCut],
                      });
                    }
                  }
                } catch (polylineError) {
                  console.error(
                    "Error processing polyline for cutHost:",
                    polylineError
                  );
                  // Continue with next polyline
                }
              }

              // Trigger annotations update after modifying cuts
              dispatch(triggerAnnotationsUpdate());
            }
          }
        } catch (cutHostError) {
          console.error("Error in cutHost detection:", cutHostError);
          // Don't throw - allow cleanup to proceed
        }
      }
    } catch (error) {
      console.error("Error creating polyline:", error);
    } finally {
      // Always cleanup drawing state, even if cutHost detection fails
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      dispatch(setSelectedNode(null));
      dispatch(clearDrawingPolylinePoints());
    }
  }

  // Store the function in ref for use in useEffect
  handlePolylineCompleteRef.current = handlePolylineComplete;

  // Add rectangle completion handler
  async function handleRectangleComplete(points) {
    if (points.length < 2) return;

    try {
      // Create entity for the rectangle
      const entity = await createEntity({});

      // Create annotation with rectangle data
      const annotation = await createAnnotation(
        {
          ...newAnnotation,
          type: "RECTANGLE",
          points, // Store the points array (2 diagonal corners)
          entityId: entity?.id,
          listingId: listingId,
          baseMapId: mainBaseMap?.id,
          annotationTemplateId: annotationTemplate?.id,
        },
        {
          listingKey: listing.id,
          tempAnnotationTemplateLabel,
        }
      );

      console.log("[MainMapEditor] new rectangle created", annotation, entity);

      // Reset drawing mode
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      dispatch(setSelectedNode(null));
      dispatch(clearDrawingRectanglePoints()); // Clear rectangle points
    } catch (error) {
      console.error("Error creating rectangle:", error);
    }
  }

  // Add segment completion handler
  async function handleSegmentComplete(points, anchorPositionScale) {
    if (points.length < 2) return;

    try {
      // If this is a scale segment, compute the length in pixels
      if (newAnnotation?.isScaleSegment) {
        // Get baseMap dimensions

        const baseMapW = mainBaseMap?.image?.imageSize?.width || 1;
        const baseMapH = mainBaseMap?.image?.imageSize?.height || 1;

        // Convert relative coordinates (0-1) to baseMap pixel coordinates
        const p1x = points[0].x * baseMapW;
        const p1y = points[0].y * baseMapH;
        const p2x = points[1].x * baseMapW;
        const p2y = points[1].y * baseMapH;

        // Calculate distance in pixels (Euclidean distance)
        const dx = p2x - p1x;
        const dy = p2y - p1y;
        const scaleInPx = Math.sqrt(dx * dx + dy * dy);

        console.log("[MainMapEditor] Scale segment length:", scaleInPx, "px");

        // Dispatch the scale in pixels
        dispatch(setScaleInPx(scaleInPx));
        dispatch(setAnchorPositionScale(anchorPositionScale));
      }

      // Create entity for the segment
      let entity;
      if (!newAnnotation.isScaleSegment) {
        entity = await createEntity({});
      }

      // Create annotation with segment data
      const annotation = await createAnnotation(
        {
          ...newAnnotation,
          type: "SEGMENT",
          points, // Store the points array (2 points: start and end)
          entityId: entity?.id,
          listingId: listingId,
          baseMapId: mainBaseMap?.id,
          annotationTemplateId: annotationTemplate?.id,
        },
        {
          listingKey: listing.id,
          tempAnnotationTemplateLabel,
        }
      );

      console.log("[MainMapEditor] new segment created", annotation, entity);

      // Reset drawing mode
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      dispatch(setSelectedNode(null));
      dispatch(clearDrawingSegmentPoints()); // Clear segment points

      if (newAnnotation.isScaleSegment)
        dispatch(setScaleAnnotationId(annotation?.id));
    } catch (error) {
      console.error("Error creating segment:", error);
    }
  }

  function handleBaseMapSelectionChange(isSelected) {
    dispatch(setMainBaseMapIsSelected(isSelected));
  }

  function handleClickInBg(p) {
    dispatch(setClickInBgPosition(p));
  }

  async function handleClickInBaseMap(p) {
    dispatch(setClickInBaseMapPosition(p));
    console.log("debug_2411_p", p);

    if (enabledDrawingMode === "OPENCV") {
      await cv.load();
      // const color = await cv.getPixelColorAsync({
      //   imageUrl: baseMapImageUrl,
      //   x: p.x,
      //   y: p.y,
      // });
      if (opencvClickMode === "COLOR_PICKER") {
        const { colorHex } = await cv.getPixelColorAsync({
          imageUrl: baseMapImageUrl,
          x: p.x,
          y: p.y,
        });
        if (colorHex) {
          dispatch(addSelectedColor(colorHex));
        }
      } else if (opencvClickMode === "KEEP_COLORS") {
        const { x_absolute, y_absolute, scaleToBaseLocal, scaleToBgLocal } = p;
        const pxToBase =
          ((typeof scaleToBaseLocal === "number"
            ? scaleToBaseLocal
            : scaleToBgLocal) || 0) / 10;

        if (pxToBase <= 0) {
          console.warn(
            "[KEEP_COLORS] Unable to determine scale factor. Aborting keep-colored-content."
          );
          return;
        }

        const bbox = {
          x: x_absolute - (pxToBase * bboxDims.width) / 2,
          y: y_absolute - (pxToBase * bboxDims.height) / 2,
          width: pxToBase * bboxDims.width,
          height: pxToBase * bboxDims.height,
        };
        console.log("debug_2011_bbox", bbox);
        const { resultImageBase64 } = await cv.keepColoredContentAsync({
          imageUrl: baseMapImageUrl,
          colors: selectedColors,
          bbox,
        });
        if (resultImageBase64) {
          const blob = base64ToBlob(resultImageBase64, "image/png");
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            dispatch(setOpencvPreviewUrl(objectUrl));
          }
        }
      } else if (opencvClickMode === "DETECT_CONTOURS") {
        const viewportBounds = editor.viewportInBase?.bounds;
        let viewportBBox;
        if (
          viewportBounds &&
          Number.isFinite(viewportBounds.x) &&
          Number.isFinite(viewportBounds.y) &&
          Number.isFinite(viewportBounds.width) &&
          Number.isFinite(viewportBounds.height)
        ) {
          viewportBBox = {
            x: viewportBounds.x,
            y: viewportBounds.y,
            width: Math.max(1, viewportBounds.width),
            height: Math.max(1, viewportBounds.height),
          };
        }

        const { points, cuts } = await cv.detectContoursAsync({
          imageUrl: baseMapImageUrl,
          x: p.x,
          y: p.y,
          viewportBBox,
        });

        console.log("debug_detectContours", { points, cuts });

        if (points && points.length >= 2) {
          const _color = theme.palette.secondary.main;
          const polyline = {
            id: nanoid(),
            baseMapId: mainBaseMap?.id,
            type: "POLYLINE",
            points: points,
            cuts: cuts && cuts.length > 0 ? cuts : undefined,
            fillColor: _color,
            strokeColor: _color,
            strokeWidth: 1,
            strokeOpacity: 0.8,
            strokeType: "SOLID",
            strokeWidthUnit: "PX",
            strokeOffset: 0,
            closeLine: true,
            fillOpacity: 0.5,
            isTemp: true,
          };

          dispatch(setTempAnnotations([polyline]));
        }
      } else if (opencvClickMode === "DETECT_STRAIGHT_LINE") {
        const viewportBounds = editor.viewportInBase?.bounds;
        let viewportBBox;
        if (
          viewportBounds &&
          Number.isFinite(viewportBounds.x) &&
          Number.isFinite(viewportBounds.y) &&
          Number.isFinite(viewportBounds.width) &&
          Number.isFinite(viewportBounds.height)
        ) {
          viewportBBox = {
            x: viewportBounds.x,
            y: viewportBounds.y,
            width: Math.max(1, viewportBounds.width),
            height: Math.max(1, viewportBounds.height),
          };
        }

        const { line, angle } = await cv.detectStraightLineAsync({
          imageUrl: baseMapImageUrl,
          x: p.x,
          y: p.y,
          viewportBBox,
        });

        if (line) {
          const color = "#00ff7f";
          const polyline = {
            id: nanoid(),
            baseMapId: mainBaseMap?.id,
            type: "POLYLINE",
            points: [
              { x: line.x1, y: line.y1 },
              { x: line.x2, y: line.y2 },
            ],
            strokeColor: color,
            strokeWidth: 3,
            strokeOpacity: 0.95,
            strokeType: "SOLID",
            strokeWidthUnit: "PX",
            closeLine: false,
            fillOpacity: 0,
            isTemp: true,
            meta: angle != null ? { angle } : undefined,
          };

          dispatch(setTempAnnotations([polyline]));
        } else {
          dispatch(setTempAnnotations([]));
        }
      } else if (opencvClickMode === "GET_ORTHO_LINES") {
        const { x_absolute, y_absolute, scaleToBaseLocal, scaleToBgLocal } = p;
        const pxToBase =
          ((typeof scaleToBaseLocal === "number"
            ? scaleToBaseLocal
            : scaleToBgLocal) || 0) / 10;

        if (pxToBase <= 0) {
          console.warn(
            "[GET_ORTHO_LINES] Unable to determine scale factor. Aborting."
          );
          return;
        }

        const bbox = {
          x: x_absolute - (pxToBase * bboxDims.width) / 2,
          y: y_absolute - (pxToBase * bboxDims.height) / 2,
          width: pxToBase * bboxDims.width,
          height: pxToBase * bboxDims.height,
        };

        const { polylines } = await cv.getHorizontalAndVerticalLinesAsync({
          imageUrl: baseMapImageUrl,
          x: x_absolute,
          y: y_absolute,
          bbox,
        });

        if (polylines?.length) {
          const color = theme.palette.secondary.main;
          const annotations = getPolylinesFromContours(
            polylines,
            color,
            mainBaseMap
          );
          dispatch(setTempAnnotations(annotations));
        }
      }
    }
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
      onContextMenu={handleContextMenu}
    >
      {/* {isMobile && <BlockEntityMarker top={16} right={16} />} */}
      <MapEditorGeneric
        isMobile={isMobile}
        baseMapImageUrl={baseMapImageUrl}
        baseMapId={mainBaseMap?.id}
        baseMapMeterByPx={mainBaseMap?.meterByPx}
        baseMapPoseInBg={basePoseInBg}
        baseMapGrayScale={baseMapGrayScale}
        baseMapOpacity={baseMapOpacity}
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
        onClickInBaseMap={handleClickInBaseMap}
        legendItems={legendItems}
        legendFormat={legendFormat}
        onLegendFormatChange={handleLegendFormatChange}
        // annotation
        newAnnotation={newAnnotation} // to display marker preview on mobile
        // polyline
        drawingPolylinePoints={drawingPolylinePoints}
        onPolylineComplete={handlePolylineComplete}
        newPolylineProps={{ ...(newAnnotation ?? {}) }}
        // rectangle
        drawingRectanglePoints={drawingRectanglePoints}
        onRectangleComplete={handleRectangleComplete}
        newRectangleProps={{ ...(newAnnotation ?? {}) }}
        // segment
        drawingSegmentPoints={drawingSegmentPoints}
        onSegmentComplete={handleSegmentComplete}
        newSegmentProps={{ ...(newAnnotation ?? {}) }}
        ref={svgRef}
        //
        centerBaseMapTriggeredAt={centerBaseMapTriggeredAt}
        zoomTo={zoomTo}
        escapeTriggeredAt={escapeTriggeredAt}
        //
        onFilesDrop={handleFilesDrop}
      />

      <PopperEditScale />
      <PopperContextMenu />
      <LayerMapEditor svgElement={svgRef.current} />
      {showScreenCursor && (
        <LayerScreenCursor containerEl={containerRef?.current} />
      )}
      <DialogDeleteSelectedItem />
      <DialogAutoSelectAnnotationTemplateToCreateEntity />
      <DialogAutoCreateEntity />
      <DialogAutoSetNewAnnotationFromFilesDrop />
      {/* <Button
        onClick={handleClick}
        sx={{ position: "absolute", bottom: 10, right: 10 }}
      >
        Print
      </Button> */}
    </Box>
  );
}
