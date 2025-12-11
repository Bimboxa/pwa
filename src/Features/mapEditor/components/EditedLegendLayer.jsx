// components/EditedLegendLayer.jsx
import React, { useState, useCallback } from 'react';
import NodeLegendStatic from 'Features/mapEditorGeneric/components/NodeLegendStatic';

const HANDLE_SIZE_PX = 4;

export default function EditedLegendLayer({
    legendItems,
    spriteImage,
    legendFormat,
    scaleFactor = 1,
}) {
    const { x = 16, y = 16 } = legendFormat || {};

    // On initialise avec les props, mais on laissera le composant enfant nous corriger
    const [measuredSize, setMeasuredSize] = useState({
        width: legendFormat?.width || 260,
        height: 100
    });


    // CORRECTION 1 : useCallback + Vérification de changement
    const handleSizeChange = useCallback((size) => {
        setMeasuredSize(prev => {
            // Si la taille est identique, on retourne l'ancien objet state
            // pour empêcher React de déclencher un re-render inutile.
            if (Math.abs(prev.width - size.width) < 1 && Math.abs(prev.height - size.height) < 1) {
                return prev;
            }
            return size;
        });
    }, []);



    // Raccourcis pour la lisibilité
    const w = measuredSize.width;
    const h = measuredSize.height;

    // Helper Handle (inchangé)
    const Handle = ({ cx, cy, cursor, type }) => (
        <g transform={`translate(${cx}, ${cy})`}>
            <g style={{
                transform: `scale(calc(1 / (var(--map-zoom, 1) * ${scaleFactor})))`
            }}>
                <rect
                    x={-HANDLE_SIZE_PX / 2}
                    y={-HANDLE_SIZE_PX / 2}
                    width={HANDLE_SIZE_PX}
                    height={HANDLE_SIZE_PX}
                    fill="white"
                    stroke="#2196f3"
                    strokeWidth={1}
                    style={{ cursor, pointerEvents: 'auto' }}
                    data-interaction="transform-legend"
                    data-handle-type={type}
                />
            </g>
        </g>
    );

    return (
        <g>
            {/* 1. LA LÉGENDE */}
            {/* Elle reçoit la largeur imposée par le format, mais renvoie sa taille réelle */}
            <NodeLegendStatic
                legendItems={legendItems}
                spriteImage={spriteImage}
                legendFormat={legendFormat}
                onSizeChange={handleSizeChange}
            />

            {/* 2. LE CADRE (Basé sur la mesure réelle) */}
            <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="transparent"
                stroke="#2196f3"
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                style={{ cursor: 'move', pointerEvents: 'auto' }}
                data-interaction="transform-legend"
                data-handle-type="MOVE"
            />

            {/* 3. LES POIGNÉES (Placées aux coins réels) */}
            <Handle cx={x} cy={y} cursor="ew-resize" type="NW" />
            <Handle cx={x + w} cy={y} cursor="ew-resize" type="NE" />
            <Handle cx={x + w} cy={y + h} cursor="ew-resize" type="SE" />
            <Handle cx={x} cy={y + h} cursor="ew-resize" type="SW" />

            <Handle cx={x + w} cy={y + h / 2} cursor="ew-resize" type="E" />
            <Handle cx={x} cy={y + h / 2} cursor="ew-resize" type="W" />
        </g>
    );
}