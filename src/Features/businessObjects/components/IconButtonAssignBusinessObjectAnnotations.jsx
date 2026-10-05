import { useState } from "react";

import { CircularProgress } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import ToolbarToolButton from "Features/annotations/components/ToolbarToolButton";

import useAssignBusinessObjectToAnnotations from "../hooks/useAssignBusinessObjectToAnnotations";

// "Affecter les annotations à l'intérieur": links every annotation inside the
// selected main polygon of a business object (locations) to that object,
// splitting the ones crossed by its perimeter so only the inner part gets
// linked (useAssignBusinessObjectToAnnotations).
export default function IconButtonAssignBusinessObjectAnnotations({
  annotation,
  accentColor,
}) {
  const { assignForAnnotation } = useAssignBusinessObjectToAnnotations();

  // state

  const [running, setRunning] = useState(false);

  // handlers

  async function handleClick() {
    if (running) return;
    setRunning(true);
    try {
      await assignForAnnotation(annotation);
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
      label="Affecter les annotations à l'intérieur"
      onClick={handleClick}
      accentColor={accentColor}
    />
  );
}
