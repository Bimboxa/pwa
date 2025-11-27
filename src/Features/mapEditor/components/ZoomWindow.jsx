import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";

import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";
import TextOverlay from "./TextOverlay";

const CV_THROTTLE_MS = 100;

// --- Helper Functions (omitted for brevity) ---

function getContrastColor(hexColor) {
  /* ... */ return "#000000";
}
function rgbToHex(r, g, b) {
  /* ... */ return "#...";
}
function isNearWhite(hexColor, tolerance = 12) {
  /* ... */ return false;
}

function convertLineToDisplayCoords(
  line,
  bbox,
  imageWidth,
  imageHeight,
  displaySize
) {
  if (!line || !bbox || !imageWidth || !imageHeight) return null;
  const x1 = line.x1 * imageWidth;
  const y1 = line.y1 * imageHeight;
  const x2 = line.x2 * imageWidth;
  const y2 = line.y2 * imageHeight;

  const scaleX = displaySize / bbox.width;
  const scaleY = displaySize / bbox.height;

  const localX1 = (x1 - bbox.x) * scaleX;
  const localY1 = (y1 - bbox.y) * scaleY;
  const localX2 = (x2 - bbox.x) * scaleX;
  const localY2 = (y2 - bbox.y) * scaleY;

  if (
    !isFinite(localX1) ||
    !isFinite(localX2) ||
    !isFinite(localY1) ||
    !isFinite(localY2)
  ) {
    return null;
  }

  return { x1: localX1, y1: localY1, x2: localX2, y2: localY2 };
}

// --- Component ---

