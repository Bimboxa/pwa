import {registerSW} from "virtual:pwa-register";

export function setupSWUpdateListener(onNeedRefresh) {
  registerSW({
    onNeedRefresh() {
      // Call your handler to show a "New version available" message
      console.log("Need refresh");
      onNeedRefresh();
    },
  });
}
