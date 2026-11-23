import { useDispatch } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";

import { withUndoGroup } from "App/db/undoManager";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";

import explodeComponentService from "../services/explodeComponentService";

// « Éclater le composant »: detaches the generated annotations of the given
// component sources (explodeComponentService), deletes the sources — one undo
// step — then empties the selection: the components it held are gone, and
// the freed annotations show as if they had been drawn on their own.
//
// Returns the detached annotations ([] when there was nothing to explode —
// the sources and the selection are then left untouched).
export default function useExplodeComponents() {
  const dispatch = useDispatch();
  const deleteAnnotations = useDeleteAnnotations();

  return async (sourceIds) => {
    const ids = [...new Set((sourceIds ?? []).filter(Boolean))];
    if (ids.length === 0) return [];

    let detached = [];
    await withUndoGroup(async () => {
      detached = await explodeComponentService({ sourceIds: ids });
      if (detached.length === 0) return;
      // the children are detached: the cascade only takes the sources
      await deleteAnnotations(ids);
    });
    if (detached.length === 0) return [];

    dispatch(clearSelection());
    return detached;
  };
}
