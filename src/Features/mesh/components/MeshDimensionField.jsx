import { useState, useEffect, useRef } from "react";

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

// Inline-editable dimension value. Shows the value as plain text; a click turns
// it into an input with a subtle background rectangle — without any layout
// "jump" (the text span and the input share the exact same footprint, only the
// background/border appear in edit mode). Commits on blur / Enter, reverts on
// Escape.
const VALUE_WIDTH = 34;

function fmt(v) {
  return v == null || Number.isNaN(v) ? "" : String(Math.round(v * 100) / 100);
}

export default function MeshDimensionField({
  value,
  onCommit,
  suffix = "m",
  accentColor = "#c0392b",
  editable = true,
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(fmt(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setLocal(fmt(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const n = parseFloat(String(local).replace(",", "."));
    if (!Number.isNaN(n)) onCommit?.(n);
    setEditing(false);
  }
  function cancel() {
    setLocal(fmt(value));
    setEditing(false);
  }

  return (
    <Box
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => {
        if (editable && !editing) setEditing(true);
      }}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        height: 20,
        px: "4px",
        borderRadius: "4px",
        border: "1px solid",
        borderColor: editing ? accentColor : "transparent",
        bgcolor: editing ? alpha(accentColor, 0.14) : "transparent",
        boxShadow: editing ? 1 : 0,
        cursor: editable ? (editing ? "text" : "pointer") : "default",
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          style={{
            width: VALUE_WIDTH,
            border: "none",
            outline: "none",
            background: "transparent",
            color: accentColor,
            fontSize: 12,
            lineHeight: "18px",
            padding: 0,
            textAlign: "right",
          }}
        />
      ) : (
        <span
          style={{
            width: VALUE_WIDTH,
            display: "inline-block",
            fontSize: 12,
            color: "#666",
            textAlign: "right",
            userSelect: "none",
          }}
        >
          {fmt(value)}
        </span>
      )}
      <span
        style={{
          fontSize: 11,
          color: editing ? accentColor : "#888",
          userSelect: "none",
        }}
      >
        {suffix}
      </span>
    </Box>
  );
}
