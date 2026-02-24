const MIN_SIZE = 20;

export default function computeResizedRect(
  startRect,
  dx,
  dy,
  handle,
  aspectRatio = null
) {
  let { x, y, width, height } = startRect;

  if (handle === "move") {
    return { x: x + dx, y: y + dy, width, height };
  }

  // --- free resize (no aspect ratio) ---
  if (!aspectRatio) {
    switch (handle) {
      case "nw":
        x += dx;
        y += dy;
        width -= dx;
        height -= dy;
        break;
      case "n":
        y += dy;
        height -= dy;
        break;
      case "ne":
        y += dy;
        width += dx;
        height -= dy;
        break;
      case "e":
        width += dx;
        break;
      case "se":
        width += dx;
        height += dy;
        break;
      case "s":
        height += dy;
        break;
      case "sw":
        x += dx;
        width -= dx;
        height += dy;
        break;
      case "w":
        x += dx;
        width -= dx;
        break;
      default:
        break;
    }
  } else {
    // --- aspect-ratio-locked resize ---
    switch (handle) {
      // corner handles: use dominant axis, derive the other
      case "se": {
        const newW = width + dx;
        const newH = width + dx > 0 ? (width + dx) / aspectRatio : height;
        width = newW;
        height = newH;
        break;
      }
      case "nw": {
        const newW = width - dx;
        const newH = newW / aspectRatio;
        x = startRect.x + startRect.width - newW;
        y = startRect.y + startRect.height - newH;
        width = newW;
        height = newH;
        break;
      }
      case "ne": {
        const newW = width + dx;
        const newH = newW / aspectRatio;
        y = startRect.y + startRect.height - newH;
        width = newW;
        height = newH;
        break;
      }
      case "sw": {
        const newW = width - dx;
        const newH = newW / aspectRatio;
        x = startRect.x + startRect.width - newW;
        width = newW;
        height = newH;
        break;
      }

      // edge handles: resize along edge axis, derive perpendicular, center offset
      case "e": {
        const newW = width + dx;
        const newH = newW / aspectRatio;
        const dh = newH - height;
        y -= dh / 2;
        width = newW;
        height = newH;
        break;
      }
      case "w": {
        const newW = width - dx;
        const newH = newW / aspectRatio;
        const dh = newH - height;
        x = startRect.x + startRect.width - newW;
        y -= dh / 2;
        width = newW;
        height = newH;
        break;
      }
      case "s": {
        const newH = height + dy;
        const newW = newH * aspectRatio;
        const dw = newW - width;
        x -= dw / 2;
        width = newW;
        height = newH;
        break;
      }
      case "n": {
        const newH = height - dy;
        const newW = newH * aspectRatio;
        const dw = newW - width;
        x -= dw / 2;
        y = startRect.y + startRect.height - newH;
        width = newW;
        height = newH;
        break;
      }
      default:
        break;
    }
  }

  // enforce minimum size
  if (width < MIN_SIZE) {
    const minH = aspectRatio ? MIN_SIZE / aspectRatio : MIN_SIZE;
    if (handle === "nw" || handle === "w" || handle === "sw") {
      x = startRect.x + startRect.width - MIN_SIZE;
    }
    if (aspectRatio && (handle === "nw" || handle === "n" || handle === "ne")) {
      y = startRect.y + startRect.height - minH;
    }
    width = MIN_SIZE;
    if (aspectRatio) height = minH;
  }

  if (height < MIN_SIZE) {
    const minW = aspectRatio ? MIN_SIZE * aspectRatio : MIN_SIZE;
    if (handle === "nw" || handle === "n" || handle === "ne") {
      y = startRect.y + startRect.height - MIN_SIZE;
    }
    if (aspectRatio && (handle === "nw" || handle === "w" || handle === "sw")) {
      x = startRect.x + startRect.width - minW;
    }
    height = MIN_SIZE;
    if (aspectRatio) width = minW;
  }

  return { x, y, width, height };
}
