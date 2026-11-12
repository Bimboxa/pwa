import { Box, Chip } from "@mui/material";

// Single-choice chip row of the « Commandes » dialog: one chip per module
// carrying the commands toolbar (`modules` = entries of useViewers, already
// filtered and ordered by the dialog); the active one is filled.
export default function ChipsCommandsModule({ modules, value, onChange }) {
  // render

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {modules.map((module) => {
        const active = module.key === value;
        return (
          <Chip
            key={module.key}
            icon={module.icon}
            label={module.label}
            size="small"
            color={active ? "secondary" : "default"}
            variant={active ? "filled" : "outlined"}
            onClick={() => onChange(module.key)}
          />
        );
      })}
    </Box>
  );
}
