import { useRef, useState, useMemo, forwardRef, useImperativeHandle, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setDisabled } from "../transformersSlice";
import throttle from "Features/misc/utils/throttle";

const ANALYSIS_SIZE = 512;

// Liste des classes à ignorer automatiquement (ex: le fond de plan)
const IGNORED_LABELS = ['floor', 'ceiling', 'sky', 'ground'];

// --- UTILITAIRES COULEURS ---

const generateColor = (index, total) => {
    // Angle d'or pour une bonne distribution des couleurs
    const hue = (index * 137.508) % 360;
    return {
        h: hue,
        s: 85,
        l: 55,
        css: `hsla(${hue}, 85%, 55%, 0.6)`,
        stroke: `hsl(${hue}, 85%, 40%)`
    };
};

const hslToRgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
};

// --- COMPOSANT ---

const SmartTransformerLayer = forwardRef(({
    sourceImage,
    transformersWorker,
    debug = false
}, ref) => {

    const dispatch = useDispatch();

    // Refs DOM
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const maskCanvasRef = useRef(null);

    // Refs Logique (Pour éviter re-renders)
    const stateRef = useRef({ localPos: { x: 0, y: 0 } });
    const isRunningRef = useRef(false); // Sémaphore pour le worker
    const requestAnalysisRef = useRef(null); // Handle pour requestAnimationFrame

    // Redux
    const ready = useSelector((state) => state.transformers.ready);
    const output = useSelector((state) => state.transformers.output);

    // State UI
    const [hiddenIndices, setHiddenIndices] = useState(new Set());
    const [segmentationResults, setSegmentationResults] = useState([]);

    // --- 1. WORKER & PREPARATION ---

    // Débloquer le sémaphore quand l'IA a fini
    useEffect(() => {
        isRunningRef.current = false;
    }, [output]);

    const segment = (imageUrl) => {
        if (transformersWorker) {
            dispatch(setDisabled(true));
            transformersWorker.postMessage({ imageUrl });
        }
    };

    // Throttled : On n'appelle l'IA que toutes les 200ms max
    const runSegmentation = useMemo(() => throttle((canvasElement) => {
        // Si le worker bosse déjà ou n'est pas là, on sort
        if (!transformersWorker || isRunningRef.current) return;

        try {
            isRunningRef.current = true; // On verrouille

            // Qualité 0.6 est un bon compromis Vitesse/Précision pour l'IA
            const imageUrl = canvasElement.toDataURL("image/jpeg", 0.6);
            segment(imageUrl);
        } catch (err) {
            console.error("Segmentation error:", err);
            isRunningRef.current = false; // Déverrouillage sécurité
        }
    }, 200), [transformersWorker]);


    // --- 2. API IMPÉRATIVE (Performance Critical) ---

    useImperativeHandle(ref, () => ({
        update: (viewportPos, localPos, totalScale) => {
            if (!containerRef.current) return;

            // A. MISE A JOUR VISUELLE (Instantanée - Zéro Lag)
            const visualSize = ANALYSIS_SIZE * totalScale;
            containerRef.current.style.width = `${visualSize}px`;
            containerRef.current.style.height = `${visualSize}px`;
            containerRef.current.style.transform = `translate(${viewportPos.x}px, ${viewportPos.y}px) translate(-50%, -50%)`;

            // B. MISE A JOUR LOGIQUE (Différée via rAF)
            stateRef.current.localPos = localPos;
            requestAnalysis();
        },
        getCurrentResult: () => segmentationResults,
        setResults: (results) => setSegmentationResults(results)
    }));

    const requestAnalysis = () => {
        // On annule la demande précédente si elle n'a pas encore été traitée
        if (requestAnalysisRef.current) cancelAnimationFrame(requestAnalysisRef.current);

        // On planifie le dessin et l'analyse pour la prochaine frame dispo
        requestAnalysisRef.current = requestAnimationFrame(() => {
            drawAndAnalyze();
        });
    };

    const drawAndAnalyze = () => {
        const canvas = canvasRef.current;
        const { localPos } = stateRef.current;
        if (!canvas || !sourceImage || !localPos) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });

        const srcX = localPos.x - (ANALYSIS_SIZE / 2);
        const srcY = localPos.y - (ANALYSIS_SIZE / 2);

        // 1. Dessin du crop (Rapide)
        ctx.drawImage(sourceImage, srcX, srcY, ANALYSIS_SIZE, ANALYSIS_SIZE, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);

        // 2. Lancement IA (Throttled)
        runSegmentation(canvas);
    };


    // --- 3. DESSIN DU MASQUE ---

    useEffect(() => {
        if (!output) return;
        drawRawMask(output);
    }, [output, hiddenIndices]);

    const drawRawMask = (results) => {
        const canvas = maskCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const imgData = ctx.createImageData(ANALYSIS_SIZE, ANALYSIS_SIZE);
        const pixels = imgData.data;

        results.forEach((result, index) => {
            // Filtres : Masqué manuellement OU label ignoré (ex: floor)
            if (hiddenIndices.has(index) || IGNORED_LABELS.includes(result.label)) return;

            // Couleur
            const { h, s, l } = generateColor(index, results.length);
            const [r, g, b] = hslToRgb(h, s, l);

            const rawData = result.mask.data;
            const channels = result.mask.channels || 1;

            for (let i = 0; i < rawData.length; i += channels) {
                if (rawData[i] > 0) { // Si pixel actif
                    const pixelIndex = (i / channels) * 4;
                    // Application couleur semi-transparente
                    pixels[pixelIndex + 0] = r;
                    pixels[pixelIndex + 1] = g;
                    pixels[pixelIndex + 2] = b;
                    pixels[pixelIndex + 3] = 120; // Alpha ~47%
                }
            }
        });

        ctx.putImageData(imgData, 0, 0);
    };


    // --- 4. GESTION UI (Clavier + Toggle) ---

    useEffect(() => {
        const handleKeyDown = (e) => {
            const num = parseInt(e.key);
            if (!isNaN(num) && num > 0 && output && output[num - 1]) {
                toggleLayer(num - 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [output, hiddenIndices]);

    const toggleLayer = (index) => {
        setHiddenIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    // --- 5. RENDU JSX ---

    const renderOverlay = () => {
        // Optionnel : Si tu utilises encore la vectorisation en plus du rawMask
        return segmentationResults.map((item, i) => {
            if (hiddenIndices.has(i) || IGNORED_LABELS.includes(item.label)) return null;
            if (item.points) {
                const pointsStr = item.points.map(p => `${p.x},${p.y}`).join(' ');
                const color = generateColor(i);
                return (
                    <polygon
                        key={i}
                        points={pointsStr}
                        fill="transparent"
                        stroke={color.stroke}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                );
            }
            return null;
        });
    };

    const renderLegend = () => {
        if (!output || output.length === 0) return null;

        // On filtre les items ignorés globalement (floor) pour ne pas polluer la légende
        const validItems = output.map((item, idx) => ({ ...item, originalIndex: idx }))
            .filter(item => !IGNORED_LABELS.includes(item.label));

        if (validItems.length === 0) return null;

        return (
            <div style={{
                position: 'absolute', left: '100%', top: 0, marginLeft: '12px',
                backgroundColor: 'rgba(20, 20, 20, 0.85)', backdropFilter: 'blur(4px)',
                color: 'white', padding: '12px', borderRadius: '8px',
                fontSize: '12px', whiteSpace: 'nowrap', pointerEvents: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ marginBottom: '8px', fontWeight: '600', color: '#eee', borderBottom: '1px solid #444', paddingBottom: '4px' }}>
                    Objets Détectés
                </div>
                {validItems.map((item) => {
                    const index = item.originalIndex;
                    const color = generateColor(index);
                    const isHidden = hiddenIndices.has(index);

                    return (
                        <div key={index} onClick={() => toggleLayer(index)}
                            style={{
                                display: 'flex', alignItems: 'center', marginBottom: '6px',
                                cursor: 'pointer', opacity: isHidden ? 0.5 : 1, transition: 'opacity 0.2s'
                            }}
                        >
                            <div style={{
                                width: '12px', height: '12px', backgroundColor: color.css,
                                border: `1px solid ${color.stroke}`, marginRight: '8px', borderRadius: '3px'
                            }} />

                            <span style={{ marginRight: '12px', textTransform: 'capitalize', flex: 1 }}>
                                {item.label} <span style={{ opacity: 0.6, fontSize: '0.9em' }}>({Math.round(item.score * 100)}%)</span>
                            </span>

                            <span style={{
                                backgroundColor: '#444', color: '#aaa', padding: '1px 6px',
                                borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace'
                            }}>
                                {index + 1}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed', top: 0, left: 0,
                width: 0, height: 0, // Géré par update()
                zIndex: 9999,
                // Pas d'overflow hidden sur le parent pour laisser dépasser la légende
                pointerEvents: 'none' // Important : le container laisse passer les clics
            }}
        >
            {/* Wrapper de cropping (Lui il coupe) */}
            <div style={{
                width: '100%', height: '100%',
                overflow: 'hidden', position: 'relative',
                border: debug ? '2px solid red' : '2px dashed rgba(255,255,255,0.6)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)', // Effet "Focus"
                ...(ready && { borderColor: "rgba(100, 255, 100, 0.8)" })
            }}>

                {/* Canvas Source (Caché) */}
                <canvas ref={canvasRef} width={ANALYSIS_SIZE} height={ANALYSIS_SIZE}
                    style={{ display: debug ? 'block' : 'none', width: '100%', height: '100%' }} />

                {/* Canvas Masque */}
                <canvas ref={maskCanvasRef} width={ANALYSIS_SIZE} height={ANALYSIS_SIZE}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

                {/* SVG Vectoriel */}
                <svg width="100%" height="100%" viewBox={`0 0 ${ANALYSIS_SIZE} ${ANALYSIS_SIZE}`}
                    preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                    {renderOverlay()}

                    {/* Réticule */}
                    <path d="M 246 256 L 266 256 M 256 246 L 256 266" stroke="white" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 1px black)' }} />
                </svg>
            </div>

            {renderLegend()}
        </div>
    );
});

export default SmartTransformerLayer;