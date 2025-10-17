import { createElement } from "react";

import { Box, Tooltip } from "@mui/material";
import { ArrowDropDown as Down, Circle } from "@mui/icons-material";
import { red, grey } from "@mui/material/colors";
import { lighten } from "@mui/material/styles";

import iconsMap from "../data/iconsMap";

export default function IconListingVariantSelectable({
  listing,
  onClick,
  selected,
  hidden,

  size = "32px",
}) {
  const isLocatedEntity =
    listing?.entityModel?.type === "LOCATED_ENTITY" ||
    listing.id === "bgImageFormat";
  const listingColor = listing?.color ?? red[500];
  const listingColorLight = lighten(listingColor, 0.2);
  const listingColorLightest = lighten(listingColor, 0.5);
  const _grey = grey[500];
  const _greyLight = lighten(_grey, 0.2);

  let bgcolor = null;
  let color = _grey;
  let border = `1px solid ${_grey}`;

  let bgcolorHover = listingColorLight;
  let borderHover = "none";
  let colorHover = "white";

  let bgcolorSelected = listingColor;
  let colorSelected = "white";
  let borderSelected = "none";

  let bgcolorHoverSelected = listingColorLight;
  let colorHoverSelected = "white";
  let borderHoverSelected = "none";

  if (isLocatedEntity) {
    bgcolor = null;
    color = hidden ? _grey : listingColor;
    border = `1px solid ${hidden ? _grey : listingColor}`;

    bgcolorHover = hidden ? _grey : listingColorLight;
    borderHover = "none";
    colorHover = hidden ? "primary.main" : "white";

    bgcolorSelected = hidden ? _grey : listingColor;
    colorSelected = hidden ? "primary.main" : "white";
    borderSelected = "none";

    bgcolorHoverSelected = hidden ? _greyLight : listingColorLight;
    colorHoverSelected = hidden ? "primary.main" : "white";
    borderHoverSelected = "none";
  }

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
            bgcolor: selected ? bgcolorSelected : bgcolor,
            color: selected ? colorSelected : color,
            border: selected ? borderSelected : border,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            "&:hover": {
              bgcolor: selected ? bgcolorHoverSelected : bgcolorHover,
              color: selected ? colorHoverSelected : colorHover,
              border: selected ? borderHoverSelected : borderHover,
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
