import { Typography } from "@mui/material";
import {
  Map,
  PictureAsPdf as PdfIcon,
  Image,
  TableChart as Table,
  Print,
} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
  const viewers = [
    {
      key: "BLUEPRINT",
      label: "Plan de repérage",
      icon: <Print />,
    },
    {
      key: "MAP",
      label: "Fond de plan",
      //icon: <Image />,
      icon: <Typography>2D</Typography>,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "PRINT",
      label: "Format impression",
      icon: <Print />,
      disabled: true,
    },
    {
      key: "TABLE",
      label: "Tableau",
      icon: <Table />,
      bgcolor: theme.palette.viewers.map,
      disabled: true,
    },
    {
      key: "THREED",
      label: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <Typography>3D</Typography>,
    },
    {
      key: "LEAFLET",
      label: "Carte satellite",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
      ///disabled: true,
    },
    {
      key: "PDF",
      label: "PDF",
      bgcolor: theme.palette.viewers.threed,
      icon: <PdfIcon />,
      disabled: true,
    },
  ];

  return viewers.filter((v) => !v.disabled);
}
