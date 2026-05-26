import { registerSW } from "virtual:pwa-register";

import store from "App/store";
import {
  setNewVersionAvailable,
  setNewVersionDialogOpen,
} from "Features/appConfig/appConfigSlice";

// Belt-and-braces: the version.json polling in useDetectNewVersion is the
// primary detector, but the workbox SW also exposes its own "new version is
// waiting" signal. We forward it to the same Redux flag so the UI reacts even
// when polling misses (e.g. offline → online race condition).
export function setupSWUpdateListener() {
  registerSW({
    onNeedRefresh() {
      const state = store.getState();
      // Don't override a more informative payload that the poller may already
      // have set (with version + description).
      if (!state.appConfig.newVersionAvailable) {
        store.dispatch(
          setNewVersionAvailable({ version: "?", description: "" })
        );
        store.dispatch(setNewVersionDialogOpen(true));
      }
    },
  });
}
