import { SwapHoriz as SwapHorizIcon } from "@mui/icons-material";

import ToolbarToolButton from "./ToolbarToolButton";

import db from "App/db/db";

// Toggles the extrusion side of a profile-swept annotation
// (`shape3D.key === "EXTRUSION_PROFILE"`). Flipping `extrusionOrientation`
// (±1) mirrors the profile to the other side of the contour — a 180° rotation
// about the guide tangent in 3D, and the offset preview switches side in 2D
// (see NodePolylineStatic).
export default function IconButtonFlipExtrusionAnnotation({
  annotation,
  accentColor,
}) {
  // helpers

  const title = "Inverser le sens de l'extrusion";

  // handlers

  const handleToggleFlip = async () => {
    await db.annotations.update(annotation.id, {
      extrusionOrientation: (annotation.extrusionOrientation ?? 1) * -1,
    });
  };

  return (
    <ToolbarToolButton
      icon={<SwapHorizIcon fontSize="small" />}
      label={title}
      onClick={handleToggleFlip}
      accentColor={accentColor}
    />
  );
}
