import { useSelector } from "react-redux";

import {
  Map,
  MenuBook,
  PictureAsPdf as PdfIcon,
  TableChart as Table,
  Print,
  AdminPanelSettings,
  Draw,
  Layers,
  FormatListBulleted,
  ViewInAr,
  GridOn,
  PhotoCamera,
} from "@mui/icons-material";

import theme from "Styles/theme";

export default function useViewers() {
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);

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
      hotkey: "F",
    },
    {
      key: "MAP",
      label: "Dessin",
      shortLabel: "Dessin",
      icon: <Draw />,
      bgcolor: theme.palette.viewers.map,
      hotkey: "D",
    },
    {
      key: "POINT_OF_VIEW",
      label: "Points de vue",
      shortLabel: "Points de vue",
      icon: <PhotoCamera />,
      bgcolor: theme.palette.viewers.pov,
      // The POV viewer relies on the V3 map editor capture host.
      disabled: legacy,
      hotkey: "V",
    },
    {
      key: "PORTFOLIO",
      label: "Carnet de plans",
      shortLabel: "Carnet de plans",
      icon: <MenuBook />,
      bgcolor: theme.palette.viewers.portfolio,
      hotkey: "C",
    },
    {
      key: "THREED",
      label: "3D",
      shortLabel: "3D",
      bgcolor: theme.palette.viewers.threed,
      icon: <ViewInAr />,
      // "T" is bound by useToggleThreedViewerHotkey (2D <-> 3D toggle + POV
      // mode flip) — displayed here as a badge only, never bound by
      // useViewerSwitchHotkeys.
      hotkey: "T",
      hotkeyExternal: true,
    },
    {
      key: "MESHES",
      label: "Maillage",
      shortLabel: "Maillage",
      icon: <GridOn />,
      bgcolor: theme.palette.viewers.meshes,
      // Not "M", which keeps its Modification meaning (D/M/S trio) in the
      // 2D editors. "I" only clashes with the paste-mode letters, and the
      // viewer hotkeys are inert while pasting.
      hotkey: "I",
    },
    {
      key: "LISTING",
      label: "Liste d'objets",
      shortLabel: "Objets",
      icon: <FormatListBulleted />,
      bgcolor: theme.palette.viewers.listing,
      disabled: !advancedLayout,
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
