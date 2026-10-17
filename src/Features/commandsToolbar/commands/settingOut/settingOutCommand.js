import IconSettingOut from "Features/annotations/components/IconSettingOut";

import ButtonSettingOut from "./ButtonSettingOut";
import { getTargetsState } from "../../utils/selectionCommandState";

export const SETTING_OUT_TYPES = ["POLYLINE"];

// « Calepiner »: creates POINT annotations along the selected polylines at a
// given step (useCreateSettingOutAnnotations), popover with the options and a
// POINT template picker.
export default {
  key: "SETTING_OUT",
  label: "Calepiner",
  Icon: IconSettingOut,
  Button: ButtonSettingOut,
  getState: (ctx) =>
    getTargetsState(ctx, SETTING_OUT_TYPES, "Sélectionnez au moins une ligne"),
};
