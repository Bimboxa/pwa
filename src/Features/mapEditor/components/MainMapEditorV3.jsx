import { useRef, useEffect } from "react";
import { useSelector } from "react-redux";

import { nanoid } from "@reduxjs/toolkit";

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

import { Box } from "@mui/material";

import InteractionLayer from "./InteractionLayer";

import UILayer from "./UILayer";
import StaticMapContent from "./StaticMapContent";
import EditedObjectLayer from "./EditedObjectLayer";

import DialogDeleteSelectedAnnotation from "Features/annotations/components/DialogDeleteSelectedAnnotation";
import PopperEditAnnotation from "./PopperEditAnnotation";

import { InteractionProvider } from "../context/InteractionContext";

import db from "App/db/db";

export default function MainMapEditorV3() {

    // const

    const activeContext = "BASE_MAP";

    // ref

    const [containerRef, bounds] = useMeasure();
    const interactionLayerRef = useRef(null);

    // data

    const projectId = useSelector((state) => state.projects.selectedProjectId);
    const listingId = useSelector((state) => state.listings.selectedListingId);
    const enabledDrawingMode = useSelector((state) => state.mapEditor.enabledDrawingMode);
    const selectedNode = useSelector((state) => state.mapEditor.selectedNode);

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

    // annotation

    const newAnnotation = useSelector(s => s.annotations.newAnnotation);

    // annotations

    const annotations = useAnnotationsV2();


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


    // snapping

    const isSnappingEnabled = enabledDrawingMode || !selectedNode;



    return (
        <Box ref={containerRef} sx={{ width: '100%', height: '100%', border: '1px solid red', position: "relative" }}>
            <InteractionProvider>
                <InteractionLayer
                    enabledDrawingMode={enabledDrawingMode}
                    newAnnotation={newAnnotation}
                    ref={interactionLayerRef}
                    showBgImage={showBgImage}
                    onCommitDrawing={handleCommitDrawing}
                    basePose={basePose}
                    activeContext={activeContext}
                    annotations={annotations}
                    onPointMoveCommit={handlePointMoveCommit}
                    onSegmentSplit={handleSegmentSplit}
                    snappingEnabled={isSnappingEnabled}
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
                    />
                    <EditedObjectLayer
                        basePose={basePose}
                        annotations={annotations}
                        selectedNode={selectedNode}
                        baseMapMeterByPx={baseMap?.meterByPx} // If needed for width calc
                    />

                </InteractionLayer>

                <UILayer mapController={interactionLayerRef.current} onResetCamera={handleResetCamera} />

            </InteractionProvider>

            <DialogDeleteSelectedAnnotation />
            <PopperEditAnnotation viewerKey="MAP" />
        </Box>

    );
}