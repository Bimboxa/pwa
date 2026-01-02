import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import { useDispatch } from "react-redux";

import { setCenterColor as setGlobalCenterColor } from "Features/smartDetect/smartDetectSlice";

import throttle from "Features/misc/utils/throttle";
import theme from "Styles/theme";

import cv from "Features/opencv/services/opencvService";

const SmartDetectLayer = forwardRef(({
    sourceImage,
    rotation = 0,
    loupeSize = 100,
    debug = false,
    enabled = false,
    onLineDetected,
}, ref) => {
    const dispatch = useDispatch();

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Options
    const FIXED_IN_CONTAINER = true;

    // --- STATES ---
    const [detectedPolylines, setDetectedPolylines] = useState([]);
    const [processedImageUrl, setProcessedImageUrl] = useState(null);
    const [extendedLine, setExtendedLine] = useState(null);

    // State optionnel pour l'UI, mais non utilisé pour le calcul (qui utilise la ref)
    const [morphKernelSizeDisplay, setMorphKernelSizeDisplay] = useState(3);

    const [centerColor, setCenterColor] = useState(theme.palette.primary.main);
    const contrastedColor = theme.palette.getContrastText(centerColor);

    // --- REF (Single Source of Truth pour la logique) ---
    const stateRef = useRef({
        sourceROI: null,
        detectedPolylines: [],
        morphKernelSize: 3,
    });

    // --- HELPER DE DESSIN ---
    const drawToCanvas = (ctx, roi) => {
        if (!sourceImage || !roi) return false;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, loupeSize, loupeSize);
        try {
            ctx.drawImage(
                sourceImage,
                roi.x, roi.y, roi.width, roi.height,
                0, 0, loupeSize, loupeSize
            );
            return true;
        } catch (e) {
            if (debug) console.warn("[SmartDetect] Draw failed", e);
            return false;
        }
    };

    // --- 2. ANALYSE VISUELLE ---
    // Ajout de 'currentRoi' en argument pour le calcul de coordonnées
    const analyzeImageThrottled = useMemo(() => throttle(async (imageUrl, currentRoi) => {
        if (!imageUrl || !enabled) return;

        // Lecture de la Ref pour la taille du kernel (évite stale closure)
        const currentKernelSize = stateRef.current.morphKernelSize;

        try {
            await cv.load();
            const result = await cv.detectShapesAsync({
                imageUrl,
                morphKernelSize: currentKernelSize,
                rotation,
                keepBest: false, // On veut tout recevoir pour filtrer/colorer nous-mêmes
            });

            const polylines = result?.polylines || [];
            const processedImageUrl = result?.processedImageUrl || null;

            if (polylines) {
                stateRef.current.detectedPolylines = polylines;
                setDetectedPolylines(polylines);
            }

            if (processedImageUrl) {
                setProcessedImageUrl(processedImageUrl);
            }

            if (result?.centerColor) {
                setCenterColor(result.centerColor.hex);
                dispatch(setGlobalCenterColor(result.centerColor.hex));
            }

            if (result?.separationLines) {
                stateRef.current.detectedPolylines = result.separationLines;
                setDetectedPolylines(result.separationLines);

                // --- CALCUL DES COORDONNÉES GLOBALES (IMAGE ORIGINE) ---

                // 1. Trouver le meilleur segment horizontal
                const segment_H_Obj = result.separationLines.find(l =>
                    l.type.includes('horizontal') && l.isBest
                );

                if (false && segment_H_Obj && currentRoi) {
                    const localPoints = segment_H_Obj.points;

                    // 2. Calcul du ratio (Scale) entre le ROI réel et la Loupe (Canvas)
                    const scaleX = currentRoi.width / loupeSize;
                    const scaleY = currentRoi.height / loupeSize;

                    // 3. Projection : Origine ROI + (Point Local * Scale)
                    const segment_H_inImage = localPoints.map(p => ({
                        x: currentRoi.x + (p.x * scaleX),
                        y: currentRoi.y + (p.y * scaleY)
                    }));

                    const { extendedPoints, counters } = await cv.extendLineAsync({
                        imageUrl: sourceImage.src,
                        points: segment_H_inImage,
                        offset: { variant: "MANUAL", value: 0 }
                    });

                    setExtendedLine(extendedPoints);
                    if (onLineDetected) {
                        onLineDetected(extendedPoints);
                    }

                    // ICI : Vous avez les coordonnées globales en pixels sur l'image source
                    //console.log("Segment H (Global PX):", segment_H_inImage);

                    // Exemple d'action : 
                    // dispatch(setDetectedSegmentCoords(segment_H_inImage));
                } else {
                    setExtendedLine(null);
                    if (onLineDetected) {
                        onLineDetected(null);
                    }
                }
            }

        } catch (e) {
            // Silence
        }
    }, 60), [enabled, loupeSize]); // dépendances


    // --- API IMPÉRATIVE ---
    useImperativeHandle(ref, () => ({
        changeMorphKernelSize: (changeBy) => {
            const current = stateRef.current.morphKernelSize;
            const newValue = Math.max(0, Math.min(20, current + changeBy));

            console.log("newMorphKernelSize (Ref update)", newValue);

            stateRef.current.morphKernelSize = newValue;
            setMorphKernelSizeDisplay(newValue);

            const canvas = canvasRef.current;
            if (canvas) {
                // On passe le ROI actuel stocké dans la ref
                analyzeImageThrottled(
                    canvas.toDataURL('image/jpeg', 0.9),
                    stateRef.current.sourceROI
                );
            }
        },
        update: (screenPos, sourceROI) => {
            if (containerRef.current && !FIXED_IN_CONTAINER) {
                containerRef.current.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) translate(-50%, -50%)`;
            }

            // Mise à jour de la ref ROI
            stateRef.current.sourceROI = sourceROI;

            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
                if (drawToCanvas(ctx, sourceROI)) {
                    // On passe le ROI reçu en argument pour garantir la synchro
                    analyzeImageThrottled(
                        canvas.toDataURL('image/jpeg', 0.9),
                        sourceROI
                    );
                }
            }
        },
        getDetectedPolylines: () => stateRef.current.detectedPolylines,
        getSnapshotDataUrl: () => canvasRef.current?.toDataURL('image/png'),
        detectOrientationNow: async () => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
            const roi = stateRef.current.sourceROI;
            if (!drawToCanvas(ctx, roi)) return null;

            const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
            try {
                const result = await cv.detectSeparationLinesAsync({ imageUrl, keepBest: true, origin: "debug", rotation });
                const lines = result?.polylines || [];

                if (lines.length === 0) return null;
                if (lines.some(l => l.type === 'corner')) return 'ANGLE';
                const hasH = lines.some(l => l.type === 'horizontal');
                const hasV = lines.some(l => l.type === 'vertical');
                if (hasH && hasV) return 'ANGLE';
                if (hasH) return 'H';
                if (hasV) return 'V';
                return null;
            } catch (e) { return null; }
        }
    }));

    // --- RENDER ---
    const centerCoord = loupeSize / 2;
    const crossHairSize = 8;

    return (
        <div
            ref={containerRef}
            style={{
                ...(!FIXED_IN_CONTAINER ? { position: 'absolute', top: 0, left: 0 } : { position: "relative" }),
                width: loupeSize,
                height: loupeSize,
                boxSizing: 'border-box',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                backgroundColor: '#000',
                cursor: 'none',
                zIndex: 9999,
                pointerEvents: 'none',
                display: enabled ? 'block' : 'none'
            }}
        >
            <canvas ref={canvasRef} width={loupeSize} height={loupeSize} />

            {processedImageUrl && (
                <img
                    src={processedImageUrl}
                    alt="Debug Processed"
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        objectFit: 'contain', pointerEvents: 'none',
                    }}
                />
            )}

            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                {detectedPolylines.map((polylineObj, index) => {
                    const pointsStr = polylineObj.points.map(p => `${p.x},${p.y}`).join(' ');
                    let color = "red";
                    if (polylineObj.type.includes('horizontal')) color = "#00ccff"; // Cyan
                    if (polylineObj.type.includes('vertical')) color = "#ff00ff"; // Magenta
                    if (polylineObj.type.includes('corner')) color = "#00ff00"; // Vert

                    // La "Best Line" écrase la couleur précédente pour être bien visible (Vert pur)
                    if (polylineObj.isBest) color = "#00ff00";

                    const commonProps = {
                        points: pointsStr,
                        fill: polylineObj.closeLine ? "rgba(255, 0, 0, 0.2)" : "none",
                        stroke: color,
                        strokeWidth: polylineObj.isBest ? "3" : "2" // Un peu plus épais si Best
                    };
                    return polylineObj.closeLine ?
                        <polygon key={index} {...commonProps} /> :
                        <polyline key={index} {...commonProps} />;
                })}

                {/* CROSSHAIR */}
                <g style={{ filter: "drop-shadow(0px 0px 1px rgba(0,0,0,0.8))" }}>
                    <line
                        x1={centerCoord - crossHairSize}
                        y1={centerCoord}
                        x2={centerCoord + crossHairSize}
                        y2={centerCoord}
                        stroke={contrastedColor}
                        strokeWidth="1"
                        strokeLinecap="round"
                    />
                    <line
                        x1={centerCoord}
                        y1={centerCoord - crossHairSize}
                        x2={centerCoord}
                        y2={centerCoord + crossHairSize}
                        stroke={contrastedColor}
                        strokeWidth="1"
                        strokeLinecap="round"
                    />
                    {/* Petit point central optionnel pour la précision */}
                    <circle
                        cx={centerCoord}
                        cy={centerCoord}
                        r={1}
                        fill={contrastedColor}
                    />
                </g>
            </svg>
        </div>

    );
});

export default SmartDetectLayer;