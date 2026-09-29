// Camera conversions between the 2D map editor and the base maps grid. Pure.
//
// Editor frame (outside the background-page mode): the print zone sheet
// CENTRE is the world origin and 1 world unit = 1 image px, so
//   screen = editorCamera.k * world + editorCamera.xy
// Grid frame: world unit = paper point. A sheet is
//   { x, y, width, height, scale } with scale = paper pt per image px.
//
// Two cameras are "aligned" when the sheet covers the same screen rect in
// both frames: that is what makes the editor <-> grid cross-fade seamless.

export function editorToGridCamera({ editorCamera, sheet }) {
  const k = editorCamera.k / sheet.scale;
  return {
    k,
    x: editorCamera.x - k * (sheet.x + sheet.width / 2),
    y: editorCamera.y - k * (sheet.y + sheet.height / 2),
  };
}

export function gridToEditorCamera({ gridCamera, sheet }) {
  return {
    k: gridCamera.k * sheet.scale,
    x: gridCamera.x + gridCamera.k * (sheet.x + sheet.width / 2),
    y: gridCamera.y + gridCamera.k * (sheet.y + sheet.height / 2),
  };
}

// Editor camera showing the sheet centred in the viewport, covering `ratio`
// of it (limiting dimension).
export function getEditorCameraForSheetRatio({ printZone, viewport, ratio }) {
  if (!printZone?.width || !printZone?.height) return null;
  if (!viewport?.width || !viewport?.height) return null;
  const k =
    ratio *
    Math.min(
      viewport.width / printZone.width,
      viewport.height / printZone.height
    );
  return { k, x: viewport.width / 2, y: viewport.height / 2 };
}

export function getSheetsBounds(sheets) {
  if (!sheets?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  sheets.forEach((sheet) => {
    minX = Math.min(minX, sheet.x);
    minY = Math.min(minY, sheet.y);
    maxX = Math.max(maxX, sheet.x + sheet.width);
    maxY = Math.max(maxY, sheet.y + sheet.height);
  });
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Grid camera fitting `bounds` (grid world) inside the viewport, minus the
// padding ({ top, right, bottom, left } in screen px).
export function getGridCameraFitBounds({ bounds, viewport, padding }) {
  if (!bounds?.width || !bounds?.height) return null;
  if (!viewport?.width || !viewport?.height) return null;
  const top = padding?.top ?? 0;
  const right = padding?.right ?? 0;
  const bottom = padding?.bottom ?? 0;
  const left = padding?.left ?? 0;
  const availableWidth = Math.max(1, viewport.width - left - right);
  const availableHeight = Math.max(1, viewport.height - top - bottom);
  const k = Math.min(
    availableWidth / bounds.width,
    availableHeight / bounds.height
  );
  return {
    k,
    x: left + availableWidth / 2 - k * (bounds.x + bounds.width / 2),
    y: top + availableHeight / 2 - k * (bounds.y + bounds.height / 2),
  };
}
