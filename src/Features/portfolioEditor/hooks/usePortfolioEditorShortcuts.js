import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import db from "App/db/db";

export default function usePortfolioEditorShortcuts() {
  // data

  const dispatch = useDispatch();
  const selectedItems = useSelector(selectSelectedItems);
  const framingContainerId = useSelector(
    (s) => s.portfolioBaseMapContainers.framingContainerId
  );

  // effect

  useEffect(() => {
    function handleKeyDown(e) {
      // Skip when framing mode is active
      if (framingContainerId) return;

      // Skip when focus is in an input field
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
        return;

      // Find selected baseMapContainer
      const selected = selectedItems.find(
        (i) => i.type === "BASE_MAP_CONTAINER"
      );
      if (!selected) return;

      // Delete / Backspace → remove container
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        db.portfolioBaseMapContainers.delete(selected.id);
        dispatch(clearSelection());
        return;
      }

      // Arrow keys → move container
      const arrowDeltas = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 },
      };
      const delta = arrowDeltas[e.key];
      if (!delta) return;

      e.preventDefault();
      const step = e.shiftKey ? 1 : 10;
      db.portfolioBaseMapContainers.get(selected.id).then((container) => {
        if (!container || container.deletedAt) return;
        db.portfolioBaseMapContainers.update(selected.id, {
          x: container.x + delta.dx * step,
          y: container.y + delta.dy * step,
        });
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItems, framingContainerId, dispatch]);
}
