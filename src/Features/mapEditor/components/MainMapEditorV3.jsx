import { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";


import { setAnchorPositionScale, setScaleInPx, setAngleInRad } from "../mapEditorSlice";
import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setTempAnnotations, triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setBaseMapPoseInBg, setLegendFormat } from "../mapEditorSlice";
import { setBgImageRawTextAnnotations } from "Features/bgImage/bgImageSlice";
import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { resetVersionCompare } from "Features/baseMapEditor/baseMapEditorSlice";

import useMeasure from "react-use-measure";

import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMapPose from "Features/mapEditor/hooks/useBaseMapPose";

import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useAutoResetBaseMapPose from "Features/bgImage/hooks/useAutoResetBaseMapPose";
import useAutoShowBgImage from "Features/bgImage/hooks/useAutoShowBgImage";
import useAutoBgImageRawTextAnnotations from "Features/bgImage/hooks/useAutoBgImageRawTextAnnotations";
import useHandleCommitDrawing from "../hooks/useHandleCommitDrawing";
import useHandleSplitCommit from "../hooks/useHandleSplitCommit";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useNewAnnotationType from "Features/annotations/hooks/useNewAnnotationType";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useLegendItems from "Features/legend/hooks/useLegendItems";

import { Box } from "@mui/material";

import InteractionLayer from "./InteractionLayer";
import PrintableMap from "./PrintableMap";

import UILayer from "./UILayer";
import LayerTools from "./LayerTools";
import StaticMapContent from "./StaticMapContent";
import EditedObjectLayer from "./EditedObjectLayer";
import EditedBaseMapLayer from "./EditedBaseMapLayer";
import EditedVersionLayer from "./EditedVersionLayer";
import EditedLegendLayer from "./EditedLegendLayer";
import LayerCreateBaseMap from "./LayerCreateBaseMap";

import CompareVersionSlider from "./CompareVersionSlider";
import DialogAutoCreateEntity from "Features/entities/components/DialogAutoCreateEntity";
import DialogDeleteSelectedAnnotation from "Features/annotations/components/DialogDeleteSelectedAnnotation";
import PopperEditAnnotation from "./PopperEditAnnotation";
import PopperEditAnnotations from "./PopperEditAnnotations";
import PopperEditScale from "./PopperEditScale";
import PopperContextMenu from "Features/contextMenu/component/PopperContextMenu";
import DialogAutoMigrateToMapEditorV3 from "./DialogAutoMigrateToMapEditorV3";
import useSaveTempAnnotations from "Features/mapEditor/hooks/useSaveTempAnnotations";
import PopperMapListings from "./PopperMapListings";


import { InteractionProvider } from "../context/InteractionContext";
import { SmartZoomProvider } from "App/contexts/SmartZoomContext";

import db from "App/db/db";
import editor from "App/editor";
import getPolylinePointsFromRectangle from "Features/geometry/utils/getPolylinePointsFromRectangle";
import getPolylinePointsFromCircle from "Features/geometry/utils/getPolylinePointsFromCircle";
import getDefaultCameraMatrix from "../utils/getDefaultCameraMatrix";
import getDefaultBaseMapPoseInBg from "../utils/getDefaultBaseMapPoseInBg";
import getAnnotationLabelDeltaFromDeltaPos from "Features/annotations/utils/getAnnotationLabelDeltaFromDeltaPos";
import deletePointAsync from "../services/deletePointAsync";
import duplicateAndMovePoint from "../services/duplicateAndMovePoint";
import replacePointBySnap from "../services/replacePointBySnap";
import toggleAnnotationPointType from "../services/toggleAnnotationPointType";
import commitWrapperTransform from "../services/commitWrapperTransform";
import computeWrapperBbox from "../utils/computeWrapperBbox";
import applyWrapperTransformToPoints from "../utils/applyWrapperTransformToPoints";
import removeCutAsync from "../services/removeCutAsync";
import useHandleCutSegment from "../hooks/useHandleCutSegment";
import useHandleTechnicalReturn from "../hooks/useHandleTechnicalReturn";
import useHandleSplitPolyline from "../hooks/useHandleSplitPolyline";
import useHandleSplitPolylineClick from "../hooks/useHandleSplitPolylineClick";
import useNewEntity from "Features/entities/hooks/useNewEntity";
import getSegmentAngle from "Features/geometry/utils/getSegmentAngle";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import fitBoundsToViewport from "../utils/fitBoundsToViewport";
import getAnnotationBounds from "../utils/getAnnotationBounds";
import getAnnotationTemplateSizeInPx from "Features/annotations/utils/getAnnotationTemplateSizeInPx";
import getRectangleRawPointsFromOnePoint from "Features/rectangles/utils/getRectangleRawPointsFromOnePoint";
import getImageAnnotationRectanglePointsFromOnePoint from "Features/imageAnnotations/utils/getImageAnnotationRectanglePointsFromOnePoint";
import imageUrlToPng from "Features/images/utils/imageUrlToPng";
import useSelectedNodes from "../hooks/useSelectedNodes";

const contextDimmedStyle = {
    //filter: "grayscale(100%) brightness(1.4) opacity(0.8)", // Rend gris, clair et semi-transparent
    filter: "grayscale(90%) opacity(0.8)",
    transition: "filter 0.3s ease, opacity 0.3s ease",      // Transition douce
    pointerEvents: "none" // (Optionnel) Empêche de cliquer sur le fond pendant l'édition
};

const contextNormalStyle = {
    filter: "none",
    opacity: 1,
    transition: "filter 0.3s ease, opacity 0.3s ease"
};


