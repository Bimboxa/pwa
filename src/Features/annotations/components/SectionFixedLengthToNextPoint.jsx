import { useSelector, useDispatch } from "react-redux";
import { useEffect, useRef, useCallback } from "react";

import { setFixedLength } from "Features/mapEditor/mapEditorSlice";

import { Box, Paper, TextField } from "@mui/material";

export default function SectionFixedLengthToNextPoint() {
  const dispatch = useDispatch();

  // data

  const fixedLength = useSelector((s) => s.mapEditor.fixedLength);

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
    dispatch(setFixedLength(value));
  }

  return (
    <Paper sx={{ opacity: 0.5 }}>
      <TextField
        inputRef={inputRef}
        label="Longueur fixe"
        value={fixedLength ?? ""}
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
