import { useRef, useState, useMemo, forwardRef, useImperativeHandle, useEffect } from "react";
import { useDispatch } from "react-redux";
import { setCenterColor as setGlobalCenterColor } from "Features/smartDetect/smartDetectSlice";
import { Box, Typography, List, ListItemButton, ListItemText } from "@mui/material";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import throttle from "Features/misc/utils/throttle";
import theme from "Styles/theme";
import cv from "Features/opencv/services/opencvService";

// --- ANIMATIONS & STYLES ---

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

const COLORS = {
    POINT: "#00ff00",    // Lime Green
    LINE: "#00ccff",     // Cyan
    RECTANGLE: "#FFD700" // Gold
};

const ModeListItem = styled(ListItemButton)(({ theme, selected, active }) => ({
    borderLeft: `3px solid ${selected ? theme.palette.primary.main : 'transparent'}`, // Bordure plus fine
    backgroundColor: selected ? 'rgba(0, 255, 255, 0.1)' : 'transparent',
    marginBottom: '2px', // Moins d'espace vertical
    padding: '2px 6px', // Padding compact
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    '&:hover': {
        backgroundColor: 'rgba(0, 255, 255, 0.2)',
    },
    boxShadow: active ? `inset 0 0 10px ${selected ? 'rgba(0,255,255,0.3)' : 'rgba(0,0,0,0.2)'}` : 'none',
}));

const DetectionIndicator = styled('span')(({ color, active }) => ({
    display: 'inline-block',
    width: '6px', // Plus petit
    height: '6px',
    borderRadius: '50%',
    backgroundColor: active ? color : 'transparent',
    boxShadow: active ? `0 0 6px ${color}` : 'none',
    marginRight: '6px', // Marge réduite
    transition: 'all 0.3s ease',
    border: `1px solid ${active ? color : '#555'}`
}));

const KeyboardHint = styled('span')(({ selected, color }) => ({
    fontSize: '0.6rem', // Font plus petite
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: selected ? color : '#888',
    border: `1px solid ${selected ? color : '#555'}`,
    borderRadius: '3px',
    padding: '0px 4px', // Padding très fin
    backgroundColor: selected ? `${color}15` : 'rgba(255,255,255,0.05)',
    boxShadow: selected ? `0 0 5px ${color}40` : 'none',
    minWidth: '16px',
    textAlign: 'center',
    transition: 'all 0.2s ease'
}));

// Footer dynamique avec couleur
const ControlsFooter = styled(Box)(({ color }) => ({
    marginTop: '4px', // Marge réduite
    paddingTop: '16px',
    borderTop: `1px solid ${color ? `${color}40` : 'rgba(255,255,255,0.1)'}`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.3s ease',
    opacity: color ? 1 : 0,
    transform: color ? 'translateY(0)' : 'translateY(-5px)'
}));

const ControlItem = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: '6px' // Gap réduit
});


// --- COMPOSANT PRINCIPAL ---

