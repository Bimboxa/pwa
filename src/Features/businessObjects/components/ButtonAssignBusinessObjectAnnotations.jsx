import { useState } from "react";

import { Box, Button, CircularProgress } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import useAssignBusinessObjectToAnnotations from "../hooks/useAssignBusinessObjectToAnnotations";

// "Affecter les annotations" button of the object properties panel
// ("Localisation" section, types with the `assignByGeometry` feature): links
// the annotations lying inside the object's polygon on the current base map.
export default function ButtonAssignBusinessObjectAnnotations({
  businessObject,
}) {
  const { assignForBusinessObject } = useAssignBusinessObjectToAnnotations();

  // state

  const [running, setRunning] = useState(false);

  // handlers

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await assignForBusinessObject(businessObject);
    } finally {
      setRunning(false);
    }
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <Button
        size="small"
        variant="outlined"
        fullWidth
        disabled={running}
        onClick={handleClick}
        startIcon={
          running ? (
            <CircularProgress size={16} />
          ) : (
            <SelectAll fontSize="small" />
          )
        }
      >
        Affecter les annotations à l&apos;intérieur
      </Button>
    </Box>
  );
}
