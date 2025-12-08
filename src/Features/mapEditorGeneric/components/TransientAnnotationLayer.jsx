// components/layers/TransientTopologyLayer.jsx
import React, { useMemo } from 'react';

import NodeMarkerStatic from './NodeMarkerStatic';
import NodePolylineStatic from './NodePolylineStatic';

export default function TransientAnnotationLayer({
    annotation,
    deltaPos,
    baseMapMeterByPx
}) {

    const modifiedAnnotation = useMemo(() => {
        if (!deltaPos) return annotation;

        const _annotation = { ...annotation };

        if (_annotation.type === "MARKER") {
            _annotation.point = {
                x: _annotation.point.x + deltaPos.x,
                y: _annotation.point.y + deltaPos.y
            }
        }

        if (_annotation.type === "POLYLINE" || _annotation.type === "POLYGON") {
            _annotation.points = _annotation.points.map(pt => {
                pt.x += deltaPos.x;
                pt.y += deltaPos.y;
                return pt;
            });
        }

        return _annotation;

    }, [annotation?.id, deltaPos]);

    if (!annotation) return null;

    return (
        <g
            className="transient-annotation-layer"
            style={{
                //pointerEvents: 'none',
                cursor: "grabbing"
            }}
        >
            {annotation?.type === "MARKER" && <NodeMarkerStatic
                marker={modifiedAnnotation}
                baseMapMeterByPx={baseMapMeterByPx}
                dragged={true}
            />

            }
            {["POLYLINE", "POLYGON"].includes(annotation?.type) && <NodePolylineStatic
                annotation={modifiedAnnotation}
                baseMapMeterByPx={baseMapMeterByPx} />
            }
        </g>
    );
}