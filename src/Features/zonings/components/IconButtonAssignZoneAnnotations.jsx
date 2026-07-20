import { useState } from "react";

import { CircularProgress, IconButton, Tooltip } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import useAssignZoneToAnnotations from "../hooks/useAssignZoneToAnnotations";

// "Affecter la zone": links every annotation inside the selected zone
// delimitation polygon to the zone, splitting the ones crossed by its
// perimeter so only the inner part gets linked (useAssignZoneToAnnotations).
export default function IconButtonAssignZoneAnnotations({
  annotation,
  accentColor,
}) {
  const assignZone = useAssignZoneToAnnotations();

  // state

  const [running, setRunning] = useState(false);

  // handlers

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      const result = await assignZone(annotation);
      if (result)
        console.log(
          `[assignZone] ${result.linked} annotation(s) liée(s), ${result.split} découpée(s)`
        );
    } finally {
      setRunning(false);
    }
  }

  // render

  return (
    <Tooltip title="Affecter la zone (relier les annotations à l'intérieur)">
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        {running ? (
          <CircularProgress size={16} />
        ) : (
          <SelectAll fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
