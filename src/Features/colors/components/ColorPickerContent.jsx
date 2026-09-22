import {
  Box,
  Typography,
  InputBase,
  ButtonBase,
  Button,
  Divider,
} from "@mui/material";

import useColorPalettes from "../hooks/useColorPalettes";

// Shared colour-picker popover body: the branded palette sections (Charte …,
// Stabilos, Spectre, Neutres) + a hex input. Extra rows (opacity, width…) are
// passed as `children` and render between the palette and the hex row, matching
// the compact fill/stroke design. Reused by the fill, stroke and simple-colour
// fields so every colour picker looks the same.
//
// `color` may be null for "no own colour" (e.g. the 3D colour inheriting the 2D
// one): no palette swatch is then marked selected, the hex input is empty and
// shows `placeholder` (the inherited colour), and clearing the hex input emits
// null rather than "" (only in that nullable mode, i.e. when `placeholder` is
// given — the fill/stroke pickers keep their behaviour). `header` renders
// above the palettes (an explicit "inherit" option, for instance).
export default function ColorPickerContent({
  color,
  placeholder,
  onColorChange,
  onClose,
  header,
  children,
}) {
  const sections = useColorPalettes();
  const current = (color ?? "").toLowerCase();

  const nullable = placeholder !== undefined && placeholder !== null;

  function handleHexChange(value) {
    onColorChange(nullable && value === "" ? null : value);
  }

  return (
    <Box
      sx={{
        p: 1.5,
        width: 260,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {header}

      {sections.map((section) => (
        <Box
          key={section.key}
          sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            {section.label}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {section.colors.map((hex) => {
              const selected = current === hex.toLowerCase();
              return (
                <ButtonBase
                  key={hex}
                  onClick={() => onColorChange(hex)}
                  title={hex}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1,
                    bgcolor: hex,
                    border: "2px solid",
                    borderColor: selected ? "text.primary" : "transparent",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                  }}
                />
              );
            })}
          </Box>
        </Box>
      ))}

      {children}

      <Divider sx={{ mt: 0.5 }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: 0.75,
            bgcolor: color ?? placeholder,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
            border: nullable && !color ? "1px dashed" : "none",
            borderColor: "text.disabled",
          }}
        />
        <InputBase
          value={color ?? ""}
          placeholder={placeholder ?? undefined}
          onChange={(e) => handleHexChange(e.target.value)}
          sx={{
            flex: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 1,
            height: 28,
            fontSize: "0.8rem",
            fontFamily: "monospace",
          }}
        />
        {onClose && (
          <Button size="small" onClick={onClose} sx={{ minWidth: 0, px: 1.5 }}>
            OK
          </Button>
        )}
      </Box>
    </Box>
  );
}
