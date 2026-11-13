import { useEffect, useState } from "react";

// Id of the "print zones" tile under the pointer, read from window mousemove
// so the host does not have to take the mouse (capture frame: the tiles are
// svg decor). `tiles` in px relative to `getOriginRect()` (client px). Frozen
// while a mouse button is down.
export default function useHoveredPrintZoneTileId({
  active,
  tiles,
  getOriginRect,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (!active) return undefined;
    const onMove = (e) => {
      if (e.buttons) return;
      const o = getOriginRect?.();
      if (!o) return;
      const x = e.clientX - o.left;
      const y = e.clientY - o.top;
      let id = null;
      // Last drawn = on top.
      for (let i = (tiles?.length ?? 0) - 1; i >= 0; i--) {
        const t = tiles[i];
        if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
          id = t.id;
          break;
        }
      }
      setHoveredId((prev) => (prev === id ? prev : id));
    };
    const onLeave = () => setHoveredId(null);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [active, tiles, getOriginRect]);

  return active ? hoveredId : null;
}
