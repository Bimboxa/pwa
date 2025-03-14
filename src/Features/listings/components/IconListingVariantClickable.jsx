import {createElement} from "react";

import {Button, Paper} from "@mui/material";
import {ArrowDropDown as Down, Circle} from "@mui/icons-material";
import {red} from "@mui/material/colors";

export default function IconListingVariantClickabe({listing, onClick}) {
  const bgcolor = listing?.bgcolor ?? red[500];
  const icon = listing?.icon ?? Circle;

  const iconElement = createElement(icon, {
    sx: {color: "inherit"},
  });

  return (
    <Paper
      sx={{
        borderRadius: 2,
        //width: 30,
        //height: 30,
        bgcolor,
        display: "flex",
        color: "white",
        display: "flex",
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
