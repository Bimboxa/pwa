import { IconButton, Tooltip } from "@mui/material";
import {
  LabelOutlined as LabelIcon,
  LabelOffOutlined as LabelOffIcon,
} from "@mui/icons-material";

import db from "App/db/db";

export default function IconButtonToggleAnnotationShowLabel({ annotation }) {
  // helpers

  const title = annotation.showLabel ? "Masquer l'étiquette" : "Afficher l'étiquette";

  // handlers

  const handleToggleShowLabel = async () => {
    await db.annotations.update(annotation.id, {
      showLabel: !annotation.showLabel,
    });
  };

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleToggleShowLabel}>
        {!annotation.showLabel ? <LabelIcon /> : <LabelOffIcon />}
      </IconButton>
    </Tooltip>
  );
}
