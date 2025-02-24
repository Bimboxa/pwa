import {Typography} from "@mui/material";
import {Map} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
  const viewers = [
    {
      key: "MAP",
      label: "Fond de plan",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "THREED",
      label: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <Typography>3D</Typography>,
    },
  ];

  return viewers;
}
