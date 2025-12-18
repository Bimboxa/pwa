import { IconButton, Tooltip } from "@mui/material";
import {
  CloseFullscreen as CloseLineIcon,
  OpenInFull as OpenLineIcon,
} from "@mui/icons-material";

import db from "App/db/db";

export default function IconButtonToggleAnnotationCloseLine({ annotation }) {
  // helpers

  const title = annotation.closeLine ? "Ouvrir la ligne" : "Fermer la ligne";

  // handlers

  const handleToggleCloseLine = async () => {
    await db.annotations.update(annotation.id, {
      closeLine: !annotation.closeLine,
    });
  };

  return (
    <Tooltip title="Fermer la ligne">
      <IconButton onClick={handleToggleCloseLine}>
        {!annotation.closeLine ? <CloseLineIcon /> : <OpenLineIcon />}
      </IconButton>
    </Tooltip>
  );
}