const SmartDetectLayer = forwardRef(({
    sourceImage,
    rotation = 0,
    loupeSize = 100,
    debug = false,
    enabled = false,
    onSmartShapeDetected, // <--- Unified Callback
}, ref) => {
    const dispatch = useDispatch();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const FIXED_IN_CONTAINER = true;

    // Configuration des Modes
    const detectModes = [
        { key: "POINT", label: "Point", color: COLORS.POINT, shortcut: "P" },
        { key: "LINE", label: "Ligne", color: COLORS.LINE, shortcut: "L" },
        { key: "RECTANGLE", label: "Rect.", color: COLORS.RECTANGLE, shortcut: "R" },
    ];

    // --- STATES ---
    const [selectedDetectMode, setSelectedDetectMode] = useState("POINT");

    const [detectedPolylines, setDetectedPolylines] = useState([]);
    const [processedImageUrl, setProcessedImageUrl] = useState(null);

    const [bestCorner, setBestCorner] = useState(null);
    const [bestLine, setBestLine] = useState(null);
    const [mainRectangle, setMainRectangle] = useState(null);

    const [centerColor, setCenterColor] = useState(theme.palette.primary.main);
    const contrastedColor = theme.palette.getContrastText(theme.palette.getContrastText(centerColor));

    // --- REF ---
    const stateRef = useRef({
        sourceROI: null,
        detectedPolylines: [],
        morphKernelSize: 3,
    });

    // --- KEYBOARD LISTENER ---
    useEffect(() => {
        if (!enabled) return;
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            const key = e.key.toUpperCase();
            if (key === 'P') setSelectedDetectMode('POINT');
            if (key === 'L') setSelectedDetectMode('LINE');
            if (key === 'R') setSelectedDetectMode('RECTANGLE');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);


    // --- DESSIN CANVAS ---
    const drawToCanvas = (ctx, roi) => {
        if (!sourceImage || !roi) return false;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, loupeSize, loupeSize);
        try {
            ctx.drawImage(sourceImage, roi.x, roi.y, roi.width, roi.height, 0, 0, loupeSize, loupeSize);
            return true;
        } catch (e) { return false; }
    };

    // --- ANALYSE OPENCV ---
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

            // Line Logic
            const polylines = result?.separationLines || [];
            if (polylines) {
                stateRef.current.detectedPolylines = polylines;
                setDetectedPolylines(polylines);
                const bestL = polylines.find(l => l.isBest) || polylines.find(l => l.type.includes('horizontal') || l.type.includes('vertical'));
                setBestLine(bestL || null);
            }
            if (result?.processedImageUrl) setProcessedImageUrl(result.processedImageUrl);

            setBestCorner(result.bestCorner);
            setMainRectangle(result.mainRectangle && result.mainRectangle.found ? result.mainRectangle : null);

            // --- UNIFIED CALLBACK LOGIC ---
            let detectedShape = null;

            if (selectedDetectMode === "POINT") {
                if (result.bestCorner) {
                    const { x, y } = result.bestCorner.point;
                    const scaleX = currentRoi.width / loupeSize;
                    const scaleY = currentRoi.height / loupeSize;
                    const point = { x: currentRoi.x + (x * scaleX), y: currentRoi.y + (y * scaleY) };
                    detectedShape = { type: 'POINT', points: [point] };
                }
            }
            else if (selectedDetectMode === "LINE") {
                // On utilise bestLine calculé au dessus (ou on le recalcule ici si le state n'est pas encore maj, ce qui est le cas dans ce tick)
                const bestL = polylines.find(l => l.isBest) || polylines.find(l => l.type.includes('horizontal') || l.type.includes('vertical'));
                if (bestL) {
                    const scaleX = currentRoi.width / loupeSize;
                    const scaleY = currentRoi.height / loupeSize;
                    const points = bestL.points.map(p => ({ x: currentRoi.x + (p.x * scaleX), y: currentRoi.y + (p.y * scaleY) }));
                    detectedShape = { type: 'LINE', points };
                }
            }
            else if (selectedDetectMode === "RECTANGLE") {
                if (result.mainRectangle && result.mainRectangle.found) {
                    const scaleX = currentRoi.width / loupeSize;
                    const scaleY = currentRoi.height / loupeSize;
                    const points = result.mainRectangle.points.map(p => ({ x: currentRoi.x + (p.x * scaleX), y: currentRoi.y + (p.y * scaleY) }));
                    detectedShape = { type: 'RECTANGLE', points };
                }
            }

            if (onSmartShapeDetected) {
                onSmartShapeDetected(detectedShape);
            }

            // Color Logic
            if (result?.centerColor) {
                setCenterColor(result.centerColor.hex);
                dispatch(setGlobalCenterColor(result.centerColor.hex));
            }
        } catch (e) { }
    }, 60), [enabled, loupeSize, selectedDetectMode, onSmartShapeDetected]);


    // --- API IMPÉRATIVE ---
    useImperativeHandle(ref, () => ({
        changeMorphKernelSize: (changeBy) => {
            const current = stateRef.current.morphKernelSize;
            const newValue = Math.max(0, Math.min(20, current + changeBy));
            stateRef.current.morphKernelSize = newValue;
            const canvas = canvasRef.current;
            if (canvas) analyzeImageThrottled(canvas.toDataURL('image/jpeg', 0.9), stateRef.current.sourceROI);
        },
        update: (screenPos, sourceROI) => {
            if (containerRef.current && !FIXED_IN_CONTAINER) {
                containerRef.current.style.transform = `translate(${screenPos.x}px, ${screenPos.y}px) translate(-50%, -50%)`;
            }
            stateRef.current.sourceROI = sourceROI;
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
                if (drawToCanvas(ctx, sourceROI)) analyzeImageThrottled(canvas.toDataURL('image/jpeg', 0.9), sourceROI);
            }
        },
        getDetectedPolylines: () => stateRef.current.detectedPolylines,
        getDetectedPoints: () => {
            if (selectedDetectMode === "POINT" && bestCorner) return [bestCorner.point];
            if (selectedDetectMode === "LINE" && bestLine) return bestLine.points;
            if (selectedDetectMode === "RECTANGLE" && mainRectangle) return mainRectangle.points;
            return [];
        },
        detectOrientationNow: async () => { return null; }
    }));

    // --- RENDER ---
    const centerCoord = loupeSize / 2;
    const crossHairSize = 8;

    const hasDetected = {
        POINT: !!bestCorner,
        LINE: !!bestLine,
        RECTANGLE: !!mainRectangle
    };

    // Est-ce que le mode ACTUEL a trouvé quelque chose ?
    const isCurrentModeDetected = hasDetected[selectedDetectMode];
    const currentColor = COLORS[selectedDetectMode];

    return (
        <Box sx={{ width: 1, display: "flex", gap: 1 }} ref={containerRef}> {/* Gap réduit à 1 */}

            {/* 1. LOUPE / HUD */}
            <div
                style={{
                    ...(!FIXED_IN_CONTAINER ? { position: 'absolute', top: 0, left: 0 } : { position: "relative" }),
                    width: loupeSize,
                    height: loupeSize,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    backgroundColor: "white",
                    border: `1px solid ${isCurrentModeDetected ? currentColor : 'rgba(0,0,0,0.2)'}`,
                    boxShadow: isCurrentModeDetected ? `0 0 15px ${currentColor}80` : 'none',
                    cursor: 'none',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    display: enabled ? 'block' : 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
            >
                <canvas ref={canvasRef} width={loupeSize} height={loupeSize} />

                {processedImageUrl && (
                    <img
                        src={processedImageUrl}
                        alt="Debug"
                        style={{
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'contain', pointerEvents: 'none',
                            opacity: 1,
                            //mixBlendMode: 'screen'
                        }}
                    />
                )}

                <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                    {selectedDetectMode === "LINE" && bestLine && (
                        <polyline
                            points={bestLine.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none" stroke={COLORS.LINE} strokeWidth="3"
                            style={{ animation: `${flashAnimation} 1.5s infinite ease-in-out` }}
                        />
                    )}
                    {selectedDetectMode === "RECTANGLE" && mainRectangle && (
                        <polygon
                            points={mainRectangle.points.map(p => `${p.x},${p.y}`).join(' ')}
                            fill={`${COLORS.RECTANGLE}33`} stroke={COLORS.RECTANGLE} strokeWidth="2" strokeDasharray="4 2"
                            style={{ animation: `${flashAnimation} 2s infinite ease-in-out` }}
                        />
                    )}
                    {selectedDetectMode === "POINT" && bestCorner && (
                        <g style={{
                            transform: `translate(${bestCorner.point.x}px, ${bestCorner.point.y}px)`,
                            animation: `${flashAnimation} 1s infinite ease-in-out`
                        }}>
                            <line x1={-8} y1={0} x2={8} y2={0} stroke={COLORS.POINT} strokeWidth={2} />
                            <line x1={0} y1={-8} x2={0} y2={8} stroke={COLORS.POINT} strokeWidth={2} />
                        </g>
                    )}
                    <g style={{ opacity: 0.8 }}>
                        <line x1={centerCoord - crossHairSize} y1={centerCoord} x2={centerCoord + crossHairSize} y2={centerCoord} stroke={contrastedColor} strokeWidth="1" />
                        <line x1={centerCoord} y1={centerCoord - crossHairSize} x2={centerCoord} y2={centerCoord + crossHairSize} stroke={contrastedColor} strokeWidth="1" />
                        <circle cx={centerCoord} cy={centerCoord} r={1} fill={contrastedColor} />
                    </g>
                </svg>
            </div>

            {/* 2. UI PANEL */}
            <Box sx={{
                display: enabled ? 'flex' : 'none',
                flexDirection: 'column',
                backgroundColor: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(4px)',
                borderRadius: '4px',
                padding: '4px', // Reduced padding
                //minWidth: '110px', // Reduced Width
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}>
                <Typography variant="caption" sx={{ color: '#888', px: 1, mb: 0.5, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    SCAN MODE
                </Typography>

                <List dense sx={{ py: 0 }}>
                    {detectModes.map(mode => {
                        const isSelected = mode.key === selectedDetectMode;
                        const isDetected = hasDetected[mode.key];
                        return (
                            <ModeListItem
                                key={mode.key}
                                selected={isSelected}
                                active={isDetected}
                                onClick={() => setSelectedDetectMode(mode.key)}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <DetectionIndicator color={mode.color} active={isDetected} />
                                    <ListItemText
                                        primary={mode.label}
                                        primaryTypographyProps={{
                                            variant: 'body2',
                                            style: {
                                                fontSize: '0.75rem', // Smaller text
                                                color: isSelected ? mode.color : (isDetected ? '#eee' : '#666'),
                                                fontWeight: isSelected ? 'bold' : 'normal',
                                                textShadow: isSelected ? `0 0 5px ${mode.color}` : 'none'
                                            }
                                        }}
                                    />
                                </Box>
                                <KeyboardHint selected={isSelected} color={mode.color}>
                                    {mode.shortcut}
                                </KeyboardHint>
                            </ModeListItem>
                        );
                    })}
                </List>

                {/* --- FOOTER DE VALIDATION CONDITIONNEL --- */}
                {isCurrentModeDetected && (
                    <ControlsFooter color={currentColor}>
                        <ControlItem>
                            <KeyboardHint
                                selected={true} // Force le style actif
                                color={currentColor}
                                style={{ minWidth: 'auto', padding: '2px 6px' }}
                            >
                                ESPACE
                            </KeyboardHint>
                            {/* <Typography variant="caption" sx={{ color: currentColor, fontSize: '0.65rem', fontWeight: 'bold' }}>
                                +
                            </Typography> */}
                        </ControlItem>
                    </ControlsFooter>
                )}

            </Box>
        </Box>
    );
});

export default SmartDetectLayer;