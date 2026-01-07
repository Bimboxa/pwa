import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import { useDispatch } from "react-redux";
import { setCenterColor as setGlobalCenterColor } from "Features/smartDetect/smartDetectSlice";
import { Box, Typography, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import throttle from "Features/misc/utils/throttle";
import theme from "Styles/theme";
import cv from "Features/opencv/services/opencvService";

// --- STYLES & ANIMATIONS ---

const flashAnimation = keyframes`
  0% { opacity: 0.6; stroke-width: 2; filter: drop-shadow(0 0 2px currentColor); }
  50% { opacity: 1; stroke-width: 4; filter: drop-shadow(0 0 8px currentColor); }
  100% { opacity: 0.6; stroke-width: 2; filter: drop-shadow(0 0 2px currentColor); }
`;

const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
`;

// Couleurs "Futuristes"
const COLORS = {
    POINT: "#00ff00",    // Lime Green
    LINE: "#00ccff",     // Cyan
    RECTANGLE: "#ff00ff" // Magenta / Neon Pink
};

const ModeListItem = styled(ListItemButton)(({ theme, selected, active }) => ({
    borderLeft: `4px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
    backgroundColor: selected ? 'rgba(0, 255, 255, 0.1)' : 'transparent',
    marginBottom: '4px',
    transition: 'all 0.2s ease',
    '&:hover': {
        backgroundColor: 'rgba(0, 255, 255, 0.2)',
    },
    // Indicateur "Détecté" (Glow effect si un objet est trouvé pour ce mode)
    boxShadow: active ? `inset 0 0 10px ${selected ? 'rgba(0,255,255,0.3)' : 'rgba(0,0,0,0.2)'}` : 'none',
}));

const DetectionIndicator = styled('span')(({ color, active }) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: active ? color : 'transparent',
    boxShadow: active ? `0 0 8px ${color}` : 'none',
    marginRight: '8px',
    transition: 'all 0.3s ease',
    border: `1px solid ${active ? color : '#555'}`
}));


