// Only the DOM destination is shared; scan data and GPU objects stay outside Redux.
let host = null;
const listeners = new Set();
export const getScanPanelHost = () => host;
export const subscribeScanPanelHost = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function registerScanPanelHost(element) {
  host = element;
  listeners.forEach((listener) => listener());
}
