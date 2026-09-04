import { IconButton, Tooltip } from "@mui/material";
import { Flip as FlipIcon } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

export default function IconButtonFlipStripAnnotation({
  annotation,
  accentColor,
}) {
  // strings

  const title = "Inverser le sens";

  // data

  // Goes through useUpdateAnnotation (not a raw db write) so the openings
  // glued on the band's median line follow the side flip.
  const updateAnnotation = useUpdateAnnotation();

  // handlers

  const handleToggleFlip = async () => {
    await updateAnnotation({
      id: annotation.id,
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
