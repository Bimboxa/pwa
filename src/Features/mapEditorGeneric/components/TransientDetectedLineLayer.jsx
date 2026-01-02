// TransientLineLayer.jsx
import { forwardRef, useImperativeHandle, useState } from "react";

// Ce composant ne re-rend que lui-même, pas le gros MapEditor
const TransientDetectedLineLayer = forwardRef(({ }, ref) => {
    const [linePoints, setLinePoints] = useState(null);

    useImperativeHandle(ref, () => ({
        updateLine: (points) => {
            // Mise à jour locale uniquement
            setLinePoints(points);
        }
    }));

    if (!linePoints || linePoints.length < 2) return null;

    return (
        <line
            x1={linePoints[0].x}
            y1={linePoints[0].y}
            x2={linePoints[1].x}
            y2={linePoints[1].y}
            stroke="#00ff00" // Vert fluo
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="5,5"
            pointerEvents="none"
        />
    );
});

export default TransientDetectedLineLayer;