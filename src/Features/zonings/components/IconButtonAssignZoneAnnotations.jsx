import { useState } from "react";

import { CircularProgress } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import ToolbarToolButton from "Features/annotations/components/ToolbarToolButton";

import useAssignZoneToAnnotations from "../hooks/useAssignZoneToAnnotations";

// "Affecter la zone": links every annotation inside the selected zone
// delimitation polygon to the zone, splitting the ones crossed by its
// perimeter so only the inner part gets linked (useAssignZoneToAnnotations).
export default function IconButtonAssignZoneAnnotations({
  annotation,
  accentColor,
}) {
  const { assignZone } = useAssignZoneToAnnotations();

  // state

  const [running, setRunning] = useState(false);

  // handlers

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await assignZone(annotation);
    } finally {
      setRunning(false);
    }
  }

  // render

  return (
    <ToolbarToolButton
      icon={
        running ? (
          <CircularProgress size={16} />
        ) : (
          <SelectAll fontSize="small" />
        )
      }
      label="Affecter la zone (relier les annotations à l'intérieur)"
      onClick={handleClick}
      accentColor={accentColor}
    />
  );
}
