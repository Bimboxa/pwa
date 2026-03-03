import { useSelector } from "react-redux";

import { Typography } from "@mui/material";
import {
  Map,
  MenuBook,
  PictureAsPdf as PdfIcon,
  Image,
  TableChart as Table,
  Print,
  AdminPanelSettings,
  Draw,
  Layers,
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
      key: "BASE_MAPS",
      label: "Fonds de plan",
      shortLabel: "Fonds de plan",
      icon: <Layers />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "MAP",
      label: "Repérage sur fond de plan",
      shortLabel: "Repérages",
      icon: <Draw />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "PORTFOLIO",
      label: "Portfolio",
      shortLabel: "Portfolio",
      icon: <MenuBook />,
      bgcolor: theme.palette.viewers.portfolio,
    },
    {
      key: "PRINT",
      label: "Format impression",
      shortLabel: "Impression",
      icon: <Print />,
      disabled: true,
    },
    {
      key: "TABLE",
      label: "Quantités",
      shortLabel: "Quantités",
      icon: <Table />,
      bgcolor: theme.palette.viewers.map,
      //disabled: true,
    },
    {
      key: "THREED",
      label: "3D",
      shortLabel: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <Typography>3D</Typography>,
      disabled: !enabledTreed,
    },
    {
      key: "ADMIN",
      label: "Gestionnaire de donnees",
      shortLabel: "Admin",
      icon: <AdminPanelSettings />,
      bgcolor: theme.palette.viewers.admin,
    },
    {
      key: "LEAFLET",
      label: "Carte satellite",
      shortLabel: "Satellite",
      icon: <Map />,
      bgcolor: theme.palette.viewers.map,
      disabled: true,
    },
    {
      key: "PDF",
      label: "PDF",
      shortLabel: "PDF",
      bgcolor: theme.palette.viewers.threed,
      icon: <PdfIcon />,
      disabled: true,
    },
  ];

  return viewers.filter((v) => !v.disabled);
}
