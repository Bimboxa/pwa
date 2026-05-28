import { IconButton, Tooltip } from "@mui/material";
import { Cached as CachedIcon } from "@mui/icons-material";

import useToggleAnnotationStripType from "../hooks/useToggleAnnotationStripType";

export default function IconButtonToggleStripType({ annotation, accentColor }) {
  // helpers

  const title = "Basculer ligne ↔ bande (mur)";

  // handlers

  const toggleStripType = useToggleAnnotationStripType();

  const handleClick = async () => {
    await toggleStripType(annotation);
  };

  return (
    <Tooltip title={title}>
      <IconButton
        size="small"
        onClick={handleClick}
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
        <CachedIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
