import { useDispatch } from "react-redux";

import { setCaptureToolActive } from "../mapEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

// "Quitter le mode capture": drops the capture frame AND closes the right
// panel. Shared by the capture panel header and the condensed band's first
// button. The save bar's X deliberately dispatches setCaptureToolActive alone
// and lets PanelCaptureTool's transition effect close the panel.
export default function useExitCaptureTool() {
  const dispatch = useDispatch();

  return function exitCaptureTool() {
    dispatch(setCaptureToolActive(false));
    dispatch(setSelectedMenuItemKey(null));
  };
}
