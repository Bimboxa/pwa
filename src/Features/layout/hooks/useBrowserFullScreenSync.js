import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setIsFullScreen } from "../layoutSlice";

import {
  enterBrowserFullScreen,
  exitBrowserFullScreen,
  isBrowserFullScreen,
} from "../services/browserFullScreen";

// Keeps the browser full screen (Fullscreen API) in step with the app's full
// screen layout (s.layout.isFullScreen): entering the mode requests the
// browser full screen, leaving it exits it. The other way round, leaving the
// browser full screen (Escape, F11, system gesture) leaves the mode too, so
// the top bar never stays hidden in a windowed browser.
export default function useBrowserFullScreenSync() {
  const dispatch = useDispatch();
  const store = useStore();

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  useEffect(() => {
    if (isFullScreen) {
      if (!isBrowserFullScreen()) enterBrowserFullScreen();
    } else {
      exitBrowserFullScreen();
    }
  }, [isFullScreen]);

  useEffect(() => {
    const handleChange = () => {
      if (isBrowserFullScreen()) return;
      if (store.getState().layout.isFullScreen) {
        dispatch(setIsFullScreen(false));
      }
    };
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      document.removeEventListener("webkitfullscreenchange", handleChange);
    };
  }, [dispatch, store]);
}