// Render tracker — logs which values changed between renders
const _prevValues = {};
function _track(label, value) {
    const prev = _prevValues[label];
    const serialized = typeof value === "object" ? JSON.stringify(value)?.slice(0, 80) : String(value);
    const prevSerialized = typeof prev === "object" ? JSON.stringify(prev)?.slice(0, 80) : String(prev);
    if (prevSerialized !== serialized) {
        console.log(`[debug_perf] ⚡ CHANGED: ${label}`, prevSerialized?.slice(0, 40), "→", serialized?.slice(0, 40));
        _prevValues[label] = value;
    }
    return value;
}

export default function MainMapEditorV3({ forViewerKey = "MAP" }) {
    console.log(`[debug_perf] MainMapEditorV3 RENDER forViewerKey=${forViewerKey}`);
    const dispatch = useDispatch();

    // const

    const activeContext = "BASE_MAP";

    // ref

    const [containerRef, bounds] = useMeasure();
    const interactionLayerRef = useRef(null);
    const printableMapRef = useRef(null);

    // init ref
    useEffect(() => {
        if (printableMapRef?.current) {
            editor.printableMapSvgElement = printableMapRef.current;
        }
    }, [printableMapRef?.current]);

    // data

    const projectId = useSelector((state) => state.projects.selectedProjectId);
    const listingId = useSelector((state) => state.listings.selectedListingId);
    const spriteImage = useAnnotationSpriteImage();
    _track("spriteImage", spriteImage?.src);
    const enabledDrawingMode = useSelector((state) => state.mapEditor.enabledDrawingMode);
    _track("enabledDrawingMode", enabledDrawingMode);
    const mapEditorMode = useSelector((state) => state.mapEditor.mapEditorMode);

    // Selection from new Redux slice
    const { nodes: selectedNodes, node: selectedNode } = useSelectedNodes();
    _track("selectedNodes", selectedNodes);
    _track("selectedNode", selectedNode?.nodeId);
    const selectedItems = useSelector(selectSelectedItems);
    _track("selectedItems", selectedItems);

    const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
    const grayLevelThreshold = useSelector((s) => s.baseMapEditor.grayLevelThreshold);
    const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
    const isActiveViewer = viewerKey === forViewerKey;
    const hiddenVersionIds = useSelector((s) => s.baseMapEditor.hiddenVersionIds);
    const selectedVersionId = useSelector((s) => s.baseMapEditor.selectedVersionId);
    const versionTransformOverride = useSelector((s) => s.baseMapEditor.versionTransformOverride);
    const versionCompareEnabled = useSelector((s) => s.baseMapEditor.versionCompareEnabled);
    const versionCompareId = useSelector((s) => s.baseMapEditor.versionCompareId);
    const compareSliderRef = useRef(null);

    // reset compare when leaving BASE_MAPS viewer
    useEffect(() => {
        if (viewerKey !== "BASE_MAPS" && versionCompareEnabled) {
            dispatch(resetVersionCompare());
        }
    }, [viewerKey]);

    // viewport

    const viewport = {
        w: bounds.width,
        h: bounds.height,
    };

    // bgImage

    useAutoShowBgImage();
    const bgImage = useBgImageInMapEditor();
    _track("bgImage", bgImage?.url);
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
    const showBgImageRef = useRef(showBgImage);
    useEffect(() => {
        showBgImageRef.current = showBgImage;
    }, [showBgImage]);


    // bgImage annotations

    useAutoBgImageRawTextAnnotations();
    const bgImageRawTextAnnotations = useSelector((s) => s.bgImage.bgImageRawTextAnnotations);

    function _updateBgImageRawTextAnnotation({ key, value }) {
        dispatch(setBgImageRawTextAnnotations({
            ...bgImageRawTextAnnotations,
            [key]: value,
        }));
    }

    // baseMaps

    const { value: baseMaps } = useBaseMaps();
    _track("baseMaps.length", baseMaps?.length);

    // baseMap
    const baseMap = useMainBaseMap();
    _track("baseMap", baseMap?.id);

    const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
    const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);
    const showPrintableMap = useSelector((s) => s.mapEditor.showPrintableMap);

    useEffect(() => {
        if (baseMap && bgImage) {
            const defaultBaseMapPoseInBg = getDefaultBaseMapPoseInBg({
                baseMap,
                bgImage,
            });
            console.log("=> defaultBaseMapPoseInBg", defaultBaseMapPoseInBg);
            dispatch(setBaseMapPoseInBg(defaultBaseMapPoseInBg));
        }
    }, [baseMap?.id, bgImage?.url]);

    useAutoSelectMainBaseMap();
    //useAutoResetBaseMapPose();
    const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);


    const { pose: basePose } = useBaseMapPose({
        baseMap,
        viewport,
        basePoseInBg,
    });


    // handlers
    const handleBaseMapPoseChange = (newPose) => {
        // newPose = { x, y, k, r }
        dispatch(setBaseMapPoseInBg(newPose));
    };
    const isBaseMapSelected = showBgImage && selectedNode?.nodeType === "BASE_MAP";

    // annotation

    let newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // annotations

    const openedPanel = useSelector(s => s.listings.openedPanel);
    const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";

    _track("newAnnotation", newAnnotation?.id);
    const annotations = useAnnotationsV2({
        caller: "MainMapEditorV3",
        enabled: isActiveViewer,
        withEntity: true,
        excludeListingsIds: hiddenListingsIds,
        hideBaseMapAnnotations,
        filterByMainBaseMap: true,
        filterBySelectedScope: true,
        sortByOrderIndex: true,
        excludeIsForBaseMapsListings: false,
        onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
    });

    _track("annotations.length", annotations?.length);

    // legend

    const legendItems = useLegendItems();
    const legendFormat = useSelector((s) => s.mapEditor.legendFormat);

    const isLegendSelected = showBgImage && selectedNode?.nodeType === "LEGEND";

    function handleLegendFormatChange(newFormat) {
        dispatch(setLegendFormat(newFormat));
    }


    // default camera matrix

    const defaultCameraMatrixRef = useRef(null);

    defaultCameraMatrixRef.current = getDefaultCameraMatrix({
        showBgImage,
        bgSize: bgImage?.imageSize,
        baseSize: baseMap?.getImageSize?.(),
        viewport,
        basePose,
    });


    const resetForBaseMapIdRef = useRef(null);

    useEffect(() => {


        if (defaultCameraMatrixRef.current && !showBgImage) {
            console.log("[EFFECT_RESET_CAMERA]")
            interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
            resetForBaseMapIdRef.current = baseMap?.id;
        }

    }, [
        //showBgImage
        basePose?.k,
        baseMap?.id,
        bgImage?.imageSize?.width,
        viewport?.w,
        baseMap?.id,
    ]);

    // effect - fit to selectedNode

    useEffect(() => {
        if (selectedNode?.origin !== "LISTING") return;
        const annotation = annotations.find(a => a.id === selectedNode?.nodeId);
        if (annotation && annotation.baseMapId === baseMap?.id) {
            const bounds = getAnnotationBounds(annotation, basePose);
            if (bounds) {
                const targetMatrix = fitBoundsToViewport(bounds, viewport, 260);
                interactionLayerRef.current?.setCameraMatrix(targetMatrix);
            }
        }
    }, [baseMap?.id, selectedNode?.nodeId, annotations?.length])


    // handler - commit drawing

    _track("legendItems.length", legendItems?.length);
    const newEntity = useNewEntity();
    _track("newEntity", newEntity);
    const { handleDrawingCommit: _handleCommitDrawing, handleBulkCommit } = useHandleCommitDrawing({ newEntity });
    const { handleSplitCommit, handlePolylineSplitAtVertex } = useHandleSplitCommit({ newEntity });
    const handleCutSegment = useHandleCutSegment({ newEntity });
    const handleTechnicalReturn = useHandleTechnicalReturn({ annotations, newEntity });
    const { handleSplitPolylineClick, handleSplitPolylineEnter, resetSplitPolyline } = useHandleSplitPolyline({ newEntity });
    const { handleSplitPolylineClickPoint } = useHandleSplitPolylineClick({ newEntity });
    const saveTempAnnotations = useSaveTempAnnotations();

    const handleCommitDrawing = (rawPoints, options) => {

        if (rawPoints.length === 1 && type === "RECTANGLE") {

            const imageSize = getAnnotationTemplateSizeInPx({
                size: newAnnotation.size,
                sizeUnit: newAnnotation.sizeUnit,
                meterByPx: baseMap?.meterByPx,
            })
            const width = imageSize.width;
            const height = imageSize.height;
            rawPoints = getRectangleRawPointsFromOnePoint({
                point: rawPoints[0],
                width,
                height,
            })

            options = { ...options ?? {}, drawRectangle: true }
        }

        if (rawPoints.length === 1 && type === "IMAGE") {
            const points = getImageAnnotationRectanglePointsFromOnePoint({
                annotation: newAnnotation,
                baseMapMeterByPx: baseMap?.getMeterByPx(),
                point: rawPoints[0],
            })
            rawPoints = points;
            options = { ...options ?? {}, drawRectangle: true }
        }
        _handleCommitDrawing(rawPoints, options)
    }

    // handler - commit points from drop_fill

    const handleCommitPointsFromSurfaceDrop = async ({ points, cuts }) => {
        const annotation = {
            ...newAnnotation,
            baseMapId: baseMap.id,
            points,
            cuts,
        };
        await saveTempAnnotations([annotation]);
    }

    // handlers - image drop

    const handleCommitImageDrop = async (droppedImage) => {
        let imageFile;
        try {
            imageFile = await imageUrlToPng({ url: droppedImage.imageUrl, name: "image.png" })
        } catch (error) {
            console.error("Error converting URL to PNG:", error);
        }
        const images = [{ file: imageFile, imageUrlRemote: droppedImage.imageUrl }]
        _handleCommitDrawing([{ x: droppedImage.x, y: droppedImage.y }], { newAnnotation: { type: "MARKER", images }, skipTemplateCreation: true })
    }

    // handlers - rectangle

    const handleCommitDrawingFromRectangle = (points, event) => {
        if (["POLYGON", "POLYLINE"].includes(type) && points.length === 2) {
            points = getPolylinePointsFromRectangle(points)
        }
        const options = {}
        if (type === "POLYLINE") options.closeLine = true;
        if (type === "RECTANGLE") {
            options.drawRectangle = true;
        }
        handleCommitDrawing(points, options)
    }
    // handlers - circle

    const handleCommitDrawingFromCircle = (points) => {
        const circlePoints = getPolylinePointsFromCircle(points);
        const options = {};
        if (type === "POLYLINE") options.closeLine = true;
        handleCommitDrawing(circlePoints, options);
    }

    // handlers - measure

    const handleMeasureCommit = (points, event) => {
        console.log("handleMeasureCommit", points)
        const anchorPositionScale = { x: event.clientX, y: event.clientY }
        dispatch(setAnchorPositionScale(anchorPositionScale))
        dispatch(setTempAnnotations([{
            id: nanoid(),
            type: "POLYLINE",
            points,
            outOfSnapScope: true,
            baseMapId: baseMap.id,
            projectId,
        }]))
        const p1 = points[0];
        const p2 = points[points.length - 1];
        const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const angle = getSegmentAngle(p1, p2);

        console.log("distance", distance)
        dispatch(setScaleInPx(distance));
        dispatch(setAngleInRad(angle));

        dispatch(setEnabledDrawingMode(null))
    };

    // handlers 

    const handleResetCamera = () => {
        interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
    };

    // handlers - move point

    const handlePointMoveCommit = async (pointId, newPos) => {
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        // Find annotations that reference this point and have rotation metadata.
        // Moving a vertex "bakes in" the rotation for that point, so rotation
        // metadata is no longer valid and must be cleared.
        const rotatedAnns = annotations?.filter((ann) => {
            if (!ann.rotation && !ann.rotationCenter) return false;
            const inMain = ann.points?.some((pt) => pt.id === pointId);
            const inCuts = ann.cuts?.some((cut) => cut.points?.some((pt) => pt.id === pointId));
            return inMain || inCuts;
        }) ?? [];

        await db.transaction("rw", db.points, db.annotations, async () => {
            const ops = [
                db.points.update(pointId, {
                    x: newPos.x / imageSize.width,
                    y: newPos.y / imageSize.height,
                }),
            ];
            for (const ann of rotatedAnns) {
                ops.push(
                    db.annotations.update(ann.id, {
                        rotation: 0,
                        rotationCenter: null,
                    })
                );
            }
            await Promise.all(ops);
        });
    };

    const handleDuplicateAndMovePoint = async ({ originalPointId, annotationId, newPos }) => {
        const imageSize = baseMap?.getImageSize?.();
        await duplicateAndMovePoint({ originalPointId, annotationId, newPos, imageSize, annotations });
    };

    const handlePointSnapReplace = async ({ oldPointId, snapPointId, affectedAnnotationIds }) => {
        await replacePointBySnap({ oldPointId, snapPointId, affectedAnnotationIds, annotations });
    };

    const handleToggleAnnotationPointType = async ({ annotationId, pointId }) => {
        await toggleAnnotationPointType({ annotationId, pointId });
    };

    // handlers - split line

    const handleSegmentSplit = async (segment) => {
        console.log("splitSegment", segment);
        const { segmentStartId, segmentEndId, x, y } = segment;
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        const newPointId = nanoid();

        // 1. Create the new physical point object
        const newPointEntity = {
            id: newPointId,
            x: x / imageSize.width,
            y: y / imageSize.height,
            baseMapId: baseMap.id,
            projectId,
            listingId,
            // ...other default point props
        };

        const newPointObject = { id: newPointId, type: 'square' };

        // Helper function to try inserting point in a specific list of points
        // Returns the new array if insertion happened, or null if segment not found
        const insertPointInPath = (pointsList) => {
            if (!pointsList || pointsList.length < 2) return null;

            for (let i = 0; i < pointsList.length; i++) {
                const currentPt = pointsList[i];
                const nextPt = pointsList[(i + 1) % pointsList.length]; // Handle closed loop

                // CASE 1: Sequence A -> B
                if (currentPt.id === segmentStartId && nextPt.id === segmentEndId) {
                    const newPoints = [...pointsList];
                    newPoints.splice(i + 1, 0, newPointObject);
                    return newPoints;
                }

                // CASE 2: Sequence B -> A (Reverse direction)
                if (currentPt.id === segmentEndId && nextPt.id === segmentStartId) {
                    const newPoints = [...pointsList];
                    newPoints.splice(i + 1, 0, newPointObject);
                    return newPoints;
                }
            }
            return null;
        };

        // 2. Find ALL annotations affected by this segment (Main contour OR Cuts)
        const annotationsToUpdate = [];

        annotations.forEach(ann => {
            let hasChanges = false;
            const updates = { id: ann.id };

            // A. Check Main Contour
            const newMainPoints = insertPointInPath(ann.points);
            if (newMainPoints) {
                updates.points = newMainPoints;
                hasChanges = true;
            }

            // B. Check Cuts (Holes)
            if (ann.cuts && Array.isArray(ann.cuts)) {
                let cutsChanged = false;

                // On mappe sur les cuts pour voir si l'un d'eux contient le segment
                const newCuts = ann.cuts.map(cut => {
                    const newCutPoints = insertPointInPath(cut.points);

                    if (newCutPoints) {
                        cutsChanged = true;
                        // On retourne le cut mis à jour
                        return { ...cut, points: newCutPoints };
                    }
                    // Sinon on retourne le cut tel quel
                    return cut;
                });

                if (cutsChanged) {
                    updates.cuts = newCuts;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                annotationsToUpdate.push(updates);
            }
        });

        // 3. Execute Database Operations
        if (annotationsToUpdate.length > 0) {
            try {
                // A. Add the new point
                await db.points.add(newPointEntity);

                // B. Update annotations (Updating 'points' or 'cuts' or both)
                await Promise.all(
                    annotationsToUpdate.map(update => {
                        // On extrait l'ID et on passe le reste (points et/ou cuts) à l'update
                        const { id, ...changes } = update;
                        return db.annotations.update(id, changes);
                    })
                );

                console.log("Segment split successfully committed (Main or Cut).");
            } catch (error) {
                console.error("Failed to split segment:", error);
            }
        }
    };

    // Insert an existing point into a target annotation's segment (projection snap during drag)
    const handleProjectionSnapInsert = async ({ pointId, annotationId, segmentStartId, segmentEndId, cutIndex }) => {
        const ann = await db.annotations.get(annotationId);
        if (!ann) return;

        const insertPointInPath = (pointsList) => {
            if (!pointsList || pointsList.length < 2) return null;
            for (let i = 0; i < pointsList.length; i++) {
                const cur = pointsList[i];
                const next = pointsList[(i + 1) % pointsList.length];
                if ((cur.id === segmentStartId && next.id === segmentEndId) ||
                    (cur.id === segmentEndId && next.id === segmentStartId)) {
                    // Skip arc segments to preserve arc geometry
                    if (cur.type === 'circle' || next.type === 'circle') return null;
                    const newPoints = [...pointsList];
                    newPoints.splice(i + 1, 0, { id: pointId, type: 'square' });
                    return newPoints;
                }
            }
            return null;
        };

        const changes = {};
        if (cutIndex != null && ann.cuts?.[cutIndex]) {
            const result = insertPointInPath(ann.cuts[cutIndex].points);
            if (result) {
                const newCuts = ann.cuts.map((c, i) => i === cutIndex ? { ...c, points: result } : c);
                changes.cuts = newCuts;
            }
        } else {
            const result = insertPointInPath(ann.points);
            if (result) changes.points = result;
        }

        if (Object.keys(changes).length > 0) {
            await db.annotations.update(annotationId, changes);
        }
    };

    const handleAnnotationMoveCommit = async (annotationId, deltaPos, partType, localPos) => {
        const imageSize = baseMap?.getImageSize?.();
        if (!imageSize) return;

        // WRAPPER (group transform for point-based annotations)
        if (annotationId === "wrapper") {
            const POINT_BASED_TYPES = ["POLYLINE", "POLYGON", "STRIP"];
            const wrapperAnnotationIds = selectedItems
                .filter(item => item.type === "NODE" && POINT_BASED_TYPES.includes(item.annotationType))
                .map(item => item.nodeId);
            const wrapperAnnotations = annotations?.filter(a => wrapperAnnotationIds.includes(a.id)) ?? [];
            if (wrapperAnnotations.length === 0) return;

            // For ROTATE with existing rotation, use canonical bbox (consistent pivot)
            const cumulativeRotation = wrapperAnnotations[0]?.rotation ?? 0;
            const rotationCenter = wrapperAnnotations[0]?.rotationCenter ?? null;
            const wrapperBbox = (partType === "ROTATE" && cumulativeRotation !== 0 && rotationCenter)
                ? computeWrapperBbox(wrapperAnnotations, cumulativeRotation, rotationCenter)
                : computeWrapperBbox(wrapperAnnotations);
            if (!wrapperBbox) return;

            const pointUpdates = applyWrapperTransformToPoints({
                annotations: wrapperAnnotations,
                wrapperBbox,
                deltaPos,
                partType,
            });

            await commitWrapperTransform({
                selectedAnnotationIds: wrapperAnnotationIds,
                allAnnotations: annotations,
                pointUpdates,
                imageSize,
                rotationDelta: partType === "ROTATE" ? deltaPos.x : null,
                wrapperBbox,
                moveDelta: (!partType || partType === "MOVE") ? deltaPos : null,
                isResize: partType?.startsWith("RESIZE_"),
            });

            dispatch(triggerAnnotationsUpdate());
            return;
        }

        // LABEL
        if (annotationId.startsWith("label::")) {
            const annotation = annotations.find(a => a.id === annotationId.replace("label::", ""));
            console.log("handleAnnotationMoveCommit", annotationId, annotation);
            if (!annotation) return;

            else if (annotation.type === "MARKER" && partType === "TARGET") {
                const point = await db.points.get(annotation.point.id);
                const x = point.x + deltaPos.x / imageSize.width;
                const y = point.y + deltaPos.y / imageSize.height;
                console.log("save_point", point.id, { x, y });
                await db.points.update(point.id, { x, y });
            }


            const labelDelta = getAnnotationLabelDeltaFromDeltaPos(annotation, deltaPos, partType);
            await db.annotations.update(annotation.id, { labelDelta });


        }

        // OTHER ANNOTATIONS
        else {

            const annotation = annotations.find(a => a.id === annotationId);
            if (!annotation) return;


            console.log("handleAnnotationMoveCommit", annotationId, annotation);

            if (annotation.type === "MARKER" || annotation.type === "POINT") {
                const point = await db.points.get(annotation.point.id);
                const x = point.x + deltaPos.x / imageSize.width;
                const y = point.y + deltaPos.y / imageSize.height;
                console.log("save_point", point.id, { x, y });
                await db.points.update(point.id, { x, y });
            }

            else if (annotation.type === "LABEL") {
                const { targetPoint, labelPoint } = annotation;

                const updates = {};

                // 1. Déplacement de la cible (Target) uniquement
                if (partType === 'TARGET') {
                    updates.targetPoint = {
                        x: (targetPoint.x + deltaPos.x) / imageSize.width,
                        y: (targetPoint.y + deltaPos.y) / imageSize.height
                    };
                }
                // 2. Déplacement du Label uniquement
                else if (partType === 'LABEL_BOX') {
                    updates.labelPoint = {
                        x: (labelPoint.x + deltaPos.x) / imageSize.width,
                        y: (labelPoint.y + deltaPos.y) / imageSize.height
                    };
                }
                // 3. Cas général (Déplacement global)
                else {
                    updates.targetPoint = {
                        x: (targetPoint.x + deltaPos.x) / imageSize.width,
                        y: (targetPoint.y + deltaPos.y) / imageSize.height
                    };
                    updates.labelPoint = {
                        x: (labelPoint.x + deltaPos.x) / imageSize.width,
                        y: (labelPoint.y + deltaPos.y) / imageSize.height
                    };
                }

                await db.annotations.update(annotation.id, updates);
            }

            // --- IMAGE : resize avec aspect ratio contraint ---
            else if (annotation.type === "IMAGE") {
                const bgW = imageSize.width;
                const bgH = imageSize.height;

                const currentBBox = annotation.bbox;
                const currentRotation = annotation.rotation ?? 0;

                const cx = currentBBox.x;
                const cy = currentBBox.y;
                const cw = currentBBox.width;
                const ch = currentBBox.height;

                const aspectRatio = cw / ch;

                let nx = cx;
                let ny = cy;
                let nw = cw;
                let nh = ch;

                const updates = {};

                if (partType === "ROTATE") {
                    const sensitivity = 1;
                    let newRotation = (currentRotation + deltaPos.x * sensitivity) % 360;
                    if (newRotation < 0) newRotation += 360;
                    updates.rotation = newRotation;
                }

                else if (partType && partType.startsWith("RESIZE_")) {
                    const handle = partType.replace("RESIZE_", "");

                    // A. COINS (Fixe le coin opposé, aspect ratio contraint)
                    if (handle === "SE") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                    }
                    else if (handle === "SW") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                    }
                    else if (handle === "NE") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                        ny = cy + (ch - nh);
                    }
                    else if (handle === "NW") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                        ny = cy + (ch - nh);
                    }

                    // B. BORDS
                    else if (handle === "E") {
                        nw = cw + deltaPos.x;
                        nh = nw / aspectRatio;
                        ny = cy + (ch - nh) / 2;
                    }
                    else if (handle === "W") {
                        nw = cw - deltaPos.x;
                        nh = nw / aspectRatio;
                        nx = cx + (cw - nw);
                        ny = cy + (ch - nh) / 2;
                    }
                    else if (handle === "S") {
                        nh = ch + deltaPos.y;
                        nw = nh * aspectRatio;
                        nx = cx + (cw - nw) / 2;
                    }
                    else if (handle === "N") {
                        nh = ch - deltaPos.y;
                        nw = nh * aspectRatio;
                        ny = cy + (ch - nh);
                        nx = cx + (cw - nw) / 2;
                    }

                    // Sécurité min 20px
                    if (nw < 20) {
                        nw = 20;
                        nh = nw / aspectRatio;
                        if (handle.includes("W")) nx = cx + (cw - nw);
                        if (handle.includes("N")) ny = cy + (ch - nh);
                        if (handle === "N" || handle === "S") nx = cx + (cw - nw) / 2;
                        if (handle === "E" || handle === "W") ny = cy + (ch - nh) / 2;
                    }

                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                // DÉPLACEMENT (MOVE)
                else {
                    nx = cx + deltaPos.x;
                    ny = cy + deltaPos.y;
                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                console.log("save_image (bbox)", annotation.id, updates);
                await db.annotations.update(annotation.id, updates);
            }

            // --- RECTANGLE : resize libre par dimension, contraintes template ---
            else if (annotation.type === "RECTANGLE") {
                const bgW = imageSize.width;
                const bgH = imageSize.height;

                const currentBBox = annotation.bbox;
                const currentRotation = annotation.rotation ?? 0;

                const cx = currentBBox.x;
                const cy = currentBBox.y;
                const cw = currentBBox.width;
                const ch = currentBBox.height;

                // Contraintes template
                const templateSize = annotation.annotationTemplateProps?.size;
                const lockedWidth = templateSize?.width != null;
                const lockedHeight = templateSize?.height != null;

                let nx = cx;
                let ny = cy;
                let nw = cw;
                let nh = ch;

                const updates = {};

                if (partType === "ROTATE") {
                    const sensitivity = 1;
                    let newRotation = (currentRotation + deltaPos.x * sensitivity) % 360;
                    if (newRotation < 0) newRotation += 360;
                    updates.rotation = newRotation;
                }

                else if (partType && partType.startsWith("RESIZE_")) {
                    const handle = partType.replace("RESIZE_", "");

                    // Deltas libres par dimension, verrouillés si template contraint
                    const dx = lockedWidth ? 0 : deltaPos.x;
                    const dy = lockedHeight ? 0 : deltaPos.y;

                    if (handle === "SE") {
                        nw = cw + dx;
                        nh = ch + dy;
                    }
                    else if (handle === "SW") {
                        nw = cw - dx;
                        nh = ch + dy;
                        nx = cx + dx;
                    }
                    else if (handle === "NE") {
                        nw = cw + dx;
                        nh = ch - dy;
                        ny = cy + dy;
                    }
                    else if (handle === "NW") {
                        nw = cw - dx;
                        nh = ch - dy;
                        nx = cx + dx;
                        ny = cy + dy;
                    }

                    // Sécurité min 20px
                    if (nw < 20) {
                        nw = 20;
                        if (handle.includes("W")) nx = cx + (cw - 20);
                    }
                    if (nh < 20) {
                        nh = 20;
                        if (handle.includes("N")) ny = cy + (ch - 20);
                    }

                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                // DÉPLACEMENT (MOVE)
                else {
                    nx = cx + deltaPos.x;
                    ny = cy + deltaPos.y;
                    updates.bbox = {
                        x: nx / bgW,
                        y: ny / bgH,
                        width: nw / bgW,
                        height: nh / bgH
                    };
                }

                console.log("save_rectangle (bbox)", annotation.id, updates);
                await db.annotations.update(annotation.id, updates);
            }
        }

        // Notifier useLiveQuery du changement pour que la convergence optimistic overlay fonctionne
        dispatch(triggerAnnotationsUpdate());
    };


    // handlers - text value change

    const handleTextValueChange = ({ annotationId, textValue }) => {
        _updateBgImageRawTextAnnotation({
            key: annotationId,
            value: textValue,
        });
    };

    // handlers - delete point

    const handleDeletePoint = async ({ annotationId, pointId }) => {
        console.log("handleDeletePoint", annotationId, pointId, annotations);
        await deletePointAsync({ pointId, annotationId, annotations });
    };

    // handlers - hide segments
    const handleHideSegment = async ({ annotationId, segmentIndex }) => {
        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) return;

        // On récupère la liste actuelle ou on initialise
        const currentHidden = annotation.hiddenSegmentsIdx || [];

        // On évite les doublons
        let newHidden = [...currentHidden];
        if (!currentHidden.includes(segmentIndex)) {
            newHidden = [...currentHidden, segmentIndex]
        } else {
            newHidden = currentHidden.filter(idx => idx !== segmentIndex)
        }
        // Update DB
        await db.annotations.update(annotationId, { hiddenSegmentsIdx: newHidden });
    };

    const handleRemoveCut = async ({ annotationId, cutIndex }) => {
        await removeCutAsync({ annotationId, cutIndex, annotations });
    };

    // snapping

    //const isSnappingEnabled = enabledDrawingMode || !selectedNode;
    const isSnappingEnabled =
        enabledDrawingMode ||
        !Boolean(selectedNode) ||
        (Boolean(selectedNode) && selectedNode.nodeType === "ANNOTATION");



    // helper - sizeVariant

    const sizeVariant = showBgImage ? "FIXED_IN_CONTAINER_PARENT" : "FIXED_IN_SCREEN";

    // render

    //if (!baseMap) return <ScreenNoBaseMap />;

    useEffect(() => {
        if (baseMaps?.length === 0) {
            dispatch(setShowCreateBaseMapSection(true));
        }
    }, [baseMaps?.length]);

    return (
        <SmartZoomProvider>
        <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: "relative", bgcolor: "background.default" }}>
            <InteractionProvider>
                <InteractionLayer
                    isActiveViewer={isActiveViewer}
                    enabledDrawingMode={enabledDrawingMode}
                    selectedNode={selectedNode}
                    selectedNodes={selectedNodes}
                    newAnnotation={newAnnotation}
                    ref={interactionLayerRef}
                    showBgImage={showBgImage}
                    onCommitDrawing={({ points, event, cutHostId, options }) => {
                        // Bulk commit for DETECT_SIMILAR_POLYLINES
                        if (options?.bulkPolylines) {
                            return handleBulkCommit(options.bulkPolylines, options);
                        }
                        if (type === "SPLIT") {
                            return handleSplitCommit(points);
                        }
                        else if (cutHostId) {
                            if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode) && points.length === 2) points = getPolylinePointsFromRectangle(points)
                            else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) points = getPolylinePointsFromCircle(points)
                            return handleCommitDrawing(points, { cutHostId });
                        }
                        else if (enabledDrawingMode === 'MEASURE') {
                            return handleMeasureCommit(points, event);
                        }
                        else if (["RECTANGLE", "POLYLINE_RECTANGLE", "POLYGON_RECTANGLE", "CUT_RECTANGLE"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromRectangle(points, event);
                        }
                        else if (["CIRCLE", "POLYLINE_CIRCLE", "POLYGON_CIRCLE", "CUT_CIRCLE"].includes(enabledDrawingMode)) {
                            return handleCommitDrawingFromCircle(points);
                        }
                        else {
                            console.log("handleCommitDrawing - points", points);
                            return handleCommitDrawing(points, options);
                        }
                    }}
                    onCommitSplitAtVertex={handlePolylineSplitAtVertex}
                    onCommitImageDrop={handleCommitImageDrop}
                    onCommitPointsFromSurfaceDrop={handleCommitPointsFromSurfaceDrop}
                    baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                    baseMapImageScale={baseMap?.getImageScale()}
                    baseMapImageOffset={baseMap?.getImageOffset()}
                    baseMapImageUrl={baseMap?.getUrl()}
                    baseMapMainAngleInDeg={baseMap?.mainAngleInDeg}
                    basePose={basePose}
                    onBaseMapPoseChange={handleBaseMapPoseChange}
                    activeContext={activeContext}
                    annotations={annotations}
                    onPointMoveCommit={handlePointMoveCommit}
                    onPointSnapReplace={handlePointSnapReplace}
                    onToggleAnnotationPointType={handleToggleAnnotationPointType}
                    onPointDuplicateAndMoveCommit={handleDuplicateAndMovePoint}
                    onDeletePoint={handleDeletePoint}
                    onHideSegment={handleHideSegment}
                    onRemoveCut={handleRemoveCut}
                    onAnnotationMoveCommit={handleAnnotationMoveCommit}
                    onSegmentSplit={handleSegmentSplit}
                    onCutSegment={handleCutSegment}
                    onTechnicalReturn={handleTechnicalReturn}
                    onSplitPolylineClick={handleSplitPolylineClick}
                    onSplitPolylineEnter={handleSplitPolylineEnter}
                    onSplitPolylineReset={resetSplitPolyline}
                    onSplitPolylineClickPoint={handleSplitPolylineClickPoint}
                    onProjectionSnapInsert={handleProjectionSnapInsert}
                    snappingEnabled={isSnappingEnabled}
                    baseMapMeterByPx={baseMap?.getMeterByPx()}
                    legendFormat={legendFormat}
                    onLegendFormatChange={handleLegendFormatChange}
                    onCameraChangeExternal={() => compareSliderRef.current?.updateClipRect?.()}
                >
                    <g style={(selectedNode || selectedNodes?.length > 0) ? contextDimmedStyle : contextNormalStyle}>
                        <StaticMapContent
                            selectedNode={selectedNode}
                            selectedNodes={selectedNodes}
                            bgImageUrl={bgImage?.url}
                            bgImageSize={bgImage?.imageSize}
                            showBgImage={showBgImage}
                            basePose={basePose}
                            baseMapImageUrl={baseMap?.getUrl()}
                            baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                            annotations={annotations}
                            legendItems={legendItems}
                            legendFormat={legendFormat}
                            sizeVariant={sizeVariant}
                            isEditingBaseMap={isBaseMapSelected}
                            baseMapMeterByPx={baseMap?.meterByPx}
                            baseMapImageScale={baseMap?.getImageScale?.() ?? 1}
                            opacity={baseMapOpacity}
                            grayScale={baseMapGrayScale}
                            grayLevelThreshold={grayLevelThreshold}
                            versions={baseMap?.versions}
                            hiddenVersionIds={hiddenVersionIds}
                            selectedVersionId={selectedVersionId}
                            isBaseMapsViewer={viewerKey === "BASE_MAPS"}
                            isEditingVersion={viewerKey === "BASE_MAPS" && !!selectedVersionId && showBgImage}
                            versionCompareEnabled={versionCompareEnabled}
                            versionCompareId={versionCompareId}
                        />
                    </g>
                    {/* 2. LAYER ÉDITION BASEMAP (Exclusif) */}
                    {isBaseMapSelected && (
                        <EditedBaseMapLayer
                            basePose={basePose}
                            baseMapImageUrl={baseMap?.getUrl()}
                            baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                        />
                    )}
                    {/* 2b. LAYER ÉDITION VERSION (BASE_MAPS viewer only) */}
                    {viewerKey === "BASE_MAPS" && selectedVersionId && showBgImage && (() => {
                        const selectedVersion = baseMap?.versions?.find(v => v.id === selectedVersionId);
                        if (!selectedVersion) return null;
                        const vUrl = selectedVersion.image?.imageUrlClient ?? selectedVersion.image?.imageUrlRemote;
                        const vSize = selectedVersion.image?.imageSize;
                        const vTransform = versionTransformOverride?.versionId === selectedVersionId
                            ? versionTransformOverride.transform
                            : selectedVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };
                        return (
                            <EditedVersionLayer
                                basePose={basePose}
                                versionTransform={vTransform}
                                versionImageUrl={vUrl}
                                versionImageSize={vSize}
                                versionId={selectedVersionId}
                                baseMapId={baseMap?.id}
                            />
                        );
                    })()}
                    {isLegendSelected && (
                        <EditedLegendLayer
                            legendItems={legendItems}
                            spriteImage={spriteImage}
                            legendFormat={legendFormat}
                        />
                    )}

                    {!isBaseMapSelected && <EditedObjectLayer
                        basePose={basePose}
                        annotations={annotations}
                        spriteImage={spriteImage}
                        selectedNode={selectedNode}
                        selectedNodes={selectedNodes}
                        baseMapMeterByPx={baseMap?.getMeterByPx()} // If needed for width calc
                        baseMapImageScale={baseMap?.getImageScale?.() ?? 1}
                        onTextValueChange={handleTextValueChange}
                    />}


                </InteractionLayer>

                <UILayer mapController={interactionLayerRef.current} onResetCamera={handleResetCamera} viewport={viewport} />

            </InteractionProvider>

            {/* Version compare slider overlay */}
            {versionCompareEnabled && versionCompareId && (
                <CompareVersionSlider
                    ref={compareSliderRef}
                    getCameraMatrix={() => interactionLayerRef.current?.getCameraMatrix?.()}
                    basePose={basePose}
                    containerBounds={{ width: bounds.width, height: bounds.height }}
                    activeVersionLabel={baseMap?.getActiveVersion?.()?.label}
                    comparedVersionLabel={baseMap?.versions?.find(v => v.id === versionCompareId)?.label}
                />
            )}

            {showPrintableMap && (
                <PrintableMap
                    ref={printableMapRef}
                    bgImageUrl={bgImage?.url}
                    bgImageSize={bgImage?.imageSize}
                    showBgImage={showBgImage}
                    basePose={basePose}
                    baseMapImageUrl={baseMap?.getUrl()}
                    baseMapImageSize={baseMap?.getImageSize?.() || baseMap?.getImageSize?.()}
                    annotations={annotations}
                    spriteImage={spriteImage}
                    baseMapMeterByPx={baseMap?.getMeterByPx()}
                    legendItems={legendItems}
                    legendFormat={legendFormat}
                    versions={baseMap?.versions}
                />
            )}

            <DialogDeleteSelectedAnnotation />
            <DialogAutoCreateEntity />
            <PopperEditAnnotation viewerKey={forViewerKey} />
            <PopperEditAnnotations viewerKey={forViewerKey} allAnnotations={annotations} />
            <PopperEditScale viewerKey={forViewerKey} />
            <PopperContextMenu />

            {/* <DialogAutoMigrateToMapEditorV3 /> */}

            <LayerTools />
            <LayerCreateBaseMap />

            {!versionCompareEnabled && <PopperMapListings />}
        </Box>
        </SmartZoomProvider>
    );
}