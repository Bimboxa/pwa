import TrendingUp from "@mui/icons-material/TrendingUp";

import ToolbarToolButton from "./ToolbarToolButton";

import useAddSlopeGuideLine from "../hooks/useAddSlopeGuideLine";

// Immediate action (no drawing mode): appends a guide line along the main
// axis of the selected POLYGON with a default 10 % slope and selects it.
export default function IconButtonAddSlope({ accentColor }) {
  const addSlopeGuideLine = useAddSlopeGuideLine();

  return (
    <ToolbarToolButton
      icon={<TrendingUp fontSize="small" />}
      label="Ajouter une pente"
      onClick={() => addSlopeGuideLine()}
      accentColor={accentColor}
    />
  );
}
