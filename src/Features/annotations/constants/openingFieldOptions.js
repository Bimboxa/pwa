// Shared UI options for the OPENING type fields (template + annotation).

export const OPENING_TYPE_OPTIONS = [
  { value: "NONE", label: "Aucun" },
  { value: "DOOR", label: "Porte" },
  { value: "WINDOW", label: "Fenêtre" },
];

export const openingToggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};
