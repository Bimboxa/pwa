import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

// Positions of the sheets moved by hand on the table, per project and per
// device: localStorage only (never Dexie, never exported in a Krto zip).
// { [baseMapId]: { x, y } } in paper points. Sheets without a stored position
// fall back to the auto layout.
const STORAGE_KEY_PREFIX = "baseMapsGrid:";

// Exported for the 3D base maps grid, which reads the arrangement each time
// it opens (no React state of its own).
export function readBaseMapsGridPositions(projectId) {
  if (!projectId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const positions = parsed?.positions;
    if (!positions || typeof positions !== "object") return {};
    const result = {};
    Object.entries(positions).forEach(([id, p]) => {
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
        result[id] = { x: p.x, y: p.y };
      }
    });
    return result;
  } catch {
    return {};
  }
}

function writePositions(projectId, positions) {
  if (!projectId) return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${projectId}`,
      JSON.stringify({ positions })
    );
  } catch {
    // storage full / unavailable: the layout stays in memory
  }
}

export default function useBaseMapsGridLayout() {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [positions, setPositions] = useState(() =>
    readBaseMapsGridPositions(projectId)
  );

  useEffect(() => {
    setPositions(readBaseMapsGridPositions(projectId));
  }, [projectId]);

  // handlers

  const setSheetPosition = useCallback(
    (baseMapId, position) => {
      setPositions((current) => {
        const next = { ...current, [baseMapId]: position };
        writePositions(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  // bulk update: { [baseMapId]: { x, y } }
  const setSheetPositions = useCallback(
    (positionsById) => {
      setPositions((current) => {
        const next = { ...current, ...positionsById };
        writePositions(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  // back to the auto layout for these sheets
  const resetSheetPositions = useCallback(
    (baseMapIds) => {
      setPositions((current) => {
        const next = { ...current };
        baseMapIds.forEach((id) => delete next[id]);
        writePositions(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  return {
    positions,
    setSheetPosition,
    setSheetPositions,
    resetSheetPositions,
  };
}
