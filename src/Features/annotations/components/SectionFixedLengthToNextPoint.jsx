import { useSelector, useDispatch } from "react-redux";
import { useEffect, useRef, useCallback } from "react";

import {
  setFixedDims,
  setFixedLength,
} from "Features/mapEditor/mapEditorSlice";

import { Box, Paper, TextField } from "@mui/material";

export default function SectionFixedLengthToNextPoint() {
  const dispatch = useDispatch();

  // data

  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);
  const fixedDims = useSelector((s) => s.mapEditor.fixedDims);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers
  const isRectangle = enabledDrawingMode === "RECTANGLE";

  const value = isRectangle ? fixedDims : fixedLength;

  const label = isRectangle ? "x (m); y (m)" : "Longueur fixe (m)";

  const inputRef = useRef(null);

  const ensureFocus = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    if (document.activeElement !== input) {
      input.focus();
      input.select?.();
    }
  }, []);

  useEffect(() => {
    ensureFocus();

    const handlePointerDown = () => {
      requestAnimationFrame(ensureFocus);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [ensureFocus]);

  // handlers

  function handleChange(e) {
    let value = e.target.value;
    value = value.replace(",", ".");

    if (isRectangle) {
      dispatch(setFixedDims(value));
    } else {
      dispatch(setFixedLength(value));
    }
  }

  return (
    <Paper sx={{ opacity: 0.5 }}>
      <TextField
        inputRef={inputRef}
        label={label}
        value={value ?? ""}
        onChange={handleChange}
        size="small"
        sx={{
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2.fontSize,
          },
        }}
      />
    </Paper>
  );
}
