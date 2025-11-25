import { useEffect, useRef, useState } from "react";

import { useSelector } from "react-redux";

import useNewAnnotationColor from "Features/annotations/hooks/useNewAnnotationColor";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box } from "@mui/material";

import theme from "Styles/theme";
import MarkerIconNewMarker from "Features/markers/components/MarkerIconNewMarker";
import ImageAnnotationIcon from "Features/imageAnnotations/components/ImageAnnotationIcon";
import ImageGeneric from "Features/images/components/ImageGeneric";
import SectionFixedLengthToNextPoint from "Features/annotations/components/SectionFixedLengthToNextPoint";
import ZoomWindow from "./ZoomWindow";
import editor from "App/editor";

export default function LayerScreenCursor({ containerEl }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const mode = useSelector((s) => s.opencv.opencvClickMode);
  const color = useNewAnnotationColor();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const bboxDims = useSelector((s) => s.opencv.bboxDims);
  const baseMap = useMainBaseMap();

  // helper - show bbox

  const showBbox = mode === "KEEP_COLORS" && enabledDrawingMode === "OPENCV";
  const isRemoveTextMode = mode === "REMOVE_TEXT";
  const showZoomWindow = enabledDrawingMode === "OPENCV";

  // Get baseMap image URL
  const baseMapImageUrl =
    baseMap?.showEnhanced && baseMap?.imageEnhanced
      ? baseMap.imageEnhanced.imageUrlClient ??
        baseMap.imageEnhanced.imageUrlRemote
      : baseMap?.image?.imageUrlClient ?? baseMap?.image?.imageUrlRemote;

  // effect

  useEffect(() => {
    if (!containerEl) return;

    const updateSize = () => {
      const rect = containerEl.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    updateSize();

    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [containerEl]);

  useEffect(() => {
    if (!containerEl) return;

    const handleMouseMove = (e) => {
      const rect = containerEl.getBoundingClientRect();
      setPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleDragOver = (e) => {
      // Update cursor position during drag operations
      const rect = containerEl.getBoundingClientRect();
      setPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    };

    const handleDragEnter = () => {
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = () => {
      setIsDragging(false);
    };

    containerEl.addEventListener("mousemove", handleMouseMove);
    containerEl.addEventListener("dragover", handleDragOver);
    containerEl.addEventListener("dragenter", handleDragEnter);
    containerEl.addEventListener("dragleave", handleDragLeave);
    containerEl.addEventListener("drop", handleDrop);
    return () => {
      containerEl.removeEventListener("mousemove", handleMouseMove);
      containerEl.removeEventListener("dragover", handleDragOver);
      containerEl.removeEventListener("dragenter", handleDragEnter);
      containerEl.removeEventListener("dragleave", handleDragLeave);
      containerEl.removeEventListener("drop", handleDrop);
    };
  }, [containerEl]);

  // Hide if mouse is outside container
  const isInside =
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x <= size.width &&
    pos.y <= size.height &&
    size.width > 0 &&
    size.height > 0;

  if (!isInside) return null;

  return (
    <>
      {/* marker */}
      {enabledDrawingMode === "MARKER" && (
        <Box
          sx={{
            position: "absolute",
            pointerEvents: "none",
            top: `${pos.y}px`,
            left: `${pos.x}px`,
            transform: isDragging
              ? "translate(-50%,-180%)" // Move higher when dragging
              : "translate(-50%,-120%)", // Normal position
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MarkerIconNewMarker />
        </Box>
      )}

      {enabledDrawingMode === "IMAGE" && (
        <Box
          sx={{
            position: "absolute",
            pointerEvents: "none",
            top: `${pos.y}px`,
            left: `${pos.x}px`,
            transform: "translate(-50%,-50%)", // Normal position
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <ImageGeneric
            url={newAnnotation?.image?.imageUrlClient}
            height="50px"
          />
        </Box>
      )}

      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: `${pos.x}px`,
          top: 0,
          width: "1px",
          height: `${size.height}px`,
          background: color,
          zIndex: 1,
        }}
      />
      {/* Horizontal line */}
      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: 0,
          top: `${pos.y}px`,
          width: `${size.width}px`,
          height: "1px",
          background: color,
          zIndex: 1,
        }}
      />
      {showBbox && (
        <Box
          sx={{
            position: "absolute",
            pointerEvents: "none",
            top: `${pos.y - bboxDims.height / 2}px`,
            left: `${pos.x - bboxDims.width / 2}px`,
            width: `${bboxDims.width}px`,
            height: `${bboxDims.height}px`,
            border: "2px solid",
            borderColor: theme.palette.error.main,
            boxSizing: "border-box",
            zIndex: 1,
          }}
        />
      )}
      {showZoomWindow && baseMapImageUrl && editor.screenToBaseLocal && (
        <ZoomWindow
          screenX={pos.x}
          screenY={pos.y}
          baseMapImageUrl={baseMapImageUrl}
          screenToBaseLocal={editor.screenToBaseLocal}
          baseMapSize={
            baseMap?.imageEnhanced?.imageSize ?? baseMap?.image?.imageSize
          }
          enableOcr={isRemoveTextMode}
        />
      )}
    </>
  );
}
