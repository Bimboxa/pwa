import { createElement } from "react";

import { Button, Paper, Box, Tooltip } from "@mui/material";
import { ArrowDropDown as Down, Circle } from "@mui/icons-material";
import { red, grey } from "@mui/material/colors";
import { lighten } from "@mui/material/styles";

import iconsMap from "../data/iconsMap";

export default function IconListingVariantSelectable({
  listing,
  onClick,
  selected,
  size = "32px",
}) {
  const bgcolorSelected = listing?.color ?? red[500];
  const bgcolorSelectedHover = lighten(bgcolorSelected, 0.2);
  const bgcolorHover = lighten(bgcolorSelected, 0.3);

  const iconKey = listing?.iconKey;
  const icon = iconsMap.get(iconKey) ?? Circle;

  const iconElement = createElement(icon, {
    sx: { color: "inherit" },
  });

  return (
    <Box sx={{ p: 0.75 }}>
      <Tooltip title={listing?.name} placement="right">
        <Box
          sx={{
            borderRadius: 2,
            ...(selected && { bgcolor: bgcolorSelected }),
            ...(!selected && { border: `1px solid ${grey[500]}` }),
            display: "flex",
            color: selected ? "white" : grey[500],
            alignItems: "center",
            justifyContent: "center",

            "&:hover": {
              bgcolor: selected ? bgcolorSelectedHover : bgcolorHover,
              color: "white",
              border: "none",
            },
            width: size,
            height: size,
            cursor: "pointer",
          }}
          onClick={onClick}
        >
          {iconElement}
        </Box>
      </Tooltip>
    </Box>
  );
}
