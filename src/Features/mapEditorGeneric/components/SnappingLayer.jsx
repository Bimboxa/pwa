import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Box } from "@mui/material";
import theme from "Styles/theme";

const SnappingLayer = forwardRef(({
    color = "#ff00ff",
    onMouseDown,
}, ref) => {

    const circleRef = useRef(null);
    const rectRef = useRef(null);
    const projCircleRef = useRef(null);
    const lastPosRef = useRef(null); // Pour mémoriser la dernière position snappée

    const radius = 6;
    const size = 10;

    useImperativeHandle(ref, () => ({
        update: (pos) => {
            if (!circleRef.current || !rectRef.current || !projCircleRef.current) return;

            if (pos) {
                if (pos.type === 'VERTEX') {
                    // --- CAS VERTEX (Point existant) ---
                    circleRef.current.style.display = 'block';
                    circleRef.current.setAttribute('cx', pos.x);
                    circleRef.current.setAttribute('cy', pos.y);

                    circleRef.current.style.stroke = color;
                    circleRef.current.style.strokeWidth = "2px";

                    rectRef.current.style.display = 'none';
                    projCircleRef.current.style.display = 'none';
                }
                else if (pos.type === 'MIDPOINT') {
                    // --- CAS MIDPOINT (Milieu de segment) ---
                    rectRef.current.style.display = 'block';

                    rectRef.current.setAttribute('x', pos.x - size / 2);
                    rectRef.current.setAttribute('y', pos.y - size / 2);

                    rectRef.current.style.stroke = theme.palette.anchor.passive || color;
                    rectRef.current.style.strokeWidth = "2px";

                    circleRef.current.style.display = 'none';
                    projCircleRef.current.style.display = 'none';
                }
                else {
                    // --- CAS PROJECTION (Projection sur segment le plus proche) ---
                    // Hide if mouse is too far from projection point (screen space)
                    const PROJ_DISPLAY_THRESHOLD = 10; // px
                    if (pos.screenDistance != null && pos.screenDistance > PROJ_DISPLAY_THRESHOLD) {
                        circleRef.current.style.display = 'none';
                        rectRef.current.style.display = 'none';
                        projCircleRef.current.style.display = 'none';
                    } else {
                        projCircleRef.current.style.display = 'block';
                        projCircleRef.current.setAttribute('cx', pos.x);
                        projCircleRef.current.setAttribute('cy', pos.y);

                        projCircleRef.current.style.stroke = theme.palette.anchor.passive || "#999";
                        projCircleRef.current.style.strokeWidth = "2px";

                        circleRef.current.style.display = 'none';
                        rectRef.current.style.display = 'none';
                    }
                }
            } else {
                // HIDE ALL
                circleRef.current.style.display = 'none';
                rectRef.current.style.display = 'none';
                projCircleRef.current.style.display = 'none';
            }
        }
    }));


    const eventHandlers = {
        onMouseDown: e => { if (onMouseDown) onMouseDown(e); }
    };

    return (
        <Box
            component="g"
            sx={{
                pointerEvents: 'auto',
                "& .vertex, & .projection, & .midpoint": {
                    transition: 'stroke 0.1s ease',
                    vectorEffect: "non-scaling-stroke",
                    fill: "transparent",
                    cursor: "grab",
                },
                "& .projection:hover, & .midpoint:hover": {
                    stroke: "#ff00ff !important",
                },
                // On gère les couleurs via JS (style inline) pour plus de contrôle
            }}>

            <circle
                ref={circleRef}
                className="vertex"
                r={radius}
                {...eventHandlers}
            />

            <rect
                ref={rectRef}
                className="midpoint"
                width={size}
                height={size}
                {...eventHandlers}
            />

            <circle
                ref={projCircleRef}
                className="projection"
                r={radius}
                {...eventHandlers}
            />
        </Box>
    );
});

export default SnappingLayer;
