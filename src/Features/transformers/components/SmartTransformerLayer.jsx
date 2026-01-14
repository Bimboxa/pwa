import { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setDisabled } from "../transformersSlice"; // Adaptez le chemin

//const ANALYSIS_SIZE = 512;
const ANALYSIS_SIZE = 1024;

const SmartTransformerLayer = forwardRef(({
    sourceImage,
    transformersWorker,
    debug = false
}, ref) => {

    const dispatch = useDispatch();

    // -- Refs DOM --
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const maskCanvasRef = useRef(null);

    // -- Refs Logique --
    const stateRef = useRef({ localPos: { x: 0, y: 0 } });

    // -- States UI --
    const [isLoading, setIsLoading] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);

    // -- Redux --
    const output = useSelector((state) => state.transformers.output);

    // -------------------------------------------------------------------------
    // 1. GESTION DES RÉSULTATS (WORKER -> UI)
    // -------------------------------------------------------------------------

    useEffect(() => {
        // Dès qu'on reçoit une réponse (output change), on arrête le chargement
        if (output) {
            setIsLoading(false);

            console.log("SmartTransformerLayer: output", output);

            if (Array.isArray(output) && output.length > 0) {
                // On dessine les calques reçus (avec transparence)
                const ctx = maskCanvasRef.current?.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

                output.forEach((layer, index) => {
                    if (index > 0) drawProcessedImage(layer.processedImageUrl); // we remove 1st result
                });
            }
        }
    }, [output]);

    const drawProcessedImage = (url) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        };
        img.src = url;
    };

    // -------------------------------------------------------------------------
    // 2. LOGIQUE DE SEGMENTATION (DÉCLENCHÉE PAR CLIC)
    // -------------------------------------------------------------------------

    const runSegmentationNow = () => {
        const canvas = canvasRef.current;
        const { localPos } = stateRef.current;
        if (!canvas || !sourceImage || !localPos || !transformersWorker) return;

        setIsLoading(true); // Début du chargement
        dispatch(setDisabled(true));

        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });

            // Calcul du crop
            const srcX = localPos.x - (ANALYSIS_SIZE / 2);
            const srcY = localPos.y - (ANALYSIS_SIZE / 2);

            // Extraction immédiate de l'image
            ctx.drawImage(sourceImage, srcX, srcY, ANALYSIS_SIZE, ANALYSIS_SIZE, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

            // Conversion et envoi au worker
            const imageUrl = canvas.toDataURL("image/jpeg", 0.8);

            const cx = ANALYSIS_SIZE / 2;
            const cy = ANALYSIS_SIZE / 2;

            transformersWorker.postMessage({
                imageUrl,
                points: [[[cx, cy]]],
                labels: [[1]]
            });
        } catch (err) {
            console.error("Erreur segmentation:", err);
            setIsLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // 3. GESTION CLAVIER (SUPPRIMER)
    // -------------------------------------------------------------------------

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                const ctx = maskCanvasRef.current?.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // -------------------------------------------------------------------------
    // 4. API EXTERNE (Via Ref)
    // -------------------------------------------------------------------------

    useImperativeHandle(ref, () => ({
        // Mise à jour de la position (Suivi de souris)
        update: (viewportPos, localPos, totalScale) => {
            if (!containerRef.current) return;

            // On met à jour la ref logique
            stateRef.current.localPos = localPos;

            // On met à jour le DOM
            const visualSize = ANALYSIS_SIZE * totalScale;
            containerRef.current.style.width = `${visualSize}px`;
            containerRef.current.style.height = `${visualSize}px`;
            containerRef.current.style.transform = `translate(${viewportPos.x}px, ${viewportPos.y}px) translate(-50%, -50%)`;
        },

        // NOUVELLE MÉTHODE : À appeler lors du clic souris
        trigger: () => {
            // 1. Effet Flash
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 150); // Reset après 150ms

            // 2. Lancer le calcul
            runSegmentationNow();
        },

        getCurrentResult: () => output,

        clear: () => {
            const ctx = maskCanvasRef.current?.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        }
    }));

    // -------------------------------------------------------------------------
    // 5. RENDU VISUEL
    // -------------------------------------------------------------------------

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed', top: 0, left: 0,
                width: 0, height: 0,
                zIndex: 9999,
                pointerEvents: 'none', // Laisse passer les clics vers le parent
                transition: 'border-color 0.1s ease' // Animation douce
            }}
        >
            <div style={{
                width: '100%', height: '100%', position: 'relative',
                // Gestion du style Flash (Blanc si flash, sinon pointillés ou rouge debug)
                border: isFlashing
                    ? '4px solid #fff'
                    : (debug ? '2px solid red' : '1px dashed rgba(255, 255, 255, 0.5)'),
                boxShadow: isFlashing
                    ? '0 0 15px rgba(255, 255, 255, 0.8)'
                    : '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
                borderRadius: '4px',
                transition: 'all 0.1s ease-out'
            }}>

                {/* Canvas source caché */}
                <canvas ref={canvasRef} width={ANALYSIS_SIZE} height={ANALYSIS_SIZE} style={{ display: 'none' }} />

                {/* Canvas Résultat */}
                <canvas ref={maskCanvasRef} width={ANALYSIS_SIZE} height={ANALYSIS_SIZE}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 1 }} />

                {/* Réticule Central (Caché si chargement) */}
                {!isLoading && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '20px', height: '20px', pointerEvents: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(255, 50, 50, 0.8)' }}></div>
                        <div style={{ position: 'absolute', height: '100%', width: '1px', background: 'rgba(255, 50, 50, 0.8)' }}></div>
                        <div style={{ width: '4px', height: '4px', background: 'white', borderRadius: '50%', boxShadow: '0 0 2px black' }}></div>
                    </div>
                )}

                {/* Indicateur de Chargement (Spinner CSS simple) */}
                {isLoading && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '40px', height: '40px',
                        border: '4px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '4px solid #00ff00',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }}>
                        <style>{`
                            @keyframes spin { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
                        `}</style>
                    </div>
                )}

            </div>
        </div>
    );
});

export default SmartTransformerLayer;