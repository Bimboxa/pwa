import { useState, useRef, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateAnnotationAndEntityFromPoints from "Features/mapEditor/hooks/useCreateAnnotationAndEntityFromPoints";

import { setDrawingPolylinePoints } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography, TextField } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionEditedAnnotationNextPoint() {
  const dispatch = useDispatch();

  // strings

  const title = "Ajouter un point";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const baseMap = useMainBaseMap();

  const pointsPolyline = useSelector((s) => s.mapEditor.drawingPolylinePoints);
  const pointsRectangle = useSelector(
    (s) => s.mapEditor.drawingRectanglePoints
  );

  // data - func

  const createFromPoints = useCreateAnnotationAndEntityFromPoints();

  // state

  const [length, setLength] = useState("");
  const [x, setX] = useState("");
  const [y, setY] = useState("");

  // refs for focusable elements (x, y, add button, terminate button) to maintain focus cycle
  const xInputRef = useRef(null);
  const yInputRef = useRef(null);
  const buttonRef = useRef(null);
  const terminateButtonRef = useRef(null);

  // Track current focus index: 0=x, 1=y, 2=add button, 3=terminate button (when POLYLINE)
  const focusIndexRef = useRef(0);

  // Get the number of focusable elements (4 for POLYLINE, 3 otherwise)
  const getFocusableCount = () => {
    return enabledDrawingMode === "POLYLINE" ? 4 : 3;
  };

  // helpers - points

  let points = pointsPolyline;
  if (enabledDrawingMode === "RECTANGLE") {
    points = pointsRectangle;
  }

  // helpers

  const { width, height } = baseMap?.image?.imageSize ?? {};
  const mx = baseMap?.meterByPx;
  const { x: x0, y: y0 } = points?.[points?.length - 1] ?? {};

  // Helper function to get the current focusable element based on index
  const getFocusableElement = (index) => {
    switch (index) {
      case 0:
        return xInputRef.current;
      case 1:
        return yInputRef.current;
      case 2:
        return buttonRef.current;
      case 3:
        return terminateButtonRef.current;
      default:
        return xInputRef.current;
    }
  };

  // Check if an element is one of our focusable elements
  const isFocusableElement = (element) => {
    return (
      element === xInputRef.current ||
      element === yInputRef.current ||
      element === buttonRef.current ||
      (enabledDrawingMode === "POLYLINE" &&
        element === terminateButtonRef.current)
    );
  };

  // Helper function to focus on the element at the current index
  const focusCurrentElement = () => {
    // Ensure index is within valid range
    const count = getFocusableCount();
    if (focusIndexRef.current >= count) {
      focusIndexRef.current = 0;
    }
    const element = getFocusableElement(focusIndexRef.current);
    if (element) {
      element.focus();
    }
  };

  // Focus on x input on mount
  useEffect(() => {
    setTimeout(() => {
      if (xInputRef.current) {
        xInputRef.current.focus();
        focusIndexRef.current = 0;
      }
    }, 0);
  }, []);

  // Reset focus index when mode changes (if currently on terminate button which becomes unavailable)
  useEffect(() => {
    if (enabledDrawingMode !== "POLYLINE" && focusIndexRef.current === 3) {
      focusIndexRef.current = 0;
      focusCurrentElement();
    }
  }, [enabledDrawingMode]);

  // Refocus when points change (user clicked on map)
  useEffect(() => {
    if (points?.length > 0) {
      setTimeout(() => {
        // Check if focus is outside our focusable elements
        const activeElement = document.activeElement;
        if (!isFocusableElement(activeElement)) {
          focusCurrentElement();
        }
      }, 100);
    }
  }, [points?.length, enabledDrawingMode]);

  // Global click handler to refocus when clicking outside (like on map)
  useEffect(() => {
    const handleDocumentClick = (e) => {
      // Check if click was on one of our focusable elements or their containers
      const target = e.target;
      const clickedOnOurElement =
        isFocusableElement(target) ||
        (xInputRef.current && xInputRef.current.contains(target)) ||
        (yInputRef.current && yInputRef.current.contains(target)) ||
        (buttonRef.current && buttonRef.current.contains(target)) ||
        (terminateButtonRef.current &&
          terminateButtonRef.current.contains(target));

      // Only refocus if click was outside our elements
      if (!clickedOnOurElement) {
        // Small delay to check if focus moved outside our elements
        setTimeout(() => {
          const activeElement = document.activeElement;
          // If focus is not on our elements, refocus back
          if (!isFocusableElement(activeElement)) {
            focusCurrentElement();
          }
        }, 100);
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [enabledDrawingMode]);

  // Handle Tab key to cycle through focusable elements
  const handleKeyDown = (e, currentIndex) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const count = getFocusableCount();
      focusIndexRef.current = (currentIndex + 1) % count;
      focusCurrentElement();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const count = getFocusableCount();
      focusIndexRef.current = (currentIndex - 1 + count) % count;
      focusCurrentElement();
    }
  };

  // handlers

  function handleChange(e, coordinate) {
    let value = e.target.value;
    value = value.replace(",", ".");

    if (coordinate === "x") {
      setX(value);
    } else if (coordinate === "y") {
      setY(value);
    } else if (coordinate === "length") {
      setLength(value);
    }
  }

  async function handleClick() {
    const nextPoint = {
      x: x0 + parseFloat(x.length > 0 ? x : 0) / width / mx,
      y: y0 - parseFloat(y.length > 0 ? y : 0) / height / mx,
      type: "square",
    };
    const newPoints = [...points, nextPoint];
    console.log("debug_2210_newPoints", newPoints);
    if (enabledDrawingMode === "POLYLINE") {
      dispatch(setDrawingPolylinePoints(newPoints));
    } else if (enabledDrawingMode === "RECTANGLE") {
      await createFromPoints({ points: newPoints, type: "RECTANGLE" });
    }

    setX("");
    setY("");
    setLength("");

    // Refocus on X input after adding point
    setTimeout(() => {
      if (xInputRef.current) {
        xInputRef.current.focus();
        focusIndexRef.current = 0;
      }
    }, 0);
  }

  async function handleCreatePolyline() {
    await createFromPoints({ points: pointsPolyline, type: "POLYLINE" });
    setX("");
    setY("");
    setLength("");
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
        {title}
      </Typography>
      <SectionFixedLengthToNextPoint />
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          inputRef={xInputRef}
          label="ΔX(m)"
          size="small"
          value={x}
          onChange={(e) => handleChange(e, "x")}
          onKeyDown={(e) => handleKeyDown(e, 0)}
          onFocus={() => {
            focusIndexRef.current = 0;
          }}
          sx={{
            "& .MuiInputBase-input": {
              fontSize: (theme) => theme.typography.body2.fontSize,
            },
          }}
        />
        <TextField
          inputRef={yInputRef}
          label="ΔY(m)"
          size="small"
          value={y}
          onChange={(e) => handleChange(e, "y")}
          onKeyDown={(e) => handleKeyDown(e, 1)}
          onFocus={() => {
            focusIndexRef.current = 1;
          }}
          sx={{
            "& .MuiInputBase-input": {
              fontSize: (theme) => theme.typography.body2.fontSize,
            },
          }}
        />
        <ButtonGeneric
          ref={buttonRef}
          label="Ajouter"
          onClick={handleClick}
          onKeyDown={(e) => handleKeyDown(e, 2)}
          onFocus={() => {
            focusIndexRef.current = 2;
          }}
          size="small"
        />
      </Box>

      {enabledDrawingMode === "POLYLINE" && (
        <Box sx={{ width: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", mt: 2, mb: 1 }}>
            Terminer le dessin
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Double-click ou bouton "Arrêter"
          </Typography>
          <ButtonGeneric
            ref={terminateButtonRef}
            label="Arrêter"
            onClick={handleCreatePolyline}
            onKeyDown={(e) => handleKeyDown(e, 3)}
            onFocus={() => {
              focusIndexRef.current = 3;
            }}
            fullWidth
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  );
}
