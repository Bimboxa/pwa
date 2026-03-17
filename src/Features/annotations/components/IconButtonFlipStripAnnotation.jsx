import { IconButton, Tooltip } from "@mui/material";
import { Flip as FlipIcon } from "@mui/icons-material";

import db from "App/db/db";

export default function IconButtonFlipStripAnnotation({ annotation, accentColor }) {
  // helpers

  const title = "Inverser le sens";

  // handlers

  const handleToggleFlip = async () => {
    await db.annotations.update(annotation.id, {
      stripOrientation: (annotation.stripOrientation ?? 1) * -1,
    });
  };

  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={handleToggleFlip}
        sx={{
          color: "text.disabled",
          ...(accentColor && {
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }),
        }}
      >
        <FlipIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
