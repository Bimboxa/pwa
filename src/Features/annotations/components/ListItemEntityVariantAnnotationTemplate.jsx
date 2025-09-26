import { ListItemButton, Box, Typography } from "@mui/material";

import MarkerIcon from "Features/markers/components/MarkerIcon";

export default function ListItemEntityVariantAnnotationTemplate({
  entity,
  onClick,
  selection,
  listing,
}) {
  const spriteImage = listing?.spriteImage;

  const { iconKey, fillColor, label } = entity;

  return (
    <ListItemButton
      sx={{ p: 1, width: 1, justifyContent: "space-between" }}
      onClick={() => onClick(entity)}
      selected={selection?.includes(entity.id)}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 0,
        }}
      >
        <MarkerIcon
          iconKey={iconKey}
          fillColor={fillColor}
          spriteImage={spriteImage}
          size={18}
        />

        <Typography variant="body2" noWrap>
          {label}
        </Typography>
      </Box>
    </ListItemButton>
  );
}
