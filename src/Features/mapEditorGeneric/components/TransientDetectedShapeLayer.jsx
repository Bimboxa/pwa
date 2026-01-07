import { forwardRef, useImperativeHandle, useState, useMemo } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

// --- STYLES & ANIMATIONS ---

const flashAnimation = keyframes`
  0% { opacity: 0.4; stroke-width: 2px; }
  50% { opacity: 1; stroke-width: 2px; } /* J'ai mis 4px pour que l'effet soit visible */
  100% { opacity: 0.4; stroke-width: 2px; }
`;

// Couleurs partagées
const COLORS = {
    POINT: "#00ff00",    // Lime Green
    LINE: "#00ccff",     // Cyan
    RECTANGLE: "#FFD700" // Gold
};

// Groupe animé pour les points
const AnimatedGroup = styled.g`
  animation: ${flashAnimation} 1s infinite ease-in-out;
`;

// --- NOUVEAUX COMPOSANTS STYLÉS ---
// On crée des composants styled pour injecter correctement l'animation
const AnimatedPolygon = styled.polygon`
  animation: ${flashAnimation} 1.5s infinite ease-in-out;
  transition: all 0.3s ease;
`;

const AnimatedPolyline = styled.polyline`
  animation: ${flashAnimation} 1.5s infinite ease-in-out;
  transition: all 0.3s ease;
`;


const TransientDetectedShapeLayer = forwardRef(({ containerK = 1, size = 24 }, ref) => {
    const [shape, setShape] = useState(null);

    useImperativeHandle(ref, () => ({
        updateShape: (newShape) => {
            setShape(newShape);
        }
    }));

    const scaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    if (!shape || !shape.points || shape.points.length === 0) return null;

    // --- RENDER POINT (CORNER) ---
    if (shape.type === 'POINT' || shape.type === "CORNER") {
        const point = shape.points[0];
        const halfSize = size / 2;

        return (
            <AnimatedGroup
                style={{
                    transform: `translate(${point.x}px, ${point.y}px) ${scaleTransform}`,
                    color: COLORS.POINT
                }}
            >
                <line
                    x1={-halfSize} y1={0} x2={halfSize} y2={0}
                    stroke={COLORS.POINT}
                    vectorEffect="non-scaling-stroke"
                />
                <line
                    x1={0} y1={-halfSize} x2={0} y2={halfSize}
                    stroke={COLORS.POINT}
                    vectorEffect="non-scaling-stroke"
                />
            </AnimatedGroup>
        );
    }

    // --- RENDER LINE / POLYLINE / RECTANGLE ---
    if (['LINE', 'POLYLINE', 'RECTANGLE'].includes(shape.type)) {
        const isRect = shape.type === 'RECTANGLE';

        // Sélection du composant Styled approprié
        const ShapeComponent = isRect ? AnimatedPolygon : AnimatedPolyline;

        const color = isRect ? COLORS.RECTANGLE : COLORS.LINE;

        return (
            <ShapeComponent
                points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
                fill={isRect ? `${color}33` : "none"}
                stroke={color}

                // Note : On laisse vectorEffect, mais attention, il peut parfois 
                // entrer en conflit visuel avec l'animation de stroke-width 
                // si le zoom est très fort.
                vectorEffect="non-scaling-stroke"

                pointerEvents="none"

                // On passe la couleur ici pour le drop-shadow si besoin, 
                // mais l'animation est maintenant gérée par le styled component ci-dessus
                style={{ color: color }}
            />
        );
    }

    return null;
});

export default TransientDetectedShapeLayer;