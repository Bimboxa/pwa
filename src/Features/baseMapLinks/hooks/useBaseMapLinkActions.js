import { useLiveQuery } from "dexie-react-hooks";
import { useDispatch, useSelector } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";

import db from "App/db/db";

import reverseBaseMapLinkDirectionService from "../services/reverseBaseMapLinkDirectionService";
import { isBaseMapLinkClone } from "../utils/baseMapLinkPredicates";

// Actions of a section mark ("trait de coupe"), shared by its edit toolbar
// (ToolbarEditBaseMapLink) and its properties section
// (SectionBaseMapLinkProperties). `annotation` is the selected mark as
// resolved by useAnnotationsV2: the SOURCE on its plan, or its CLONE located
// on a vertical base map (which then carries `sourceLinkLabel` /
// `sourceLinkBaseMapId`).
//
// The label and the direction (observer side) belong to the source: edited
// from a clone, they are written on its source. Deleting a clone only removes
// that locating; deleting a source takes its clones along (delete hook).
export default function useBaseMapLinkActions(annotation) {
  const dispatch = useDispatch();

  // data

  const deleteAnnotation = useDeleteAnnotation();
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const isClone = isBaseMapLinkClone(annotation);
  const sourceId = isClone
    ? annotation.sourceLinkAnnotationId
    : (annotation?.id ?? null);

  // The other end of the link: the plan of a clone, or — for a source — the
  // vertical base map it is located on (only while a clone lives there).
  const counterpart = useLiveQuery(async () => {
    if (!annotation?.id) return null;
    let baseMapId = null;
    if (isClone) {
      baseMapId =
        annotation.sourceLinkBaseMapId ??
        (await db.annotations.get(sourceId))?.baseMapId ??
        null;
    } else if (annotation.linkedBaseMapId) {
      const clones = await db.annotations
        .where("baseMapId")
        .equals(annotation.linkedBaseMapId)
        .filter(
          (a) =>
            !a.deletedAt &&
            a.type === "BASE_MAP_LINK" &&
            a.sourceLinkAnnotationId === annotation.id
        )
        .count();
      if (clones > 0) baseMapId = annotation.linkedBaseMapId;
    }
    if (!baseMapId) return null;
    const baseMap = await db.baseMaps.get(baseMapId);
    return baseMap && !baseMap.deletedAt
      ? { id: baseMap.id, name: baseMap.name ?? "" }
      : null;
  }, [
    annotation?.id,
    annotation?.linkedBaseMapId,
    annotation?.sourceLinkBaseMapId,
    isClone,
    sourceId,
    annotationsUpdatedAt,
  ]);

  // helpers

  const label = isClone
    ? (annotation?.sourceLinkLabel ?? "")
    : (annotation?.label ?? "");

  // handlers

  async function commitLabel(nextLabel) {
    if (!sourceId) return;
    const next = String(nextLabel ?? "").trim();
    if (next === label) return;
    await db.annotations.update(sourceId, { label: next });
    dispatch(triggerAnnotationsUpdate());
  }

  async function reverse() {
    if (!annotation?.id) return;
    await reverseBaseMapLinkDirectionService({
      linkId: annotation.id,
      dispatch,
    });
  }

  async function deleteLink() {
    if (!annotation?.id) return;
    await deleteAnnotation(annotation.id);
    dispatch(clearSelection());
  }

  function goToCounterpart() {
    if (counterpart?.id) dispatch(setSelectedMainBaseMapId(counterpart.id));
  }

  return {
    isClone,
    sourceId,
    label,
    counterpart: counterpart ?? null,
    commitLabel,
    reverse,
    deleteLink,
    goToCounterpart,
  };
}
