import {
  CloseFullscreen as CloseLineIcon,
  OpenInFull as OpenLineIcon,
} from "@mui/icons-material";

import ToolbarToolButton from "./ToolbarToolButton";

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
    <ToolbarToolButton
      icon={
        !annotation.closeLine ? (
          <CloseLineIcon fontSize="small" />
        ) : (
          <OpenLineIcon fontSize="small" />
        )
      }
      label={title}
      onClick={handleToggleCloseLine}
      accentColor={accentColor}
    />
  );
}
