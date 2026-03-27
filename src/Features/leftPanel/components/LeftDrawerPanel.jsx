import { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setLeftDrawerHovered } from "../leftPanelSlice";

import { Box } from "@mui/material";

export default function LeftDrawerPanel({ children, width = 260, viewerKey }) {
  const dispatch = useDispatch();

  // data

  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const menuHovered = useSelector((s) => s.leftPanel.leftDrawerHovered);
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // state

  const [panelHovered, setPanelHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimeoutRef = useRef(null);

  // helpers

  const isActiveViewer = !viewerKey || selectedViewerKey === viewerKey;
  const shouldBeOpen = isActiveViewer && (menuHovered || panelHovered);

  // effects

  useEffect(() => {
    if (shouldBeOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setVisible(true);
    } else {
      closeTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 300);
    }
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [shouldBeOpen]);

  // handlers

  function handleMouseEnterPanel() {
    setPanelHovered(true);
  }

  function handleMouseLeavePanel() {
    setPanelHovered(false);
    dispatch(setLeftDrawerHovered(false));
  }

  // render - docked mode

  if (leftPanelDocked) {
    return (
      <Box
        sx={{
          width,
          minWidth: width,
          bgcolor: "background.default",
        }}
      >
        {children}
      </Box>
    );
  }

  // render - drawer mode

  return (
    <Box
      onMouseEnter={handleMouseEnterPanel}
      onMouseLeave={handleMouseLeavePanel}
      sx={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width,
        zIndex: 20,
        bgcolor: "background.default",
        boxShadow: visible ? 4 : 0,
        overflow: "auto",
        transform: visible ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      {children}
    </Box>
  );
}
