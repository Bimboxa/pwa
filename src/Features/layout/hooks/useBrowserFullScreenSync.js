import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setIsFullScreen } from "../layoutSlice";

import {
  enterBrowserFullScreen,
  exitBrowserFullScreen,
  isBrowserFullScreen,
  lockEscapeKey,
  unlockEscapeKey,
} from "../services/browserFullScreen";

// Keeps the browser full screen (Fullscreen API) in step with the app's full
// screen layout (s.layout.isFullScreen): entering the mode requests the
// browser full screen, leaving it exits it. The other way round, leaving the
// browser full screen (long press on Escape, F11, system gesture) leaves the
// mode too, so the top bar never stays hidden in a windowed browser.
//
// Escape is locked while in the mode (Keyboard Lock, Chromium only) so that a
// short press keeps serving the editors' tools instead of leaving the browser
// full screen; the browser then exits on a long press (~2 s) only.
export default function useBrowserFullScreenSync() {
  const dispatch = useDispatch();
  const store = useStore();

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  useEffect(() => {
    if (isFullScreen) {
      if (!isBrowserFullScreen()) enterBrowserFullScreen();
      lockEscapeKey();
    } else {
      unlockEscapeKey();
      exitBrowserFullScreen();
    }
  }, [isFullScreen]);

  useEffect(() => {
    const handleChange = () => {
      if (isBrowserFullScreen()) return;
      unlockEscapeKey();
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
