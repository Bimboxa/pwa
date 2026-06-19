import { useState } from "react";
import { useSelector } from "react-redux";

import { Rnd } from "react-rnd";

import { Box, Typography } from "@mui/material";

import useThreedLegendItems from "Features/threedEditor/hooks/useThreedLegendItems";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import { THREED_LEGEND_CAPTURE_ID } from "Features/threedEditor/services/captureSceneScreenshotService";

// Draggable + width-resizable legend for the 3D viewer. Styled as a plain
// legend graphic (no header / close button / shadow) so it can be captured in
// a screenshot and pasted into a document. Hidden via the "Afficher la
// légende" switch in PanelThreedProperties. Fed with the exact annotation set
// rendered in 3D (passed by MainThreedEditor).
//
// Drag: the top 8px strip (same size as the padding) is the drag zone.
// Height auto-hugs the content so there is no empty space at the bottom.
const DRAG_HANDLE_CLASS = "threed-legend-drag-handle";

// Text/icon scale presets driven by `threedEditor.legendSize`.
const SIZE_CONFIG = {
  SMALL: {
    icon: 14,
    box: 18,
    label: "0.7rem",
    qty: "9px",
    group: "0.62rem",
    rowPy: 0.1,
  },
  MEDIUM: {
    icon: 18,
    box: 22,
    label: "0.875rem",
    qty: "10px",
    group: "0.7rem",
    rowPy: 0.25,
  },
  LARGE: {
    icon: 24,
    box: 28,
    label: "1.05rem",
    qty: "12px",
    group: "0.85rem",
    rowPy: 0.4,
  },
};

export default function ThreedPopperLegend({ annotations }) {
  // data

  const legendItems = useThreedLegendItems(annotations);
  const spriteImage = useAnnotationSpriteImage();

  const showQty = useSelector((s) => s.threedEditor.legendShowQty);
  const legendSize = useSelector((s) => s.threedEditor.legendSize);
  const size = SIZE_CONFIG[legendSize] ?? SIZE_CONFIG.MEDIUM;

  // state

  const [position, setPosition] = useState({ x: 16, y: 56 });
  const [width, setWidth] = useState(220);

  // render

  return (
    <Rnd
      position={position}
      size={{ width, height: "auto" }}
      minWidth={140}
      bounds="parent"
      dragHandleClassName={DRAG_HANDLE_CLASS}
      enableResizing={{
        left: true,
        right: true,
        top: false,
        bottom: false,
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: false,
      }}
      onDragStop={(_e, d) => setPosition({ x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        setWidth(ref.offsetWidth);
        setPosition({ x: pos.x, y: pos.y });
      }}
      style={{ zIndex: 1200 }}
    >
      <Box
        id={THREED_LEGEND_CAPTURE_ID}
        sx={{
          position: "relative",
          p: "8px",
          bgcolor: "white",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: "4px",
        }}
      >
        {/* drag zone — the top padding strip (invisible) */}
        <Box
          className={DRAG_HANDLE_CLASS}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            cursor: "move",
          }}
        />

        {legendItems.length === 0 && (
          <Typography sx={{ fontSize: size.label }} color="text.secondary">
            Aucune annotation dans la scène.
          </Typography>
        )}

        {legendItems.map((item, index) => {
          if (item.type === "listingName") {
            return (
              <Typography
                key={`listing-${index}`}
                sx={{
                  display: "block",
                  fontSize: size.group,
                  fontWeight: "bold",
                  color: "text.secondary",
                  mt: index === 0 ? 0 : 1,
                  mb: 0.25,
                }}
              >
                {item.name}
              </Typography>
            );
          }
          if (item.type === "groupLabel") {
            return (
              <Typography
                key={`group-${index}`}
                sx={{
                  display: "block",
                  fontSize: size.group,
                  color: "text.disabled",
                  pl: 0.5,
                  mt: 0.5,
                }}
              >
                {item.name}
              </Typography>
            );
          }
          return (
            <Box
              key={item.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: size.rowPy,
              }}
            >
              <Box
                sx={{
                  width: size.box,
                  height: size.box,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AnnotationTemplateIcon
                  template={item.template}
                  size={size.icon}
                  spriteImage={spriteImage}
                />
              </Box>
              <Typography
                noWrap
                sx={{ flex: 1, minWidth: 0, fontSize: size.label }}
              >
                {item.label}
              </Typography>
              {showQty && item.qtyLabel && (
                <Typography
                  align="right"
                  noWrap
                  sx={{
                    fontSize: size.qty,
                    fontFamily: "monospace",
                    fontWeight: 500,
                    color: "text.secondary",
                  }}
                >
                  {item.qtyLabel}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Rnd>
  );
}
