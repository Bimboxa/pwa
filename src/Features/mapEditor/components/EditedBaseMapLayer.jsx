// components/layers/EditedBaseMapLayer.jsx
import React from 'react';
import NodeSvgImage from 'Features/mapEditorGeneric/components/NodeSvgImage';

const HANDLE_SIZE_PX = 4; // Taille fixe à l'écran

export default function EditedBaseMapLayer({
    basePose,
    baseMapImageUrl,
    baseMapImageSize
}) {


    const { width, height } = baseMapImageSize;

    // Helper pour générer une poignée qui "résiste" au zoom
    const Handle = ({ x, y, cursor, type }) => (
        // 1. GROUPE DE POSITION (Coordonnées Monde)
        <g transform={`translate(${x}, ${y})`}>

            {/* 2. GROUPE D'ÉCHELLE (Coordonnées Écran) */}
            {/* On annule le zoom caméra ET le scale de l'image */}
            <g style={{
                transform: `scale(calc(1 / (var(--map-zoom, 1) * ${basePose.k})))`
            }}>
                <rect
                    // On centre le rectangle localement
                    x={-HANDLE_SIZE_PX / 2}
                    y={-HANDLE_SIZE_PX / 2}
                    width={HANDLE_SIZE_PX}
                    height={HANDLE_SIZE_PX}
                    fill="white"
                    stroke="#2196f3"
                    strokeWidth={1} // Ici, 2 = 2px écran car on a "dé-zoomé"
                    style={{ cursor, pointerEvents: 'auto' }}

                    // Données pour l'InteractionLayer
                    data-interaction="transform-basemap"
                    data-handle-type={type}
                />
            </g>
        </g>
    );

    if (!baseMapImageUrl || !baseMapImageSize) return null;
    return (
        <g transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}>

            {/* 1. L'IMAGE */}
            <NodeSvgImage
                src={baseMapImageUrl}
                width={width}
                height={height}
                opacity={0.8}
                style={{ pointerEvents: 'none' }} // L'image ne doit pas bloquer
            />

            {/* 2. LE CADRE */}
            <rect
                x={0} y={0} width={width} height={height}
                fill="transparent"
                stroke="#2196f3"
                // vectorEffect est nécessaire ici car ce rect subit le zoom
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
                style={{ cursor: 'move', pointerEvents: 'auto' }}
                data-interaction="transform-basemap"
                data-handle-type="MOVE"
            />

            {/* 3. LES POIGNÉES */}
            <Handle x={0} y={0} cursor="nw-resize" type="NW" />
            <Handle x={width} y={0} cursor="ne-resize" type="NE" />
            <Handle x={width} y={height} cursor="se-resize" type="SE" />
            <Handle x={0} y={height} cursor="sw-resize" type="SW" />

        </g>
    );
}