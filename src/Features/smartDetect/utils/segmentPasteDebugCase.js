// Portable snapshot of one Space detection (localStorage.debugSegmentPaste):
// the pixels around the copied segment and around the cursor, plus every
// parameter of the call. `restoreSegmentPasteDebugCase` rebuilds the options
// of prepareCopiedSegmentCreation so a failure can be replayed under node.
// Pixels outside both crops are restored as white paper.
const toBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text) =>
  Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

export function buildSegmentPasteDebugCase(
  {
    clipboard,
    imageData,
    cursorImgPx,
    exclusionMask,
    imageScale = 1,
    imageOffset = { x: 0, y: 0 },
    meterByPx = 0,
    pasteTransform,
    baseMapId,
  },
  result,
  padding = 300
) {
  const item = clipboard.items[0];
  const source = item.basePoints.map((p) => ({
    x: (p.x - imageOffset.x) / imageScale,
    y: (p.y - imageOffset.y) / imageScale,
  }));
  const crop = (points) => {
    const x0 = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p.x)) - padding)
    );
    const y0 = Math.max(
      0,
      Math.floor(Math.min(...points.map((p) => p.y)) - padding)
    );
    const x1 = Math.min(
      imageData.width,
      Math.ceil(Math.max(...points.map((p) => p.x)) + padding)
    );
    const y1 = Math.min(
      imageData.height,
      Math.ceil(Math.max(...points.map((p) => p.y)) + padding)
    );
    const width = x1 - x0,
      height = y1 - y0;
    const rgba = new Uint8Array(width * height * 4),
      mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const from = ((y0 + y) * imageData.width + x0) * 4;
      rgba.set(imageData.data.subarray(from, from + width * 4), y * width * 4);
      if (exclusionMask)
        mask.set(
          exclusionMask.subarray(
            (y0 + y) * imageData.width + x0,
            (y0 + y) * imageData.width + x0 + width
          ),
          y * width
        );
    }
    return {
      x: x0,
      y: y0,
      width,
      height,
      rgba: toBase64(rgba),
      mask: exclusionMask ? toBase64(mask) : null,
    };
  };
  return {
    imageSize: { width: imageData.width, height: imageData.height },
    cursorImgPx,
    imageScale,
    imageOffset,
    meterByPx,
    pasteTransform,
    baseMapId,
    item: {
      annotation: {
        type: item.annotation.type,
        strokeWidth: item.annotation.strokeWidth,
        strokeWidthUnit: item.annotation.strokeWidthUnit,
        stripOrientation: item.annotation.stripOrientation,
        baseMapId: item.annotation.baseMapId,
      },
      basePoints: item.basePoints.map(({ x, y, type }) => ({ x, y, type })),
      stripOrientation: item.stripOrientation,
    },
    reason: result?.reason ?? null,
    placedPoints: result?.match?.placedPoints ?? null,
    trace: result?.trace ?? null,
    crops: [crop(source), crop([cursorImgPx])],
  };
}

export function restoreSegmentPasteDebugCase(debugCase) {
  const { width, height } = debugCase.imageSize;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const exclusionMask = debugCase.crops.some((crop) => crop.mask)
    ? new Uint8Array(width * height)
    : null;
  for (const crop of debugCase.crops) {
    const rgba = fromBase64(crop.rgba),
      mask = crop.mask && fromBase64(crop.mask);
    for (let y = 0; y < crop.height; y++) {
      data.set(
        rgba.subarray(y * crop.width * 4, (y + 1) * crop.width * 4),
        ((crop.y + y) * width + crop.x) * 4
      );
      if (mask)
        exclusionMask.set(
          mask.subarray(y * crop.width, (y + 1) * crop.width),
          (crop.y + y) * width + crop.x
        );
    }
  }
  return {
    clipboard: { items: [debugCase.item] },
    imageData: { width, height, data },
    cursorImgPx: debugCase.cursorImgPx,
    exclusionMask,
    imageScale: debugCase.imageScale,
    imageOffset: debugCase.imageOffset,
    meterByPx: debugCase.meterByPx,
    pasteTransform: debugCase.pasteTransform,
    baseMapId: debugCase.baseMapId,
  };
}
