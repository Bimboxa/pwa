import { IconButton, Tooltip } from "@mui/material";
import {
  CloseFullscreen as CloseLineIcon,
  OpenInFull as OpenLineIcon,
} from "@mui/icons-material";

import db from "App/db/db";

// « Fermer / Ouvrir la ligne » of a BASE MAP annotation
// (ToolbarEditAnnotationVariantBaseMapAnnotation). Regular annotations use
// the TOGGLE_CLOSE_LINE command of the unified commands toolbar.
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
        sx={{
          color: "text.disabled",
          ...(accentColor && {
            "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
          }),
        }}
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
