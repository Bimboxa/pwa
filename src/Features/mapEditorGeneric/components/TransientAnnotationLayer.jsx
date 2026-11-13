import React, { useMemo } from 'react';

import { useSelector } from 'react-redux';

import {
    selectImagesDisplayMode,
    selectImagesLinkNumber,
} from 'Features/popperImages/popperImagesSlice';

import NodeAnnotationStatic from './NodeAnnotationStatic';
import applyDeltaPosToAnnotation from '../utils/applyDeltaPosToAnnotation';

export default function TransientAnnotationLayer({
    annotation,
    deltaPos,
    partType,
    wrapperBbox,
    baseMapMeterByPx,
    baseMapImageScale = 1,
    basePose,
    // Photos: display number, so the badge follows the drag preview.
    imageDisplayIndex,
}) {
    const imagesDisplayMode = useSelector(selectImagesDisplayMode);
    const imagesLinkNumber = useSelector(selectImagesLinkNumber);

    const modifiedAnnotation = useMemo(() => {
        return applyDeltaPosToAnnotation(annotation, deltaPos, partType, wrapperBbox);
    }, [annotation?.id, deltaPos, partType, wrapperBbox]);

    if (!annotation) return null;

    // Curseur dynamique selon l'action
    let cursorStyle = "grabbing";
    if (partType === "ROTATE") cursorStyle = "grabbing";
    else if (partType?.startsWith("RESIZE")) cursorStyle = "crosshair";

    return (
        <g
            className="transient-annotation-layer"
            style={{
                cursor: cursorStyle
            }}
        >
            <NodeAnnotationStatic
                annotation={modifiedAnnotation}
                baseMapMeterByPx={baseMapMeterByPx}
                baseMapImageScale={baseMapImageScale}
                dragged={true}
                draggedPartType={partType}
                sizeVariant="FIXED_IN_SCREEN"
                containerK={basePose.k}
                imagesDisplayMode={imagesDisplayMode}
                imagesLinkNumber={imagesLinkNumber}
                imageDisplayIndex={imageDisplayIndex}
            />
        </g>
    );
}
