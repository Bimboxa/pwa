import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItem,
} from "Features/selection/selectionSlice";
import { setPovFramingActive } from "../povSlice";

import applyInteractionModeChange from "Features/mapEditor/utils/applyInteractionModeChange";

// Back to the POV module's initial state: no capture frame, no selected view,
// PopperMapListings visible in SELECT mode (filtering).
export default function useExitPovFraming() {
  const dispatch = useDispatch();

  const selectedItem = useSelector(selectSelectedItem);
  const interactionMode = useSelector(
    (s) => s.popperMapListings.interactionMode
  );

  return function exitFraming() {
    dispatch(setPovFramingActive(false));
    if (selectedItem?.type === "POV") dispatch(setSelectedItem(null));
    if (interactionMode !== "SELECT")
      applyInteractionModeChange(dispatch, {
        current: interactionMode,
        next: "SELECT",
        selectedItem,
      });
  };
}
