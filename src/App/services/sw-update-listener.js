import {registerSW} from "virtual:pwa-register";

let updateSW = null;

export function setupSWUpdateListener(onNeedRefresh) {
  updateSW = registerSW({
    onNeedRefresh() {
      // Call your handler to show a "New version available" message
      console.log("Need refresh");
      onNeedRefresh();
    },
  });
}

export function checkForSWUpdate() {
  if (updateSW) {
    console.log("check updateSW", updateSW);
    updateSW();
  }
}
