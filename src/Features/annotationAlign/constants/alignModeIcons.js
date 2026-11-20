import {
  AlignHorizontalCenter,
  AlignHorizontalLeft,
  AlignHorizontalRight,
  AlignVerticalBottom,
  AlignVerticalCenter,
  AlignVerticalTop,
} from "@mui/icons-material";

import {
  ALIGN_BOTTOM,
  ALIGN_CENTER_H,
  ALIGN_LEFT,
  ALIGN_MIDDLE,
  ALIGN_RIGHT,
  ALIGN_TOP,
} from "./alignModes";

export const ALIGN_MODE_ICONS = {
  [ALIGN_LEFT]: AlignHorizontalLeft,
  [ALIGN_CENTER_H]: AlignHorizontalCenter,
  [ALIGN_RIGHT]: AlignHorizontalRight,
  [ALIGN_TOP]: AlignVerticalTop,
  [ALIGN_MIDDLE]: AlignVerticalCenter,
  [ALIGN_BOTTOM]: AlignVerticalBottom,
};
