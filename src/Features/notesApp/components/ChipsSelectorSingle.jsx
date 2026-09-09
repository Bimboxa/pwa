import { Box, Chip } from "@mui/material";

// Single-choice chip row (Krnet Chip pattern): the active option is filled.
export default function ChipsSelectorSingle({ options, value, onChange }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {(options ?? []).map((opt) => {
        const active = opt.value === value;
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            size="small"
            color={active ? "primary" : "default"}
            variant={active ? "filled" : "outlined"}
            onClick={() => onChange(opt.value)}
          />
        );
      })}
    </Box>
  );
}
