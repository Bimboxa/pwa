import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setIsFullScreen } from "../layoutSlice";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// The full screen toggle only lives in the top-right row of the 2D / 3D
// editors (ButtonFullScreen). A module switch (Ctrl+letter hotkeys survive
// full screen) to a module without that row (Krto, Portfolio, Table, Admin…)
// would leave no way out: the mode is dropped when the displayed editor is
// not a map / base maps / 3D editor.
export default function useExitFullScreenOnNonEditorModule() {
  const dispatch = useDispatch();

  const isFullScreen = useSelector((s) => s.layout.isFullScreen);
  const effectiveKey = useSelector(selectEffectiveViewerKey);

  const editorSupportsFullScreen =
    effectiveKey === "MAP" ||
    effectiveKey === "BASE_MAPS" ||
    isThreedFamilyViewerKey(effectiveKey);

  useEffect(() => {
    if (isFullScreen && !editorSupportsFullScreen) {
      dispatch(setIsFullScreen(false));
    }
  }, [isFullScreen, editorSupportsFullScreen, dispatch]);
}
