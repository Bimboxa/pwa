import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";

import { getAnnotationType } from "Features/annotations/constants/drawingShapeConfig";

// withLayoutLength: the template has the "Calepinage" feature enabled
// (hasLayoutLines) — the "C" key is offered only then, and only for POLYGON.
export default function FieldQty({
  value,
  onChange,
  label,
  drawingShape,
  withLayoutLength = false,
}) {
  // helper — order: U, L, S ; face shows the short key, tooltip the full label

  const allOptions = [
    { key: "U", short: "U", tooltip: "Unité" },
    { key: "L", short: "L", tooltip: "Longueur" },
    { key: "S", short: "S", tooltip: "Surface" },
    // Longueur de calepinage: Σ of the bars of the polygon's layout lines.
    { key: "C", short: "C", tooltip: "Longueur calepinage" },
  ];

  // "C" only for POLYGON templates with the Calepinage feature enabled.
  const isPolygon = getAnnotationType(drawingShape) === "POLYGON";
  const valueOptions = allOptions.filter((o) => {
    if (o.key === "C") return isPolygon && withLayoutLength;
    if (o.key === "S") return drawingShape !== "POINT";
    return true;
  });

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
