import {
  IconAnnotationsHidden,
  IconAnnotationsNormal,
  IconAnnotationsDimmed,
} from "Features/threedEditor/components/iconsAnnotationsDisplay";

// Per-base-map annotation display modes in the 3D viewer.
// Stored in `state.threedEditor.annotationsModeByBaseMapIdIn3d` (a missing key
// means NONE). The main/selected base map is implicitly NORMAL.
export const ANNOTATIONS_DISPLAY_MODE = {
  NONE: "NONE",
  NORMAL: "NORMAL",
  DIMMED: "DIMMED",
};

// Ordered options consumed by the panel's ToggleButtonGroup.
export const ANNOTATIONS_DISPLAY_MODE_OPTIONS = [
  {
    mode: ANNOTATIONS_DISPLAY_MODE.NONE,
    tooltip: "Aucune annotation",
    Icon: IconAnnotationsHidden,
  },
  {
    mode: ANNOTATIONS_DISPLAY_MODE.NORMAL,
    tooltip: "Annotations normales",
    Icon: IconAnnotationsNormal,
  },
  {
    mode: ANNOTATIONS_DISPLAY_MODE.DIMMED,
    tooltip: "Annotations grisées",
    Icon: IconAnnotationsDimmed,
  },
];
