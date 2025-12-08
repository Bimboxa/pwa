// components/layers/EditedObjectLayer.jsx
import { useMemo } from 'react';

import { useInteraction } from "Features/mapEditor/context/InteractionContext";

import NodeMarkerStatic from "Features/mapEditorGeneric/components/NodeMarkerStatic";
import NodePolylineStatic from "Features/mapEditorGeneric/components/NodePolylineStatic";

import theme from 'Styles/theme';

export default function EditedObjectLayer({
    basePose,
    annotations,
    spriteImage,
    selectedNode,
    baseMapMeterByPx
}) {


    const isDraggable = selectedNode?.annotationType === "MARKER";

    const { hoveredNode, hiddenAnnotationIds, draggingAnnotationId } = useInteraction();

    // 1. Find the actual data object for the selected ID
    const selectedAnnotation = useMemo(() => {
        if (!selectedNode || !annotations) return null;
        return annotations.find(a => a.id === selectedNode.nodeId);
    }, [selectedNode, annotations]);


    if (!selectedAnnotation) return null;

    // 2. Define the "Selected" style overrides
    const overrideStyle = {
        strokeColor: theme.palette.annotation.selected, // e.g., Bright Blue or Orange
        strokeWidth: (selectedAnnotation.strokeWidth || 0) + 1, // Make it pop
        fillColor: theme.palette.annotation.selected,
        fillOpacity: 0.5 // Make it solid
    };

    // render

    if (draggingAnnotationId === selectedNode.nodeId) return null;

    return (
        <g
            className="edited-layer"
            style={{ pointerEvents: 'auto' }}
            data-interaction={isDraggable ? "draggable" : undefined}
            data-node-id={selectedNode?.nodeId}
            transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
        >
            {/* We render the STATIC component but with overrides.
               pointerEvents: none because the click is handled by the StaticLayer below 
               (or you can enable it if you want to drag it here)
            */}
            {selectedAnnotation.type === "MARKER" && <NodeMarkerStatic
                marker={selectedAnnotation}
                annotationOverride={overrideStyle}
                spriteImage={spriteImage}
                baseMapMeterByPx={baseMapMeterByPx}
                // Force selected prop to true if internal logic needs it
                selected={true}
            />}
            {["POLYLINE", "POLYGON"].includes(selectedAnnotation.type) && <NodePolylineStatic
                annotation={selectedAnnotation}
                annotationOverride={overrideStyle}
                baseMapMeterByPx={baseMapMeterByPx}
                // Force selected prop to true if internal logic needs it
                selected={true}
            />}


            {/* Future: Add Resize Handles here (TransformableNode) */}
        </g>
    );
}