export default function ZoomWindow({
  screenX,
  screenY,
  baseMapImageUrl,
  screenToBaseLocal,
  baseMapSize = null,
  enableOcr = false,
  opencvMode = null,
  screenToBaseLocalUpdatedAt = null,
  variant = null,
}) {
  const canvasRef = useRef(null);

  // State
  const [borderColor, setBorderColor] = useState("#1976d2");
  const [imageReady, setImageReady] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("none");
  const [lineOverlay, setLineOverlay] = useState(null);
  const [lineAngle, setLineAngle] = useState(null);
  const [lineFlash, setLineFlash] = useState(false);

  // Refs
  const bitmapRef = useRef(null);
  const isMountedRef = useRef(true);
  const cvTimeoutRef = useRef(null);

  // Compute display size and scale factor based on variant
  const displaySize = useMemo(() => {
    if (variant === "HATCH_PREVIEW") return 100;
    if (variant === "REMOVE_TEXT") return 300;
    return 200;
  }, [variant]);

  const scaleFactor = useMemo(() => {
    if (variant === "HATCH_PREVIEW") return 20;
    if (variant === "REMOVE_TEXT") return 2;
    return 10;
  }, [variant]);

  // 1. Lifecycle & Image Loading (same as before)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setImageReady(false);
    if (bitmapRef.current) {
      bitmapRef.current.close?.();
      bitmapRef.current = null;
    }
    if (!baseMapImageUrl) return;
    let cancelled = false;
    const loadBitmap = async () => {
      try {
        const response = await fetch(baseMapImageUrl, { mode: "cors" });
        if (!response.ok) throw new Error("Failed");
        const blob = await response.blob();
        if (cancelled) return;
        const bitmap = await createImageBitmap(blob);
        if (cancelled) {
          bitmap.close();
          return;
        }
        bitmapRef.current = bitmap;
        if (isMountedRef.current) setImageReady(true);
      } catch (error) {
        console.error("ZoomWindow image load failed", error);
      }
    };
    loadBitmap();
    return () => {
      cancelled = true;
    };
  }, [baseMapImageUrl]);

  // 2. SYNCHRONOUSLY DERIVE viewportZoom using useMemo
  // Dependency is now strictly limited to screenToBaseLocal.
  // We use fixed input coordinates (0, 0) as anchors for the calculation, assuming uniform scale.
  const viewportZoom = useMemo(() => {
    if (!screenToBaseLocal) return 1.0;

    const screenDelta = 50;
    const inputX = 0; // Fixed input point
    const inputY = 0; // Fixed input point

    const baseCoord1 = screenToBaseLocal(inputX, inputY);
    const baseCoord2 = screenToBaseLocal(inputX + screenDelta, inputY);

    if (!baseCoord1 || !baseCoord2) return 1.0;

    const baseDeltaX = Math.abs(baseCoord2.x - baseCoord1.x);

    if (baseDeltaX < 0.0001) return 1.0;

    return screenDelta / baseDeltaX;
  }, [screenToBaseLocal, screenToBaseLocalUpdatedAt]);

  // 3. Computer Vision (Async) (useCallback)
  const runComputerVision = useCallback(
    async (bbox, baseCoords, currentColorHex) => {
      if (!isMountedRef.current) return;

      const detectionEnabled =
        opencvMode === "DETECT_STRAIGHT_LINE" &&
        baseMapSize?.width &&
        !isNearWhite(currentColorHex);

      try {
        if (detectionEnabled || enableOcr) {
          await cv.load();
        }

        if (detectionEnabled) {
          const normalizedX = baseCoords.x / baseMapSize.width;
          const normalizedY = baseCoords.y / baseMapSize.height;

          const detectionResult = await cv.detectStraightLineAsync({
            imageUrl: baseMapImageUrl,
            x: normalizedX,
            y: normalizedY,
            viewportBBox: editor.viewportInBase?.bounds,
          });

          if (isMountedRef.current) {
            if (detectionResult?.line) {
              const overlay = convertLineToDisplayCoords(
                detectionResult.line,
                bbox,
                baseMapSize.width,
                baseMapSize.height,
                displaySize
              );
              if (overlay) {
                setLineOverlay({ ...overlay, token: Date.now() });
                setLineAngle(
                  typeof detectionResult.angle === "number"
                    ? detectionResult.angle
                    : null
                );
              }
            }
          }
        }

        if (enableOcr) {
          setOcrStatus("running");
          cv.detectTextAsync({
            imageUrl: baseMapImageUrl,
            x: baseCoords.x,
            y: baseCoords.y,
            windowSize: bbox.width,
            bbox,
          })
            .then((result) => {
              if (isMountedRef.current) {
                const text = result?.text ?? "";
                setDetectedText(text);
                setOcrStatus(text.trim() ? "success" : "none");
              }
            })
            .catch(() => {
              if (isMountedRef.current) {
                setDetectedText("");
                setOcrStatus("none");
              }
            });
        }
      } catch (err) {
        console.warn("CV operations failed", err);
      }
    },
    [baseMapImageUrl, baseMapSize?.width, enableOcr, opencvMode, displaySize]
  );

  // 4. Drawing Logic (useCallback)
  const drawZoomWindow = useCallback(() => {
    if (!canvasRef.current || !imageReady || !bitmapRef.current || !baseMapSize)
      return;

    setLineOverlay(null);
    setLineAngle(null);

    const baseCoords = screenToBaseLocal?.(screenX, screenY);
    if (!baseCoords) return null;

    const imageWidth = baseMapSize.width;
    const imageHeight = baseMapSize.height;

    // --- DYNAMIC SCALING CALCULATION (using stable viewportZoom) ---
    const boxSize = Math.max(1, displaySize / (scaleFactor * viewportZoom));
    const halfWindow = boxSize / 2;

    const startX = Math.max(
      0,
      Math.min(imageWidth - boxSize, baseCoords.x - halfWindow)
    );
    const startY = Math.max(
      0,
      Math.min(imageHeight - boxSize, baseCoords.y - halfWindow)
    );

    const bbox = {
      x: startX,
      y: startY,
      width: Math.min(boxSize, imageWidth - startX),
      height: Math.min(boxSize, imageHeight - startY),
    };
    editor.zoomWindowBBox = bbox;

    // Draw
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const bitmap = bitmapRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
      bitmap,
      bbox.x,
      bbox.y,
      bbox.width,
      bbox.height,
      0,
      0,
      displaySize,
      displaySize
    );

    // Color Pick & Crosshair
    const centerX = displaySize / 2;
    const centerY = displaySize / 2;
    const p = ctx.getImageData(centerX, centerY, 1, 1).data;
    const hexColor = rgbToHex(p[0], p[1], p[2]);
    setBorderColor(hexColor);

    const crossColor = getContrastColor(hexColor);
    const crossSize = 10;
    ctx.strokeStyle = crossColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize / 2, centerY);
    ctx.lineTo(centerX + crossSize / 2, centerY);
    ctx.moveTo(centerX, centerY - crossSize / 2);
    ctx.lineTo(centerX, centerY + crossSize / 2);
    ctx.stroke();

    return { bbox, baseCoords, hexColor };
  }, [
    screenX,
    screenY,
    imageReady,
    baseMapSize,
    screenToBaseLocal,
    screenToBaseLocalUpdatedAt,
    viewportZoom,
    displaySize,
    scaleFactor,
    // Other dependencies for draw:
    bitmapRef.current,
    canvasRef.current,
    setLineOverlay,
    setLineAngle,
    setBorderColor,
  ]);

  // 5. useLayoutEffect (The Control Flow Trigger)
  // This now runs whenever the drawing function (drawZoomWindow) changes,
  // which happens when screenX/Y, or the stable viewportZoom change.
  useLayoutEffect(() => {
    if (cvTimeoutRef.current) clearTimeout(cvTimeoutRef.current);

    const drawResult = drawZoomWindow();

    if (drawResult) {
      cvTimeoutRef.current = setTimeout(() => {
        runComputerVision(
          drawResult.bbox,
          drawResult.baseCoords,
          drawResult.hexColor
        );
      }, CV_THROTTLE_MS);
    }
  }, [drawZoomWindow, runComputerVision]);

  // 6. UI Polish & Cleanup (same as before)
  useEffect(() => {
    if (!lineOverlay) return;
    setLineFlash(true);
    const timeout = setTimeout(() => setLineFlash(false), 250);
    return () => clearTimeout(timeout);
  }, [lineOverlay?.token]);

  useEffect(() => {
    if (!enableOcr) {
      setDetectedText("");
      setOcrStatus("none");
    }
  }, [enableOcr]);

  if (!baseMapImageUrl) return null;

  const getPosition = () => {
    let top = screenY - displaySize - 10;
    let left = screenX + 10;
    if (top < 10) top = screenY + 10;
    if (left + displaySize > window.innerWidth - 20)
      left = screenX - displaySize - 10;
    return { top, left };
  };

  const position = getPosition();

  return (
    <Box
      sx={{
        position: "absolute",
        pointerEvents: "none",
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${displaySize}px`,
        height: `${displaySize}px`,
        border: "4px solid",
        borderColor: borderColor,
        borderRadius: 1,
        bgcolor: "background.paper",
        boxShadow: 3,
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas
          ref={canvasRef}
          width={displaySize}
          height={displaySize}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            imageRendering: "pixelated",
          }}
        />

        {/* Overlays rendering logic here... */}
        {lineOverlay && (
          <>
            <Box
              component="svg"
              viewBox={`0 0 ${displaySize} ${displaySize}`}
              sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              <line
                x1={lineOverlay.x1}
                y1={lineOverlay.y1}
                x2={lineOverlay.x2}
                y2={lineOverlay.y2}
                stroke="rgba(0,255,128,0.95)"
                strokeWidth={4}
                strokeLinecap="round"
                style={{
                  opacity: lineFlash ? 1 : 0.35,
                  transition: "opacity 0.4s ease-out",
                  filter: "drop-shadow(0px 0px 6px rgba(0,255,128,0.7))",
                }}
              />
            </Box>
            {lineAngle != null && (
              <Box
                sx={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: "rgba(0,0,0,0.65)",
                  color: "success.main",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {`${lineAngle.toFixed(1)}°`}
              </Box>
            )}
          </>
        )}

        {enableOcr && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid rgba(0,0,0,0.2)",
              bgcolor:
                ocrStatus === "running"
                  ? "warning.main"
                  : ocrStatus === "success"
                  ? "success.main"
                  : "grey.500",
              boxShadow: 1,
            }}
          />
        )}

        {enableOcr && Boolean(detectedText?.trim()) && (
          <TextOverlay text={detectedText} anchor />
        )}
      </Box>
    </Box>
  );
}
