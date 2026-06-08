import { useState, useEffect } from "react";

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

// Minimalist numeric field (no spin arrows), styled like the height field of
// ToolbarEditAnnotation. Robust inside an SVG <foreignObject>. Commits the
// parsed number on blur / Enter.
export default function FieldElevationOffset({
  value,
  onCommit,
  suffix = "m",
  label,
  width = 42,
  accentColor,
  noShadow = false,
}) {
  const fmt = (v) =>
    v == null || Number.isNaN(v) ? "" : String(Math.round(v * 100) / 100);

  const [local, setLocal] = useState(fmt(value));

  useEffect(() => {
    setLocal(fmt(value));
  }, [value]);

  function commit() {
    const n = parseFloat(String(local).replace(",", "."));
    if (!Number.isNaN(n)) onCommit?.(n);
    else setLocal(fmt(value));
  }

  return (
    <Box
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        bgcolor: accentColor ? alpha(accentColor, 0.14) : "background.paper",
        border: "1px solid",
        borderColor: accentColor || "divider",
        borderRadius: "4px",
        px: "4px",
        height: 20,
        boxShadow: noShadow ? 0 : 1,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: 11,
            color: accentColor || "#666",
            userSelect: "none",
            marginRight: 2,
          }}
        >
          {label}
        </span>
      )}
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            commit();
            e.currentTarget.blur();
          }
        }}
        style={{
          width,
          border: "none",
          outline: "none",
          background: "transparent",
          color: accentColor || undefined,
          fontSize: 12,
          lineHeight: "18px",
          padding: 0,
          textAlign: "right",
        }}
      />
      {suffix && (
        <span
          style={{
            fontSize: 11,
            color: accentColor || "#888",
            userSelect: "none",
          }}
        >
          {suffix}
        </span>
      )}
    </Box>
  );
}
