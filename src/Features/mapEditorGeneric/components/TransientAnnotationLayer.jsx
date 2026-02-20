import React, { useMemo } from 'react';

import NodeAnnotationStatic from './NodeAnnotationStatic';
import applyDeltaPosToAnnotation from '../utils/applyDeltaPosToAnnotation';

export default function TransientAnnotationLayer({
    annotation,
    deltaPos,
    partType,
    baseMapMeterByPx,
    basePose,
}) {

    const modifiedAnnotation = useMemo(() => {
        return applyDeltaPosToAnnotation(annotation, deltaPos, partType);
    }, [annotation?.id, deltaPos, partType]);

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
                dragged={true}
                sizeVariant="FIXED_IN_SCREEN"
                containerK={basePose.k}
            />
        </g>
    );
}
