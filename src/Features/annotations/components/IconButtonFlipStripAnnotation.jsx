import { IconButton, Tooltip } from "@mui/material";
import {
  Flip as FlipIcon,
} from "@mui/icons-material";

import db from "App/db/db";

export default function IconButtonFlipStripAnnotation({ annotation }) {
  // helpers

  const title = "Inverser";

  // handlers

  const handleToggleFlip = async () => {
    await db.annotations.update(annotation.id, {
      stripOrientation: (annotation.stripOrientation ?? 1) * -1,
    });
  };

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleToggleFlip}>
        <FlipIcon />
      </IconButton>
    </Tooltip>
  );
}
