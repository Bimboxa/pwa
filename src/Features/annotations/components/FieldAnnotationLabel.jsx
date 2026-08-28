import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import db from "App/db/db";
import FieldTextV2 from "Features/form/components/FieldTextV2";

// Editable annotation label (used a.o. to name "Profil" annotations picked in
// the elevation section editor). Committed on blur.
// DETAIL annotations linked to a detail baseMap edit the baseMap's detailRef
// instead: it is the single source of truth for the bubble of every linked
// annotation (same redirection as the inline bubble edit in NodeDetailStatic).
export default function FieldAnnotationLabel({ annotation }) {
  const dispatch = useDispatch();

  // data

  const detailBaseMapId =
    annotation?.type === "DETAIL" ? annotation?.detailBaseMapId : null;
  const detailBaseMap = useLiveQuery(
    async () => (detailBaseMapId ? db.baseMaps.get(detailBaseMapId) : null),
    [detailBaseMapId]
  );

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
    if ((annotation.label ?? "") === label) return;
    await db.annotations.update(annotation.id, { label });
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  return (
    <FieldTextV2
      label={detailBaseMapId ? "Référence" : "Label"}
      value={
        detailBaseMapId
          ? (detailBaseMap?.detailRef ?? "")
          : (annotation?.label ?? "")
      }
      onChange={handleChange}
      options={{ showAsField: true, changeOnBlur: true, hideMic: true }}
    />
  );
}
