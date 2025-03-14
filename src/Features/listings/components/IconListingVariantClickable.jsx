import {createElement} from "react";

import {Button, Paper} from "@mui/material";
import {ArrowDropDown as Down, Circle} from "@mui/icons-material";
import {red} from "@mui/material/colors";
import iconsMap from "../data/iconsMap";

export default function IconListingVariantClickabe({listing, onClick}) {
  const bgcolor = listing?.color ?? red[500];
  const iconKey = listing?.iconKey;
  const icon = iconsMap.get(iconKey) ?? Circle;

  const iconElement = createElement(icon, {
    sx: {color: "inherit"},
  });

  return (
    <Paper
      sx={{
        borderRadius: 2,
        bgcolor,
        display: "flex",
        color: "white",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Button onClick={onClick} endIcon={<Down />} color="inherit">
        {iconElement}
      </Button>
    </Paper>
  );
}
