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

// Each entry is a MODULE of the left band. `editors` lists the editors the
// module can display (default: the module's own key). Multi-editor modules
// (MAP, POINT_OF_VIEW) expose the 2D/3D toggle ("T" + topBar button), which
// changes the displayed editor without moving the left-band selection.
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
      editors: ["MAP", "THREED"],
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
      editors: ["MAP", "THREED"],
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
      // No hotkey: "T" toggles the editor inside multi-editor modules
      // (useToggleThreedViewerHotkey), it no longer selects this module.
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

  return viewers
    .filter((v) => !v.disabled)
    .map((v) => ({ ...v, editors: v.editors ?? [v.key] }));
}
