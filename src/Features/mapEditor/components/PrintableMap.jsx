// components/PrintableMap.jsx
import React, { forwardRef } from 'react';
import NodeSvgImage from 'Features/mapEditorGeneric/components/NodeSvgImage';
import NodeAnnotationStatic from 'Features/mapEditorGeneric/components/NodeAnnotationStatic'; // ou NodePolylineStatic + NodeMarkerStati
import NodeLegendStatic from 'Features/mapEditorGeneric/components/NodeLegendStatic';

const PrintableMap = forwardRef(({
    bgImageUrl,
    baseMapImageUrl,
    baseMapImageSize,       // { width, height }
    bgImageSize,         // { width, height }
    bgPose = { x: 0, y: 0, k: 1 },         // { x, y, k }
    basePose,       // { x, y, k }
    annotations,
    legendItems,
    legendFormat,
    showBgImage,
    spriteImage,
    baseMapMeterByPx
}, ref) => {

    // On utilise la taille du fond de plan (ou de l'image de fond) comme viewBox
    // pour avoir une résolution native (pas de pixelisation)
    const width = bgImageSize?.width || baseMapImageSize?.width || 1000;
    const height = bgImageSize?.height || baseMapImageSize?.height || 1000;

    // helpers

    const bgImageAnnotations = showBgImage
        ? annotations.filter(({ nodeType }) => nodeType === "BG_IMAGE_TEXT")
        : [];
    const baseMapAnnotations = annotations.filter(({ baseMapId }) =>
        Boolean(baseMapId)
    );

    return (
        <svg
            ref={ref}
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{
                position: 'absolute',
                zIndex: -1,
                top: 0,
                left: 0,
                //top: -9999,
                //left: -9999, // Caché hors de l'écran
                pointerEvents: 'none'
            }}
        >
            {/* 1. LAYER BG IMAGE */}
            {showBgImage && bgImageUrl && (
                <g>
                    <NodeSvgImage
                        src={bgImageUrl}
                        width={bgImageSize?.width}
                        height={bgImageSize?.height}
                    />
                    {bgImageAnnotations.map((annotation) => (
                        <NodeAnnotationStatic
                            key={annotation.id}
                            annotation={annotation}
                            spriteImage={spriteImage}
                            imageSize={bgImageSize}
                            containerK={bgPose.k}
                            baseMapMeterByPx={baseMapMeterByPx}
                        />
                    ))}
                </g>
            )}

            {/* 2. LAYER BASE MAP & ANNOTATIONS */}
            {baseMapImageUrl && (
                <g
                    transform={`translate(${(basePose.x - bgPose.x) / (bgPose.k || 1)}, ${(basePose.y - bgPose.y) / (bgPose.k || 1)
                        }) scale(${(basePose.k || 1) / (bgPose.k || 1)})`}
                >
                    <NodeSvgImage
                        src={baseMapImageUrl}
                        width={baseMapImageSize?.width}
                        height={baseMapImageSize?.height}
                    />

                    {baseMapAnnotations?.map(ann => (
                        <NodeAnnotationStatic
                            key={ann.id}
                            annotation={ann}
                            baseMapMeterByPx={baseMapMeterByPx}
                            spriteImage={spriteImage}
                            worldScale={1}
                            containerK={basePose.k}
                        />
                    ))}
                </g>
            )}

            {/* 3. LEGEND */}
            <g>
                {legendItems?.length > 0 && showBgImage && (
                    <NodeLegendStatic
                        id="legend-2"
                        legendItems={legendItems}
                        spriteImage={spriteImage}
                        legendFormat={legendFormat}
                    />
                )}
            </g>
        </svg>
    );
});

export default PrintableMap;