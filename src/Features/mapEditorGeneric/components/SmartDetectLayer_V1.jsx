// WORKING VERSION

import throttle from "Features/misc/utils/throttle";
import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";

import cv from "Features/opencv/services/opencvService";

const SmartDetectLayer = forwardRef(({
    sourceImage, // L'élément DOM image source (statique)
    loupeSize = 100,
    debug = false
}, ref) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null); // Ref pour déplacer la div

    // On stocke l'état courant dans des Refs pour y accéder sans re-render
    const stateRef = useRef({
        sourceROI: null,
        detectedPolylines: []
    });

    const [detectedPolylines, setDetectedPolylines] = useState([]); // Seul state conservé pour l'overlay SVG (moins fréquent)

    // --- 1. EXPOSER L'API IMPÉRATIVE ---
    useImperativeHandle(ref, () => ({
        // Cette fonction sera appelée 60 fois/sec par le parent
        update: (screenPos, sourceROI) => {
            // A. Déplacer la loupe (DOM Direct = Très rapide)
            if (containerRef.current) {
                // C'est cette double translation qui assure que le centre de la div
                // se trouve exactement aux coordonnées screenPos.x/y
                containerRef.current.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) translate(-50%, -50%)`;
            }

            // B. Mettre à jour les données internes
            stateRef.current.sourceROI = sourceROI;

            // C. Redessiner le canvas immédiatement
            drawAndAnalyze();
        },

        // Pour récupérer le résultat final (Appuyer sur Entrée)
        getDetectedPolylines: () => {
            return stateRef.current.detectedPolylines; // Retourne le dernier path trouvé
        }
    }));

    // --- 2. ANALYSE (Throttled) ---
    const analyzeImage = useMemo(() => throttle(async (ctx) => {
        // ... (Logique OpenCV inchangée) ...
        // NOTE : Si vous décommentez la logique d'analyse, assurez-vous que
        // les points retournés sont relatifs au coin haut-gauche de la loupe (0,0)
        // pour que le SVG s'affiche correctement par-dessus.

        cv.load();
        const imageUrl = ctx.canvas.toDataURL(); // Get image URL from canvas
        const { polylines } = await cv.detectSeparationLinesAsync({ imageUrl, keepBest: true });
        stateRef.current.detectedPolylines = polylines; // Pour l'export
        setDetectedPolylines(polylines); // Pour l'affichage visuel
    }, 60), []);


    // --- 3. DESSIN DU CANVAS ---
    const drawAndAnalyze = () => {
        const canvas = canvasRef.current;
        const roi = stateRef.current.sourceROI;

        if (!canvas || !sourceImage || !roi) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });

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

            // Analyse
            analyzeImage(ctx);
        } catch (e) { /*...*/ }
    };

    // --- 4. RENDER INITIAL ---
    // const svgPolygonPoints = detectedPath?.map(p => `${p.x},${p.y}`).join(' ') || "";

    // Le centre exact de la loupe
    const centerCoord = loupeSize / 2;

    return (
        <div
            ref={containerRef} // On attache la ref ici pour le mouvement
            style={{
                position: 'fixed',
                top: 0, left: 0,
                width: loupeSize,
                height: loupeSize,
                // CHANGEMENT 1: Suppression de borderRadius pour faire un carré
                // borderRadius: '50%',

                // CHANGEMENT 2: Ajout de border-box.
                // Crucial pour que la taille totale (incluant les 3px de bordure) soit exactement 'loupeSize'.
                // Cela garantit que le 'translate(-50%, -50%)' centre parfaitement le contenu.
                boxSizing: 'border-box',

                overflow: 'hidden',
                //border: '3px solid #ffffff',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                backgroundColor: '#000',
                cursor: 'none',
                zIndex: 9999,
                pointerEvents: 'none',
                // Note : Si la loupe apparaît en haut à gauche au chargement avant de bouger,
                // vous pouvez ajouter 'visibility: hidden' ici et le passer en 'visible'
                // lors du premier appel à update().
            }}
        >
            <canvas ref={canvasRef} width={loupeSize} height={loupeSize} />

            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                {detectedPolylines && detectedPolylines.map((polylineObj, index) => {
                    const pointsStr = polylineObj.points.map(p => `${p.x},${p.y}`).join(' ');
                    const commonProps = {
                        key: index,
                        points: pointsStr,
                        fill: polylineObj.closeLine ? "rgba(255, 0, 0, 0.2)" : "none",
                        stroke: "red",
                        strokeWidth: "2"
                    };

                    return polylineObj.closeLine ? (
                        <polygon {...commonProps} />
                    ) : (
                        <polyline {...commonProps} />
                    );
                })}
                {/* CHANGEMENT 3: Le point rouge central (existant, légèrement grossi pour visibilité) */}
                {/* Il est placé exactement au milieu du canvas */}
                <circle cx={centerCoord} cy={centerCoord} r={3} fill="red" stroke="white" strokeWidth="1" />
            </svg>
        </div>
    );
});

export default SmartDetectLayer;