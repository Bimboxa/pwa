import throttle from "Features/misc/utils/throttle";
import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";

import cv from "Features/opencv/services/opencvService";

const SmartDetectLayer = forwardRef(({
    sourceImage, // L'élément DOM image source (statique)
    rotation = 0,
    loupeSize = 100,
    debug = false
}, ref) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // État mutable via Ref pour performance
    const stateRef = useRef({
        sourceROI: null,
        detectedPolylines: []
    });

    const [detectedPolylines, setDetectedPolylines] = useState([]);

    // --- HELPER DE DESSIN SYNCHRONE ---
    // Cette fonction dessine le ROI actuel dans le canvas.
    // Elle est appelée par update (visuel) ET par detectOrientationNow (logique)
    const drawToCanvas = (ctx, roi) => {

        if (!sourceImage || !roi) return false;

        // Nettoyage
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, loupeSize, loupeSize);

        try {
            // Dessin ROI
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

    // --- 2. ANALYSE VISUELLE (Throttled pour 60fps) ---
    const analyzeImageThrottled = useMemo(() => throttle(async (imageUrl) => {
        if (!imageUrl) return;
        try {
            await cv.load();
            const result = await cv.detectSeparationLinesAsync({ imageUrl, keepBest: true, rotation });
            const polylines = result?.polylines || [];

            stateRef.current.detectedPolylines = polylines;
            setDetectedPolylines(polylines);
        } catch (e) {
            // Silence
        }
    }, 60), []);


    // --- 1. EXPOSER L'API IMPÉRATIVE ---
    useImperativeHandle(ref, () => ({

        // A. Mise à jour visuelle (Souris)
        update: (screenPos, sourceROI) => {
            // 1. Déplacer la div
            if (containerRef.current) {
                containerRef.current.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) translate(-50%, -50%)`;
            }

            // 2. Stocker le ROI
            stateRef.current.sourceROI = sourceROI;

            // 3. Dessiner et lancer l'analyse visuelle
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
                const roi = stateRef.current.sourceROI;
                if (drawToCanvas(ctx, roi)) {
                    // On ne convertit en URL que si le dessin a réussi
                    analyzeImageThrottled(canvas.toDataURL('image/jpeg', 0.8)); // JPEG est plus rapide que PNG pour toDataURL
                }
            }
        },

        // B. Récupération résultats (Commit)
        getDetectedPolylines: () => stateRef.current.detectedPolylines,

        // C. Snapshot (Helper)
        getSnapshotDataUrl: () => {
            return canvasRef.current?.toDataURL('image/png');
        },

        // D. Analyse Ponctuelle (Auto-Pan)
        // Cette fonction doit être autonome et garantir que l'image analysée est fraîche
        detectOrientationNow: async () => {
            console.log("[SmartDetect] detectOrientationNow START");
            const canvas = canvasRef.current;
            if (!canvas) return null;

            // 1. FORCER LE REDESSIN (Crucial pour l'Auto-Pan qui bouge la caméra sans bouger la souris)
            // Si on ne redessine pas ici, on analyse l'image de la frame précédente !
            const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
            const roi = stateRef.current.sourceROI;
            const drawSuccess = drawToCanvas(ctx, roi);

            if (!drawSuccess) {
                console.warn("[SmartDetect] Cannot detect: Draw failed (Source not ready?)");
                return null;
            }

            // 2. Snapshot Frais
            // Utiliser 'image/jpeg' avec qualité 0.8 est souvent 4x plus rapide que png
            const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
            console.log("[SmartDetect] detectOrientationNow imageUrl", imageUrl);

            try {
                //await cv.load();

                // 3. Appel Worker`
                console.log("[SmartDetect] detectOrientationNow START");
                const result = await cv.detectSeparationLinesAsync({ imageUrl, keepBest: true, origin: "debug", rotation });
                console.log("[SmartDetect] detectOrientationNow END", result);
                const lines = result?.polylines || [];


                // 4. Interprétation
                if (lines.length === 0) return null;

                if (lines.some(l => l.type === 'corner')) return 'ANGLE';

                const hasH = lines.some(l => l.type === 'horizontal');
                const hasV = lines.some(l => l.type === 'vertical');

                if (hasH && hasV) return 'ANGLE';
                if (hasH) return 'H';
                if (hasV) return 'V';

                return null;

            } catch (e) {
                console.error("[SmartDetect] Orientation detect error", e);
                return null;
            }
        }
    }));

    // --- RENDER ---
    const centerCoord = loupeSize / 2;

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0, left: 0,
                width: loupeSize,
                height: loupeSize,
                boxSizing: 'border-box',
                overflow: 'hidden',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                backgroundColor: '#000',
                cursor: 'none',
                zIndex: 9999,
                pointerEvents: 'none',
            }}
        >
            <canvas ref={canvasRef} width={loupeSize} height={loupeSize} />

            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                {detectedPolylines.map((polylineObj, index) => {
                    const pointsStr = polylineObj.points.map(p => `${p.x},${p.y}`).join(' ');

                    // Style conditionnel pour debug visuel
                    let color = "red";
                    if (polylineObj.type === 'horizontal') color = "#00ccff"; // Cyan
                    if (polylineObj.type === 'vertical') color = "#ff00ff"; // Magenta
                    if (polylineObj.type === 'corner') color = "#00ff00"; // Vert

                    const commonProps = {
                        points: pointsStr,
                        fill: polylineObj.closeLine ? "rgba(255, 0, 0, 0.2)" : "none",
                        stroke: color,
                        strokeWidth: "2"
                    };

                    return polylineObj.closeLine ? (
                        <polygon key={index} {...commonProps} />
                    ) : (
                        <polyline key={index} {...commonProps} />
                    );
                })}

                {/* Viseur */}
                <circle cx={centerCoord} cy={centerCoord} r={3} fill="red" stroke="white" strokeWidth="1" />
            </svg>
        </div>
    );
});

export default SmartDetectLayer;