const SmartDetectLayer = forwardRef(({
    sourceImage,
    rotation = 0,
    loupeSize = 100,
    debug = false,
    enabled = false,
    onLineDetected,
    onCornerDetected,
}, ref) => {
    const dispatch = useDispatch();

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Options
    const FIXED_IN_CONTAINER = true;

    // --- DETECT MODES ---
    // Ordre : Clé, Label, Couleur associée
    const detectModes = [
        { key: "POINT", label: "Point", color: COLORS.POINT },
        { key: "LINE", label: "Ligne", color: COLORS.LINE },
        { key: "RECTANGLE", label: "Rect.", color: COLORS.RECTANGLE },
    ];

    // --- STATES ---

    const [selectedDetectMode, setSelectedDetectMode] = useState("POINT");

    const [detectedPolylines, setDetectedPolylines] = useState([]);
    const [processedImageUrl, setProcessedImageUrl] = useState(null);

    // Objets détectés (Source de vérité pour l'UI)
    const [bestCorner, setBestCorner] = useState(null);
    const [bestLine, setBestLine] = useState(null); // Line spécifique (horizontale/verticale best)
    const [mainRectangle, setMainRectangle] = useState(null);

    const [centerColor, setCenterColor] = useState(theme.palette.primary.main);
    const contrastedColor = theme.palette.getContrastText(centerColor);

    // --- REF ---
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

    // --- ANALYSE VISUELLE ---
    const analyzeImageThrottled = useMemo(() => throttle(async (imageUrl, currentRoi) => {
        if (!imageUrl || !enabled) return;

        const currentKernelSize = stateRef.current.morphKernelSize;

        try {
            await cv.load();
            const result = await cv.detectShapesAsync({
                imageUrl,
                morphKernelSize: currentKernelSize,
                rotation,
                keepBest: false,
            });

            const polylines = result?.polylines || [];
            if (polylines) {
                stateRef.current.detectedPolylines = polylines;
                setDetectedPolylines(polylines);

                // Extraction de la "Meilleure Ligne" pour le mode LINE
                // On cherche la ligne marquée "isBest" par le worker, ou la plus longue H/V
                const bestL = polylines.find(l => l.isBest) || polylines.find(l => l.type.includes('horizontal') || l.type.includes('vertical'));
                setBestLine(bestL || null);
            }

            if (result?.processedImageUrl) {
                setProcessedImageUrl(result.processedImageUrl);
            }

            // --- OBJET 1: POINT (Corner) ---
            setBestCorner(result.bestCorner); // Null ou Objet

            // Callback pour le parent (si mode POINT actif ou global)
            if (result.bestCorner) {
                const { x, y } = result.bestCorner.point;
                const scaleX = currentRoi.width / loupeSize;
                const scaleY = currentRoi.height / loupeSize;
                const point = {
                    x: currentRoi.x + (x * scaleX),
                    y: currentRoi.y + (y * scaleY)
                };
                onCornerDetected(point);
            } else {
                onCornerDetected(null);
            }

            // --- OBJET 3: RECTANGLE ---
            setMainRectangle(result.mainRectangle && result.mainRectangle.found ? result.mainRectangle : null);

            // --- COULEUR CENTRALE ---
            if (result?.centerColor) {
                setCenterColor(result.centerColor.hex);
                dispatch(setGlobalCenterColor(result.centerColor.hex));
            }

        } catch (e) {
            // Silence
        }
    }, 60), [enabled, loupeSize]);


    // --- API IMPÉRATIVE ---
    useImperativeHandle(ref, () => ({
        changeMorphKernelSize: (changeBy) => {
            const current = stateRef.current.morphKernelSize;
            const newValue = Math.max(0, Math.min(20, current + changeBy));
            stateRef.current.morphKernelSize = newValue;
            const canvas = canvasRef.current;
            if (canvas) {
                analyzeImageThrottled(canvas.toDataURL('image/jpeg', 0.9), stateRef.current.sourceROI);
            }
        },
        update: (screenPos, sourceROI) => {
            if (containerRef.current && !FIXED_IN_CONTAINER) {
                containerRef.current.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) translate(-50%, -50%)`;
            }
            stateRef.current.sourceROI = sourceROI;
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
                if (drawToCanvas(ctx, sourceROI)) {
                    analyzeImageThrottled(canvas.toDataURL('image/jpeg', 0.9), sourceROI);
                }
            }
        },
        // ... (autres méthodes inchangées)
    }));

    // --- RENDER ---
    const centerCoord = loupeSize / 2;
    const crossHairSize = 8;

    // Helper pour savoir si un mode a détecté quelque chose
    const hasDetected = {
        POINT: !!bestCorner,
        LINE: !!bestLine,
        RECTANGLE: !!mainRectangle
    };

    return (
        <Box sx={{ width: 1, display: "flex", gap: 0.5 }} ref={containerRef}>

            {/* --- LA LOUPE VISUELLE --- */}
            <div
                style={{
                    ...(!FIXED_IN_CONTAINER ? { position: 'absolute', top: 0, left: 0 } : { position: "relative" }),
                    width: loupeSize,
                    height: loupeSize,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    backgroundColor: "white",
                    // Style HUD Futuriste pour le conteneur
                    border: `1px solid ${COLORS[selectedDetectMode]}`,
                    boxShadow: `0 0 15px ${COLORS[selectedDetectMode]}80`, // Glow
                    cursor: 'none',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    display: enabled ? 'block' : 'none'
                }}
            >
                <canvas ref={canvasRef} width={loupeSize} height={loupeSize} />

                {/* Image debug (morphologie) */}
                {processedImageUrl && (
                    <img
                        src={processedImageUrl}
                        alt="Debug"
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'contain', pointerEvents: 'none', opacity: 0.5, mixBlendMode: 'screen'
                        }}
                    />
                )}

                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>

                    {/* --- MODE LIGNE --- */}
                    {selectedDetectMode === "LINE" && bestLine && (
                        <polyline
                            points={bestLine.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={COLORS.LINE}
                            strokeWidth="3"
                            style={{
                                animation: `${flashAnimation} 1.5s infinite ease-in-out`
                            }}
                        />
                    )}

                    {/* --- MODE RECTANGLE --- */}
                    {selectedDetectMode === "RECTANGLE" && mainRectangle && (
                        <polygon
                            points={mainRectangle.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill={`${COLORS.RECTANGLE}33`} // Transparent Fill
                            stroke={COLORS.RECTANGLE}
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            style={{
                                animation: `${flashAnimation} 2s infinite ease-in-out`
                            }}
                        />
                    )}

                    {/* --- MODE POINT --- */}
                    {selectedDetectMode === "POINT" && bestCorner && (
                        <g>
                            <circle
                                cx={bestCorner.point.x}
                                cy={bestCorner.point.y}
                                r={4}
                                fill={COLORS.POINT}
                                stroke="white"
                                strokeWidth="2"
                            />
                            {/* Onde de choc (Pulse) */}
                            <circle
                                cx={bestCorner.point.x}
                                cy={bestCorner.point.y}
                                r={8}
                                fill="none"
                                stroke={COLORS.POINT}
                                strokeWidth="1"
                                style={{
                                    transformOrigin: `${bestCorner.point.x}px ${bestCorner.point.y}px`,
                                    animation: `${pulseAnimation} 1s infinite`
                                }}
                            />
                        </g>
                    )}

                    {/* CROSSHAIR FIXE (Viseur) */}
                    <g style={{ opacity: 0.8 }}>
                        <line
                            x1={centerCoord - crossHairSize} y1={centerCoord}
                            x2={centerCoord + crossHairSize} y2={centerCoord}
                            stroke={contrastedColor} strokeWidth="1"
                        />
                        <line
                            x1={centerCoord} y1={centerCoord - crossHairSize}
                            x2={centerCoord} y2={centerCoord + crossHairSize}
                            stroke={contrastedColor} strokeWidth="1"
                        />
                        <circle cx={centerCoord} cy={centerCoord} r={1} fill={contrastedColor} />
                    </g>
                </svg>
            </div>

            {/* --- LISTE DES MODES (HUD) --- */}
            <Box sx={{
                display: enabled ? 'block' : 'none',
                backgroundColor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
                borderRadius: '4px',
                padding: '4px',
                //minWidth: '120px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                {/* <Typography variant="caption" sx={{ color: '#aaa', px: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
                    SCAN MODE
                </Typography> */}
                <List dense sx={{ py: 0 }}>
                    {detectModes.map(mode => {
                        const isSelected = mode.key === selectedDetectMode;
                        const isDetected = hasDetected[mode.key];

                        return (
                            <ModeListItem
                                key={mode.key}
                                selected={isSelected}
                                active={isDetected} // Prop custom pour le style
                                onClick={() => setSelectedDetectMode(mode.key)}
                            >
                                <DetectionIndicator
                                    color={mode.color}
                                    active={isDetected}
                                />
                                <ListItemText
                                    primary={mode.label}
                                    primaryTypographyProps={{
                                        variant: 'body2',
                                        style: {
                                            color: isSelected ? mode.color : (isDetected ? '#eee' : '#666'),
                                            fontWeight: isSelected ? 'bold' : 'normal',
                                            textShadow: isSelected ? `0 0 5px ${mode.color}` : 'none'
                                        }
                                    }}
                                />
                            </ModeListItem>
                        );
                    })}
                </List>
            </Box>
        </Box>
    );
});

export default SmartDetectLayer;