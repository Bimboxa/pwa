import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useRelsBusinessObjectAnnotation from "Features/businessObjects/hooks/useRelsBusinessObjectAnnotation";
import useUpdateBusinessObject from "Features/businessObjects/hooks/useUpdateBusinessObject";

// Editable annotation label (used a.o. to name "Profil" annotations picked in
// the elevation section editor). Committed on blur.
// DETAIL annotations linked to a detail baseMap edit the baseMap's detailRef
// instead: it is the single source of truth for the bubble of every linked
// annotation (same redirection as the inline bubble edit in NodeDetailStatic).
// MAIN annotations of a located business object edit the OBJECT's name: the
// displayed label is derived from it (useAnnotationsV2 override).
export default function FieldAnnotationLabel({ annotation }) {
  const dispatch = useDispatch();

  // data

  const detailBaseMapId =
    annotation?.type === "DETAIL" ? annotation?.detailBaseMapId : null;
  const detailBaseMap = useLiveQuery(
    async () => (detailBaseMapId ? db.baseMaps.get(detailBaseMapId) : null),
    [detailBaseMapId]
  );

  // data — main business object (rel flagged isMain on this annotation)

  const { value: rels } = useRelsBusinessObjectAnnotation({
    annotationId: annotation?.id,
  });
  const mainBusinessObjectId =
    rels?.find((r) => r.isMain)?.businessObjectId ?? null;
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects?.businessObjectsUpdatedAt
  );
  const mainBusinessObjectRow = useLiveQuery(
    async () =>
      mainBusinessObjectId
        ? db.businessObjects.get(mainBusinessObjectId)
        : null,
    [mainBusinessObjectId, businessObjectsUpdatedAt]
  );
  const mainBusinessObject =
    mainBusinessObjectRow && !mainBusinessObjectRow.deletedAt
      ? mainBusinessObjectRow
      : null;
  const updateBusinessObject = useUpdateBusinessObject();

  // handlers

  async function handleChange(label) {
    if (!annotation?.id) return;
    if (detailBaseMapId) {
      if ((detailBaseMap?.detailRef ?? "") === label) return;
      await db.baseMaps.update(detailBaseMapId, {
        detailRef: label.trim() || null,
      });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      return;
    }
    if (mainBusinessObject) {
      const next = label.trim();
      if (!next || next === mainBusinessObject.label) return;
      await updateBusinessObject(mainBusinessObject.id, { label: next });
      return;
    }
    if ((annotation.label ?? "") === label) return;
    await db.annotations.update(annotation.id, { label });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  let fieldLabel = "Label";
  let value = annotation?.label ?? "";
  if (detailBaseMapId) {
    fieldLabel = "Référence";
    value = detailBaseMap?.detailRef ?? "";
  } else if (mainBusinessObject) {
    fieldLabel = "Nom de l'ouvrage";
    value = mainBusinessObject.label ?? "";
  }

  return (
    <FieldTextV2
      label={fieldLabel}
      value={value}
      onChange={handleChange}
      options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
    />
  );
}
