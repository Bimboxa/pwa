import { useEffect } from "react";

import { Box, Chip, Typography } from "@mui/material";

import useRevolutionAxisOptions from "../hooks/useRevolutionAxisOptions";

// strings

const NO_AXIS = "Dessinez d'abord un axe de révolution sur une vue en plan.";

/**
 * Revolution axes of the current scope as a single row of chips (scrolls
 * horizontally when it overflows). Value = axis id. `autoSelectFirst` picks
 * the first axis while the value matches none of them.
 */
export default function ChipsRevolutionAxes({
  value,
  onChange,
  autoSelectFirst = false,
  sx,
}) {
  // data

  const options = useRevolutionAxisOptions();

  // helpers

  const hasValue = options.some((o) => o.id === value);
  const firstId = options[0]?.id;

  useEffect(() => {
    if (autoSelectFirst && !hasValue && firstId) onChange?.(firstId);
  }, [autoSelectFirst, hasValue, firstId, onChange]);

  // render

  if (options.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={sx}>
        {NO_AXIS}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        flexWrap: "nowrap",
        overflowX: "auto",
        ...sx,
      }}
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Chip
            key={o.id}
            size="small"
            label={o.label}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            onClick={() => onChange?.(o.id)}
            sx={{ flexShrink: 0 }}
          />
        );
      })}
    </Box>
  );
}
