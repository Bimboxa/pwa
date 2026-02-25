import { useSelector } from "react-redux";

import { Typography } from "@mui/material";
import {
  Map,
  MenuBook,
  PictureAsPdf as PdfIcon,
  Image,
  TableChart as Table,
  Print,
} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
  const enabledTreed = useSelector((s) => s.threedEditor.enabled);

  const viewers = [
    // {
    //   key: "BLUEPRINT",
    //   label: "Plan de repérage",
    //   icon: <Print />,
    // },
    {
      key: "PORTFOLIO",
      label: "Portfolio",
      icon: <MenuBook />,
      bgcolor: theme.palette.viewers.portfolio,
    },
    {
      key: "MAP",
      label: "Repérage sur fond de plan",
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
      label: "Quantités",
      icon: <Table />,
      bgcolor: theme.palette.viewers.map,
      //disabled: true,
    },
    {
      key: "THREED",
      label: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <Typography>3D</Typography>,
      disabled: !enabledTreed,
    },
    {
      key: "LEAFLET",
      label: "Carte satellite",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
      disabled: true,
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
