import { useDispatch, useSelector } from "react-redux";

import { persistPanelHeight, setPanelHeight } from "../planningSlice";

import {
  PANEL_DEFAULT_HEIGHT,
  PANEL_MAX_HEIGHT_RATIO,
  PANEL_MIN_HEIGHT,
} from "../constants/planningDefaults";

// Vertical drag of the bottom panel's top handle (window mousemove/mouseup,
// like the right panel's width handle). Returns the clamped height and the
// handle's mouse handlers.
export default function usePlanningPanelResize() {
  const dispatch = useDispatch();

  const panelHeight = useSelector((s) => s.planning.panelHeight);
  const windowHeight = useSelector((s) => s.layout.windowHeight);
  const topBarHeight = useSelector((s) => s.layout.topBarHeight);
  const bottomBarHeight = useSelector((s) => s.layout.bottomBarHeightDesktop);

  const viewerHeight =
    (windowHeight ?? window.innerHeight) - topBarHeight - bottomBarHeight;
  const maxHeight = Math.max(
    PANEL_MIN_HEIGHT,
    Math.floor(viewerHeight * PANEL_MAX_HEIGHT_RATIO)
  );
  const clamp = (h) => Math.min(Math.max(h, PANEL_MIN_HEIGHT), maxHeight);
  const height = clamp(panelHeight ?? PANEL_DEFAULT_HEIGHT);

  function onMouseDown(e) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;
    function onMove(ev) {
      dispatch(setPanelHeight(clamp(startHeight + (startY - ev.clientY))));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      dispatch(persistPanelHeight());
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
  }

  function onDoubleClick() {
    dispatch(setPanelHeight(clamp(PANEL_DEFAULT_HEIGHT)));
    dispatch(persistPanelHeight());
  }

  return { height, maxHeight, onMouseDown, onDoubleClick };
}
