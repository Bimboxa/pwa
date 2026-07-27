import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldQty({ value, onChange, label, drawingShape }) {
  // helper — order: U, L, S ; face shows the short key, tooltip the full label

  const allOptions = [
    { key: "U", short: "U", tooltip: "Unité" },
    { key: "L", short: "L", tooltip: "Longueur" },
    { key: "S", short: "S", tooltip: "Surface" },
  ];

  const valueOptions =
    drawingShape === "POINT"
      ? allOptions.filter((o) => o.key !== "S")
      : allOptions;

  // handlers

  function handleChange(e, newKey) {
    if (!newKey) return; // ignore deselection — keep current value
    onChange(newKey);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 1,
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
        <ToggleButtonGroup
          value={value ?? null}
          exclusive
          size="small"
          onChange={handleChange}
        >
          {valueOptions.map((option) => (
            <Tooltip key={option.key} title={option.tooltip} placement="top">
              <ToggleButton value={option.key}>{option.short}</ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Box>
    </WhiteSectionGeneric>
  );
}
