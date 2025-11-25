import { useEffect, useRef, useState, useCallback } from "react";
import { Box } from "@mui/material";
import cv from "Features/opencv/services/opencvService";
import editor from "App/editor";
import TextOverlay from "./TextOverlay";

const ZOOM_WINDOW_SIZE = 50; // pixels in baseMap coordinates
const DISPLAY_SIZE = 200; // pixels on screen
const UPDATE_THROTTLE_MS = 100; // Throttle line detection updates

// Calculate luminance of a hex color and return contrasting color (black or white)
function getContrastColor(hexColor) {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using the formula from WCAG
  // https://www.w3.org/WAI/GL/wiki/Relative_luminance
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // If luminance is high (light color), use black; otherwise use white
  return luminance > 128 ? "#000000" : "#ffffff";
}

export default function ZoomWindow({
  screenX,
  screenY,
  baseMapImageUrl,
  screenToBaseLocal,
  baseMapSize = null,
  enableOcr = false,
}) {
  const canvasRef = useRef(null);
  const [borderColor, setBorderColor] = useState("#1976d2"); // Default primary color
  const [detectedText, setDetectedText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("none"); // none | running | success
  const lastUpdateRef = useRef(0);
  const textUpdateRef = useRef(0);
  const pendingUpdateRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enableOcr && detectedText) {
      setDetectedText("");
      setOcrStatus("none");
    }
    if (!enableOcr) {
      setOcrStatus("none");
    }
  }, [enableOcr, detectedText]);

  const hasDetectedText = Boolean(detectedText?.trim());

  // Convert screen coordinates to baseMap coordinates
  const getBaseMapCoords = useCallback(() => {
    if (!screenToBaseLocal || screenX === undefined || screenY === undefined) {
      return null;
    }
    const baseCoords = screenToBaseLocal(screenX, screenY);
    return baseCoords;
  }, [screenX, screenY, screenToBaseLocal]);

  // Update zoom window image
  const updateZoomWindow = useCallback(async () => {
    if (!baseMapImageUrl || !canvasRef.current) return;

    const baseCoords = getBaseMapCoords();
    if (!baseCoords) return;

    const imageWidth = baseMapSize?.width;
    const imageHeight = baseMapSize?.height;
    if (!imageWidth || !imageHeight) return;

    const windowSizePx = ZOOM_WINDOW_SIZE;
    const halfWindow = Math.floor(windowSizePx / 2);
    const startX = Math.max(
      0,
      Math.min(imageWidth - windowSizePx, Math.floor(baseCoords.x - halfWindow))
    );
    const startY = Math.max(
      0,
      Math.min(
        imageHeight - windowSizePx,
        Math.floor(baseCoords.y - halfWindow)
      )
    );
    const bbox = {
      x: startX,
      y: startY,
      width: Math.min(windowSizePx, imageWidth - startX),
      height: Math.min(windowSizePx, imageHeight - startY),
    };
    editor.zoomWindowBBox = bbox;

    const now = Date.now();
    if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) {
      // Throttle updates
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }
      pendingUpdateRef.current = requestAnimationFrame(() => {
        if (isMountedRef.current) {
          updateZoomWindow();
        }
      });
      return;
    }
    lastUpdateRef.current = now;

    try {
      await cv.load();

      // Get pixel color for border (await to ensure we have the color before drawing)
      const pixelColorResult = await cv.getPixelColorAsync({
        imageUrl: baseMapImageUrl,
        x: baseCoords.x,
        y: baseCoords.y,
      });

      if (isMountedRef.current && pixelColorResult?.colorHex) {
        setBorderColor(pixelColorResult.colorHex);
      }

      if (enableOcr) {
        const textNow = Date.now();
        if (textNow - textUpdateRef.current > 500) {
          // Throttle text detection to every 500ms
          textUpdateRef.current = textNow;
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
      }

      if (!isMountedRef.current) return;

      // Get the pixel color for cross contrast calculation
      const currentBorderColor = pixelColorResult?.colorHex || borderColor;

      // Draw on canvas - extract the 50x50px region directly
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          if (!isMountedRef.current) return;

          const sourceX = Math.max(0, Math.min(img.naturalWidth, bbox.x));
          const sourceY = Math.max(0, Math.min(img.naturalHeight, bbox.y));
          const sourceWidth = Math.min(bbox.width, img.naturalWidth - sourceX);
          const sourceHeight = Math.min(
            bbox.height,
            img.naturalHeight - sourceY
          );

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw the cropped region, scaled up to DISPLAY_SIZE
          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight, // source rectangle
            0,
            0,
            DISPLAY_SIZE,
            DISPLAY_SIZE // destination rectangle
          );

          // Draw cross in the center (10px lines)
          const centerX = DISPLAY_SIZE / 2;
          const centerY = DISPLAY_SIZE / 2;
          const crossSize = 10;

          // Get contrasting color based on border color
          const crossColor = getContrastColor(currentBorderColor);

          ctx.strokeStyle = crossColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Horizontal line
          ctx.moveTo(centerX - crossSize / 2, centerY);
          ctx.lineTo(centerX + crossSize / 2, centerY);
          // Vertical line
          ctx.moveTo(centerX, centerY - crossSize / 2);
          ctx.lineTo(centerX, centerY + crossSize / 2);
          ctx.stroke();
        };
        img.onerror = () => {
          console.error("Failed to load image for zoom window");
        };
        img.src = baseMapImageUrl;
      }
    } catch (error) {
      // Silently handle out-of-bounds errors (mouse outside baseMap)
      if (
        error?.message?.includes("out of bounds") ||
        error?.error?.includes("out of bounds")
      ) {
        return;
      }
      console.error("Failed to update zoom window:", error);
    }
  }, [baseMapImageUrl, getBaseMapCoords, borderColor]);

  // Update when position or image changes
  useEffect(() => {
    if (pendingUpdateRef.current) {
      cancelAnimationFrame(pendingUpdateRef.current);
    }
    pendingUpdateRef.current = requestAnimationFrame(() => {
      if (isMountedRef.current) {
        updateZoomWindow();
      }
    });
  }, [screenX, screenY, baseMapImageUrl, updateZoomWindow]);

  if (!baseMapImageUrl) return null;

  // Position the zoom window to avoid overlapping the cursor
  // Try to place it to the right and above the cursor, but adjust if needed
  const getPosition = () => {
    // Default: top-right of cursor
    let top = screenY - DISPLAY_SIZE - 10;
    let left = screenX + 10;

    // If too close to top, place below cursor
    if (top < 10) {
      top = screenY + 10;
    }

    // If too close to right edge, place to the left
    // (We'd need container width, but for now just use a reasonable default)
    if (left + DISPLAY_SIZE > window.innerWidth - 20) {
      left = screenX - DISPLAY_SIZE - 10;
    }

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
        width: `${DISPLAY_SIZE}px`,
        height: `${DISPLAY_SIZE}px`,
        border: "4px solid",
        borderColor: borderColor,
        borderRadius: 1,
        bgcolor: "background.paper",
        boxShadow: 3,
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
        }}
      >
        <canvas
          ref={canvasRef}
          width={DISPLAY_SIZE}
          height={DISPLAY_SIZE}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            imageRendering: "pixelated",
          }}
        />
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
        {enableOcr && hasDetectedText && (
          <TextOverlay text={detectedText} anchor />
        )}
      </Box>
    </Box>
  );
}
