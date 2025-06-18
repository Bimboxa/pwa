import {Typography} from "@mui/material";
import {
  Map,
  PictureAsPdf as PdfIcon,
  Image,
  TableChart as Table,
} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
  const viewers = [
    {
      key: "MAP",
      label: "Fond de plan",
      icon: <Image />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "TABLE",
      label: "Tableau",
      icon: <Table />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "LEAFLET",
      label: "Carte",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "THREED",
      label: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <Typography>3D</Typography>,
    },
    {
      key: "PDF",
      label: "PDF",
      bgcolor: theme.palette.viewers.threed,
      icon: <PdfIcon />,
    },
  ];

  return viewers;
}
