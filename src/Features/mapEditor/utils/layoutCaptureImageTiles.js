// Row-based grid layout of the capture photo tiles (CaptureImagesOverlay).
// Pure: items in display order → tiles in zone-local px. Each row is as tall
// as its tallest tile; column order follows the display numbering so the
// numbers read naturally.
//
// items: [{ id, aspect (width / height, > 0), captionHeight }]
// zone:  { width, columns, gap }

export default function layoutCaptureImageTiles({ items, zone }) {
  const columns = Math.max(1, Math.round(zone?.columns ?? 2));
  const gap = zone?.gap ?? 8;
  const width = zone?.width ?? 0;
  const tileWidth = Math.max(1, (width - gap * (columns - 1)) / columns);

  const tiles = [];
  let y = 0;
  let rowHeight = 0;
  (items ?? []).forEach((item, i) => {
    const col = i % columns;
    if (col === 0 && i > 0) {
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const aspect = item.aspect > 0 ? item.aspect : 4 / 3;
    const height = tileWidth / aspect + (item.captionHeight ?? 0);
    tiles.push({
      id: item.id,
      number: i + 1,
      x: col * (tileWidth + gap),
      y,
      width: tileWidth,
      height,
      imageHeight: tileWidth / aspect,
    });
    if (height > rowHeight) rowHeight = height;
  });

  return { tiles, height: tiles.length ? y + rowHeight : 0, tileWidth };
}
