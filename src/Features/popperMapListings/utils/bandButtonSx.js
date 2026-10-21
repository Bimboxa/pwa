// Square 28px action button of the popper section headers ("Listes
// d'annotations", "Fonds de plan"): "+", "...", expand / collapse.
const bandButtonSx = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  p: 0,
  border: "none",
  borderRadius: 2,
  flexShrink: 0,
  cursor: "pointer",
  color: "text.secondary",
  bgcolor: "action.hover",
  "&:hover": { bgcolor: "action.selected" },
};

export default bandButtonSx;
