import { useEffect, useRef, useState } from "react";

import { Box } from "@mui/material";

import theme from "Styles/theme";

export default function LayerScreenCursor({ containerEl }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });

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

    containerEl.addEventListener("mousemove", handleMouseMove);
    return () => {
      containerEl.removeEventListener("mousemove", handleMouseMove);
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
      <Box
        sx={{
          position: "absolute",
          pointerEvents: "none",
          top: `${pos.y}px`,
          left: `${pos.x}px`,
          width: "24px",
          height: "24px",
          transform: "translate(-50%,-10%)",
          zIndex: 1,
          bgcolor: "pink",
        }}
      />
      {/* Vertical line */}
      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          left: `${pos.x}px`,
          top: 0,
          width: "1px",
          height: `${size.height}px`,
          background: theme.palette.divider,
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
          background: theme.palette.divider,
          zIndex: 1,
        }}
      />
    </>
  );
}
