import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Box } from "@mui/material";
import theme from "Styles/theme";

const SnappingLayer = forwardRef(({
    color = "#ff00ff",
    isDrawing,
    onMouseDown,
}, ref) => {

    const circleRef = useRef(null);
    const rectRef = useRef(null);
    const lastPosRef = useRef(null); // Pour mémoriser la dernière position snappée

    const radius = 6;
    const size = 10;

    useImperativeHandle(ref, () => ({
        update: (pos) => {
            if (!circleRef.current || !rectRef.current) return;

            if (pos) {
                if (pos.type === 'VERTEX') {
                    // --- CAS VERTEX (Point existant) ---
                    circleRef.current.style.display = 'block';
                    circleRef.current.setAttribute('cx', pos.x);
                    circleRef.current.setAttribute('cy', pos.y);

                    circleRef.current.style.stroke = color;
                    circleRef.current.style.strokeWidth = "2px";

                    rectRef.current.style.display = 'none';
                }
                else {
                    // --- CAS PROJECTION (Nouveau point sur segment) ---
                    // C'est cette partie qui manquait ou ne s'exécutait pas
                    rectRef.current.style.display = 'block';

                    // Centrer le carré (x - size/2)
                    rectRef.current.setAttribute('x', pos.x - size / 2);
                    rectRef.current.setAttribute('y', pos.y - size / 2);

                    // Style spécifique pour la projection (ex: gris ou couleur thème)
                    rectRef.current.style.stroke = theme.palette.anchor.passive || color;
                    rectRef.current.style.strokeWidth = "2px";

                    circleRef.current.style.display = 'none';
                }
            } else {
                // HIDE ALL
                circleRef.current.style.display = 'none';
                rectRef.current.style.display = 'none';
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
                "& .vertex, & .projection": {
                    transition: 'stroke 0.1s ease', // Transition rapide
                    vectorEffect: "non-scaling-stroke",
                    fill: "transparent",
                    cursor: "grab",
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
                className="projection"
                width={size}
                height={size}
                {...eventHandlers}
            />
        </Box>
    );
});

export default SnappingLayer;