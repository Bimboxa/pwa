import { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";


import { setAnchorPositionScale, setScaleInPx } from "../mapEditorSlice";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";
import { setBaseMapPoseInBg, setLegendFormat } from "../mapEditorSlice";
import { setTempAnnotationToolbarPosition } from "Features/mapEditor/mapEditorSlice";
import { setBgImageRawTextAnnotations } from "Features/bgImage/bgImageSlice";

import useMeasure from "react-use-measure";

import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMapPose from "Features/mapEditor/hooks/useBaseMapPose";

import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useAutoResetBaseMapPose from "Features/bgImage/hooks/useAutoResetBaseMapPose";
import useAutoShowBgImage from "Features/bgImage/hooks/useAutoShowBgImage";
import useAutoBgImageRawTextAnnotations from "Features/bgImage/hooks/useAutoBgImageRawTextAnnotations";
import useHandleCommitDrawing from "../hooks/useHandleCommitDrawing";
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
import EditedLegendLayer from "./EditedLegendLayer";

import DialogAutoCreateEntity from "Features/entities/components/DialogAutoCreateEntity";
import DialogDeleteSelectedAnnotation from "Features/annotations/components/DialogDeleteSelectedAnnotation";
import PopperEditAnnotation from "./PopperEditAnnotation";
import PopperEditScale from "./PopperEditScale";
import PopperContextMenu from "Features/contextMenu/component/PopperContextMenu";
import DialogAutoMigrateToMapEditorV3 from "./DialogAutoMigrateToMapEditorV3";
import PopperSaveTempAnnotations from "Features/mapEditor/components/PopperSaveTempAnnotations";
import ScreenNoBaseMap from "./ScreenNoBaseMap";

import { InteractionProvider } from "../context/InteractionContext";

import db from "App/db/db";
import editor from "App/editor";
import getPolylinePointsFromRectangle from "Features/geometry/utils/getPolylinePointsFromRectangle";
import getDefaultCameraMatrix from "../utils/getDefaultCameraMatrix";
import getDefaultBaseMapPoseInBg from "../utils/getDefaultBaseMapPoseInBg";
import getAnnotationLabelDeltaFromDeltaPos from "Features/annotations/utils/getAnnotationLabelDeltaFromDeltaPos";
import deletePointAsync from "../services/deletePointAsync";
import duplicateAndMovePoint from "../services/duplicateAndMovePoint";
import removeCutAsync from "../services/removeCutAsync";

export default function MainMapEditorV3() {
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
    const enabledDrawingMode = useSelector((state) => state.mapEditor.enabledDrawingMode);
    const selectedNode = useSelector((state) => state.mapEditor.selectedNode);
    const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

    // viewport

    const viewport = {
        w: bounds.width,
        h: bounds.height,
    };

    // bgImage

    useAutoShowBgImage();
    const bgImage = useBgImageInMapEditor();
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


    // baseMap
    const baseMap = useMainBaseMap();

    const baseMapOpacity = useSelector((s) => s.mapEditor.baseMapOpacity);
    const baseMapGrayScale = useSelector((s) => s.mapEditor.baseMapGrayScale);

    useEffect(() => {
        if (baseMap && bgImage) {
            const defaultBaseMapPoseInBg = getDefaultBaseMapPoseInBg({
                baseMap,
                bgImage,
            });
            dispatch(setBaseMapPoseInBg(defaultBaseMapPoseInBg));
        }
    }, [baseMap?.getUrl(), bgImage?.url]);

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

    const annotations = useAnnotationsV2({ withEntity: true, excludeListingsIds: hiddenListingsIds });

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
        baseSize: baseMap?.getImageSize(),
        viewport,
        basePose,
    });


    useEffect(() => {
        console.log("[EFFECT_RESET_CAMERA]")
        if (defaultCameraMatrixRef.current && !showBgImage) {
            interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
        }
    }, [
        //showBgImage
        basePose?.k,
        baseMap?.getImageSize()?.width,
        bgImage?.imageSize?.width,
        viewport?.w,
        //showBgImage,
    ]);


    // handler - commit drawing

    const handleCommitDrawing = useHandleCommitDrawing();

    // handler - commit points from drop_fill

    const handleCommitPointsFromDropFill = ({ points, cuts, screenPos }) => {
        const tempAnnotation = {
            ...newAnnotation,
            baseMapId: baseMap.id,
            points,
            cuts,
            id: "temp",
            screenPos,
        };
        dispatch(setTempAnnotations([tempAnnotation]));
        dispatch(setTempAnnotationToolbarPosition(screenPos));
        dispatch(setSelectedAnnotationId("temp"));
    }

    // handlers - rectangle

    const handleCommitDrawingFromRectangle = (points, event) => {
        if (["POLYGON", "POLYLINE"].includes(type)) {
            points = getPolylinePointsFromRectangle(points)
        }
        const options = {}
        if (type === "POLYLINE") options.closeLine = true;
        handleCommitDrawing(points, options)
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
        console.log("distance", distance)
        dispatch(setScaleInPx(distance));
    };

    // handlers 

    const handleResetCamera = () => {
        interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrixRef.current);
    };

    // handlers - move point

    const handlePointMoveCommit = (pointId, newPos) => {
        const imageSize = baseMap?.image?.imageSize;
        //dispatch(updatePoint({ id: pointId, ...newPos }));
        db.points.update(pointId, { x: newPos.x / imageSize.width, y: newPos.y / imageSize.height });
    };

    const handleDuplicateAndMovePoint = async ({ originalPointId, annotationId, newPos }) => {
        const imageSize = baseMap?.image?.imageSize;
        await duplicateAndMovePoint({ originalPointId, annotationId, newPos, imageSize, annotations });
    };

    // handlers - split line

    const handleSegmentSplit = async (segment) => {
        console.log("splitSegment", segment);
        const { segmentStartId, segmentEndId, x, y } = segment;
        const imageSize = baseMap?.image?.imageSize;
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

    const handleAnnotationMoveCommit = async (annotationId, deltaPos, partType, localPos) => {
        const imageSize = baseMap?.image?.imageSize;
        if (!imageSize) return;

        if (annotationId.startsWith("label::")) {
            const annotation = annotations.find(a => a.id === annotationId.replace("label::", ""));
            console.log("handleAnnotationMoveCommit", annotationId, annotation);
            if (!annotation) return;
            const labelDelta = getAnnotationLabelDeltaFromDeltaPos(annotation, deltaPos, partType);
            await db.annotations.update(annotation.id, { labelDelta });
        } else {

            const annotation = annotations.find(a => a.id === annotationId);
            if (!annotation) return;
            console.log("handleAnnotationMoveCommit", annotationId, annotation);
            if (annotation.type === "MARKER") {
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
            else {
                //const newPoints = annotation.points.map(pt => ({ ...pt, x: pt.x + deltaPos.x, y: pt.y + deltaPos.y }));
                console.log("TODO: save annotation points")
            }
        }

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
        !selectedNode ||
        (selectedNode && selectedNode.nodeType === "ANNOTATION");


    // helper - sizeVariant

    const sizeVariant = showBgImage ? "FIXED_IN_CONTAINER_PARENT" : "FIXED_IN_SCREEN";

    // render

    if (!baseMap) return <ScreenNoBaseMap />;

    return (
        <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: "relative", bgcolor: "background.default" }}>
            <InteractionProvider>
                <InteractionLayer
                    enabledDrawingMode={enabledDrawingMode}
                    selectedNode={selectedNode}
                    newAnnotation={newAnnotation}
                    ref={interactionLayerRef}
                    showBgImage={showBgImage}
                    onCommitDrawing={({ points, event, cutHostId }) => {
                        if (cutHostId) {
                            if (enabledDrawingMode === 'RECTANGLE') points = getPolylinePointsFromRectangle(points)
                            handleCommitDrawing(points, { cutHostId });
                        }
                        else if (enabledDrawingMode === 'MEASURE') {
                            handleMeasureCommit(points, event);
                        }
                        else if (enabledDrawingMode === 'RECTANGLE') {
                            handleCommitDrawingFromRectangle(points, event);
                        }
                        else {
                            console.log("handleCommitDrawing - points", points);
                            handleCommitDrawing(points);
                        }
                    }}
                    onCommitPointsFromDropFill={handleCommitPointsFromDropFill}
                    baseMapImageSize={baseMap?.getImageSize()}
                    baseMapImageUrl={baseMap?.getUrl()}
                    basePose={basePose}
                    onBaseMapPoseChange={handleBaseMapPoseChange}
                    activeContext={activeContext}
                    annotations={annotations}
                    onPointMoveCommit={handlePointMoveCommit}
                    onPointDuplicateAndMoveCommit={handleDuplicateAndMovePoint}
                    onDeletePoint={handleDeletePoint}
                    onHideSegment={handleHideSegment}
                    onRemoveCut={handleRemoveCut}
                    onAnnotationMoveCommit={handleAnnotationMoveCommit}
                    onSegmentSplit={handleSegmentSplit}
                    snappingEnabled={isSnappingEnabled}
                    baseMapMeterByPx={baseMap?.meterByPx}
                    legendFormat={legendFormat}
                    onLegendFormatChange={handleLegendFormatChange}
                >

                    <StaticMapContent
                        selectedNode={selectedNode}
                        bgImageUrl={bgImage?.url}
                        bgImageSize={bgImage?.imageSize}
                        showBgImage={showBgImage}
                        basePose={basePose}
                        baseMapImageUrl={baseMap?.getUrl()}
                        baseMapImageSize={baseMap?.getImageSize()}
                        annotations={annotations}
                        legendItems={legendItems}
                        legendFormat={legendFormat}
                        sizeVariant={sizeVariant}
                        isEditingBaseMap={isBaseMapSelected}
                        baseMapMeterByPx={baseMap?.meterByPx}
                        opacity={baseMapOpacity}
                        grayScale={baseMapGrayScale}
                    />
                    {/* 2. LAYER ÉDITION BASEMAP (Exclusif) */}
                    {isBaseMapSelected && (
                        <EditedBaseMapLayer
                            basePose={basePose} // La pose qui vient du hook (et donc de Redux)
                            baseMapImageUrl={baseMap?.getUrl()}
                            baseMapImageSize={baseMap?.getImageSize()}
                        // Pas besoin de passer onChange ici car InteractionLayer 
                        // intercepte les événements via data-interaction="transform-basemap"
                        // et appelle onBaseMapPoseChange du InteractionLayer
                        />
                    )}
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
                        baseMapMeterByPx={baseMap?.meterByPx} // If needed for width calc
                        onTextValueChange={handleTextValueChange}
                    />}


                </InteractionLayer>

                <UILayer mapController={interactionLayerRef.current} onResetCamera={handleResetCamera} />

            </InteractionProvider>

            <PrintableMap
                ref={printableMapRef}
                bgImageUrl={bgImage?.url}
                bgImageSize={bgImage?.imageSize}
                showBgImage={showBgImage}
                basePose={basePose}
                baseMapImageUrl={baseMap?.getUrl()}
                baseMapImageSize={baseMap?.getImageSize()}
                annotations={annotations}
                spriteImage={spriteImage}
                baseMapMeterByPx={baseMap?.meterByPx}
                legendItems={legendItems}
                legendFormat={legendFormat}
            />

            <DialogDeleteSelectedAnnotation />
            <DialogAutoCreateEntity />
            <PopperEditAnnotation viewerKey="MAP" />
            <PopperEditScale />
            <PopperContextMenu />

            <PopperSaveTempAnnotations />
            <DialogAutoMigrateToMapEditorV3 />

            <LayerTools />
        </Box>

    );
}