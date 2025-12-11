import { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";


import { setAnchorPositionScale, setScaleInPx } from "../mapEditorSlice";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setBaseMapPoseInBg, setLegendFormat } from "../mapEditorSlice";

import useMeasure from "react-use-measure";

import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMapPose from "Features/mapEditor/hooks/useBaseMapPose";

import useAutoSelectMainBaseMap from "../hooks/useAutoSelectMainBaseMap";
import useAutoResetBaseMapPose from "Features/bgImage/hooks/useAutoResetBaseMapPose";
import useAutoShowBgImage from "Features/bgImage/hooks/useAutoShowBgImage";
import useAutoBgImageRawTextAnnotations from "Features/bgImage/hooks/useAutoBgImageRawTextAnnotations";
import useDefaultCameraMatrix from "../hooks/useDefaultCameraMatrix";
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
import ScreenNoBaseMap from "./ScreenNoBaseMap";

import { InteractionProvider } from "../context/InteractionContext";

import db from "App/db/db";
import editor from "App/editor";
import getPolylinePointsFromRectangle from "Features/geometry/utils/getPolylinePointsFromRectangle";

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
    const newAnnotationType = useNewAnnotationType();
    const resetNewAnnotation = useResetNewAnnotation();

    // viewport

    const viewport = {
        w: bounds.width,
        h: bounds.height,
    };

    // bgImage

    useAutoShowBgImage();
    const bgImage = useBgImageInMapEditor();
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);

    // bgImage annotations

    useAutoBgImageRawTextAnnotations();


    // baseMap

    useAutoSelectMainBaseMap();
    useAutoResetBaseMapPose();
    const basePoseInBg = useSelector((s) => s.mapEditor.baseMapPoseInBg);
    const baseMap = useMainBaseMap();
    const { pose: basePose } = useBaseMapPose({
        baseMap,
        showBgImage,
        viewport,
        basePoseInBg,
    });
    const handleBaseMapPoseChange = (newPose) => {
        // newPose = { x, y, k, r }
        dispatch(setBaseMapPoseInBg(newPose));
    };
    const isBaseMapSelected = showBgImage && selectedNode?.nodeType === "BASE_MAP";
    console.log("isBaseMapSelected", isBaseMapSelected, selectedNode);

    // annotation

    let newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // annotations

    const annotations = useAnnotationsV2({ withEntity: true });

    // legend

    const legendItems = useLegendItems();
    const legendFormat = useSelector((s) => s.mapEditor.legendFormat);

    const isLegendSelected = showBgImage && selectedNode?.nodeType === "LEGEND";

    function handleLegendFormatChange(newFormat) {
        dispatch(setLegendFormat(newFormat));
    }


    // default camera matrix

    const defaultCameraMatrix = useDefaultCameraMatrix({
        showBgImage,
        bgSize: bgImage?.imageSize,
        baseSize: baseMap?.getImageSize(),
        viewport,
    });

    useEffect(() => {
        interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrix);
    }, [showBgImage]);


    // handler - commit drawing

    const handleCommitDrawing = useHandleCommitDrawing();

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
        interactionLayerRef.current?.setCameraMatrix(defaultCameraMatrix);
    };

    // handlers - move point

    const handlePointMoveCommit = (pointId, newPos) => {
        const imageSize = baseMap?.image?.imageSize;
        //dispatch(updatePoint({ id: pointId, ...newPos }));
        db.points.update(pointId, { x: newPos.x / imageSize.width, y: newPos.y / imageSize.height });
    };

    // handlers - split line

    const handleSegmentSplit = async (segment) => {
        console.log("splitSegment", segment)
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

        // 2. Find ALL annotations affected by this segment
        const annotationsToUpdate = [];

        annotations.forEach(ann => {
            const pts = ann.points;
            if (!pts || pts.length < 2) return;

            let newPointsList = null;

            for (let i = 0; i < pts.length; i++) {
                const currentPt = pts[i];
                const nextPt = pts[(i + 1) % pts.length]; // Handle closed loop

                // CASE 1: Sequence A -> B
                if (currentPt.id === segmentStartId && nextPt.id === segmentEndId) {
                    newPointsList = [...pts];
                    newPointsList.splice(i + 1, 0, { id: newPointId, type: 'square' });
                    break;
                }

                // CASE 2: Sequence B -> A (Reverse direction)
                if (currentPt.id === segmentEndId && nextPt.id === segmentStartId) {
                    newPointsList = [...pts];
                    newPointsList.splice(i + 1, 0, { id: newPointId, type: 'square' });
                    break;
                }
            }

            if (newPointsList) {
                annotationsToUpdate.push({ id: ann.id, points: newPointsList });
            }
        });

        // 3. Execute Database Operations
        if (annotationsToUpdate.length > 0) {
            try {
                // A. Add the new point
                await db.points.add(newPointEntity);

                // B. Update all affected annotations in parallel
                // Using Promise.all is the standard alternative to transaction for batching
                await Promise.all(
                    annotationsToUpdate.map(update =>
                        db.annotations.update(update.id, { points: update.points })
                    )
                );

                console.log("Segment split successfully committed.");
            } catch (error) {
                console.error("Failed to split segment:", error);
            }
        }
    };

    const handleAnnotationMoveCommit = async (annotationId, detaPos) => {
        const imageSize = baseMap?.image?.imageSize;
        if (!imageSize) return;

        const annotation = annotations.find(a => a.id === annotationId);
        if (!annotation) return;
        console.log("handleAnnotationMoveCommit", annotationId, annotation);
        if (annotation.type === "MARKER") {
            const point = await db.points.get(annotation.point.id);
            const x = point.x + detaPos.x / imageSize.width;
            const y = point.y + detaPos.y / imageSize.height;
            console.log("save_point", point.id, { x, y });
            await db.points.update(point.id, { x, y });
        } else {
            //const newPoints = annotation.points.map(pt => ({ ...pt, x: pt.x + detaPos.x, y: pt.y + detaPos.y }));
            console.log("TODO: save annotation points")
        }

    };


    // snapping

    const isSnappingEnabled = enabledDrawingMode || !selectedNode;

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
                    onCommitDrawing={(points, event) => {
                        if (enabledDrawingMode === 'MEASURE') {
                            handleMeasureCommit(points, event);
                        } else if (enabledDrawingMode === 'RECTANGLE') {
                            handleCommitDrawingFromRectangle(points, event);
                        } else {
                            handleCommitDrawing(points, event);
                        }
                    }}
                    baseMapImageSize={baseMap?.getImageSize()}
                    basePose={basePose}
                    onBaseMapPoseChange={handleBaseMapPoseChange}
                    activeContext={activeContext}
                    annotations={annotations}
                    onPointMoveCommit={handlePointMoveCommit}
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
            {/* <PopperEditAnnotation viewerKey="MAP" /> */}
            <PopperEditScale />
            <PopperContextMenu />

            <DialogAutoMigrateToMapEditorV3 />
        </Box>

    );
}