import { useSelector } from "react-redux";

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
  FormatListBulleted,
  ViewInAr,
} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
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
      label: "Dessin",
      shortLabel: "Dessin",
      icon: <Draw />,
      bgcolor: theme.palette.viewers.map,
    },
    {
      key: "PORTFOLIO",
      label: "Carnet de plans",
      shortLabel: "Carnet de plans",
      icon: <MenuBook />,
      bgcolor: theme.palette.viewers.portfolio,
    },
    {
      key: "THREED",
      label: "3D",
      shortLabel: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <ViewInAr />,
    },
    {
      key: "LISTING",
      label: "Liste d'objets",
      shortLabel: "Objets",
      icon: <FormatListBulleted />,
      bgcolor: theme.palette.viewers.listing,
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
      disabled: true,
    },
    {
      key: "ADMIN",
      label: "Gestionnaire de donnees",
      shortLabel: "Admin",
      icon: <AdminPanelSettings />,
      bgcolor: theme.palette.viewers.admin,
      disabled: true,
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
