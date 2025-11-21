import { useState, useEffect, useMemo } from "react";
import { Paper, Typography, Box } from "@mui/material";

import SectionAnnotationQties from "Features/annotations/components/SectionAnnotationQties";
import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

export default function LayerAnnotationTooltip({
  containerEl,
  hoveredAnnotation,
  mousePos,
}) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerEl) return;

    const updateSize = () => {
      const rect = containerEl.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
    };
  }, [containerEl]);

  const tooltipPosition = useMemo(() => {
    if (!hoveredAnnotation) return null;

    const tooltipWidth = 200;
    const tooltipHeight = 80;
    const offset = 16;

    let left = mousePos.x + offset;
    let top = mousePos.y - tooltipHeight - offset;

    if (left + tooltipWidth > containerSize.width) {
      left = mousePos.x - tooltipWidth - offset;
    }
    if (top < 0) {
      top = mousePos.y + offset;
    }

    return { left, top, width: tooltipWidth, height: tooltipHeight };
  }, [hoveredAnnotation, mousePos, containerSize]);

  if (
    !hoveredAnnotation ||
    !tooltipPosition ||
    hoveredAnnotation.type === "TEXT"
  ) {
    return null;
  }

  return (
    <Paper
      elevation={6}
      sx={{
        position: "absolute",
        left: `${tooltipPosition.left}px`,
        top: `${tooltipPosition.top}px`,
        //width: `${tooltipPosition.width}px`,
        //maxHeight: `${tooltipPosition.height}px`,
        pointerEvents: "none",
        zIndex: 1000,
        p: 1.5,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <AnnotationIcon annotation={hoveredAnnotation} />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: "bold" }}
        >
          {hoveredAnnotation?.label}
        </Typography>
      </Box>
      <SectionAnnotationQties annotation={hoveredAnnotation} />
    </Paper>
  );
}
