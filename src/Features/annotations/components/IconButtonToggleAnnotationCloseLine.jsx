import { IconButton, Tooltip } from "@mui/material";
import {
  CloseFullscreen as CloseLineIcon,
  OpenInFull as OpenLineIcon,
} from "@mui/icons-material";

import db from "App/db/db";

export default function IconButtonToggleAnnotationCloseLine({
  annotation,
  accentColor,
}) {
  // helpers

  const title = annotation.closeLine ? "Ouvrir la ligne" : "Fermer la ligne";

  // handlers

  const handleToggleCloseLine = async () => {
    await db.annotations.update(annotation.id, {
      closeLine: !annotation.closeLine,
    });
  };

  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={handleToggleCloseLine}
        sx={
          accentColor
            ? {
                color: "text.disabled",
                "&:hover": {
                  color: accentColor,
                  bgcolor: accentColor + "18",
                },
              }
            : undefined
        }
      >
        {!annotation.closeLine ? (
          <CloseLineIcon fontSize="small" />
        ) : (
          <OpenLineIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}
