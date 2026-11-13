import PinDrop from "@mui/icons-material/PinDrop";
import ViewSidebarOutlined from "@mui/icons-material/ViewSidebarOutlined";
import BorderOuter from "@mui/icons-material/BorderOuter";

// The 3 display modes of the photos (popperImagesSlice.displayMode), in the
// order of the selector (SelectorImagesDisplayMode).
export const IMAGES_DISPLAY_MODE_OPTIONS = [
  {
    key: "IN_SITU",
    label: "In situ",
    tooltip: "Photos in situ : affichées sur le fond de plan",
    Icon: PinDrop,
  },
  {
    key: "EX_SITU",
    label: "Overlay",
    tooltip: "Photos en overlay : listées dans un panneau flottant",
    Icon: ViewSidebarOutlined,
  },
  {
    key: "PRINT_ZONES",
    label: "Zones",
    tooltip: "Photos en zones : réparties sur les 4 bords, autour du plan",
    Icon: BorderOuter,
  },
];
