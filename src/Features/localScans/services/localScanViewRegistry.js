// Scan views currently in the 3D scene (the Scan 3D tool's own view and the
// point clouds carried by scan base maps): createLocalScanView registers
// itself and leaves on dispose. Read by pickers that are not the tool's own
// inspection (walk-mode laser meter).
const views = new Set();

export function registerLocalScanView(view) {
  views.add(view);
  return () => views.delete(view);
}

export function getLocalScanViews() {
  return [...views];
}

// Is the scan view displayed: attached to the scene, its root and every
// ancestor visible (a hidden base map group, chip off, tool eye off…).
export function isLocalScanViewDisplayed(view, scene) {
  for (let object = view.root; object; object = object.parent) {
    if (!object.visible) return false;
    if (object === scene) return true;
  }
  return false;
}
