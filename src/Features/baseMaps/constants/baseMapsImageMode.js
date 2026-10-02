import {
  HideImageOutlined,
  Image as ImageIcon,
  ImageOutlined,
} from "@mui/icons-material";

// Global display of the base map images, layered over the per-base-map
// settings (image eyes, opacity, gray scale): 2D map editors, base maps grid
// and 3D scene all read it. Per-scope local state (viewers.baseMapsImageMode).
export const BASE_MAPS_IMAGE_MODE = {
  NONE: "NONE", // annotations only
  FADED: "FADED", // light grey image, the annotations stand out
  FULL: "FULL", // as set on each base map
};

export const FADED_IMAGE_OPACITY = 0.35;

// Shared by the module panel section and the selector of the base maps grid.
export const BASE_MAPS_IMAGE_MODE_OPTIONS = [
  {
    key: BASE_MAPS_IMAGE_MODE.NONE,
    label: "Masquer",
    tooltip: "Sans image",
    Icon: HideImageOutlined,
  },
  {
    key: BASE_MAPS_IMAGE_MODE.FADED,
    label: "Gris clair",
    tooltip: "Image en gris clair",
    Icon: ImageOutlined,
  },
  {
    key: BASE_MAPS_IMAGE_MODE.FULL,
    label: "Original",
    tooltip: "Image",
    Icon: ImageIcon,
  },
];

export function isBaseMapsImageMode(value) {
  return Object.values(BASE_MAPS_IMAGE_MODE).includes(value);
}
