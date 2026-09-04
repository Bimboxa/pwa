import { useDispatch } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";

import db from "App/db/db";

import syncMainAnnotationLabelsService from "../services/syncMainAnnotationLabelsService";

export default function useUpdateBusinessObject() {
  const dispatch = useDispatch();

  // Edit a business object's props (label / color / description / unit /
  // isTitle). unit: null clears the unit (unit-less row); pass undefined to
  // leave a field untouched.
  const update = async (
    businessObjectId,
    { label, color, description, unit, isTitle } = {}
  ) => {
    const updates = {};
    if (label != null) updates.label = label;
    if (color != null) updates.color = color;
    if (description != null) updates.description = description;
    if (unit !== undefined) updates.unit = unit;
    if (isTitle !== undefined) updates.isTitle = Boolean(isTitle);
    if (Object.keys(updates).length === 0) return;

    await db.businessObjects.update(businessObjectId, updates);
    dispatch(triggerBusinessObjectsUpdate());

    // Renaming a located object writes the new name into its main
    // annotations' rows (best effort — the displayed label is derived at
    // read time anyway).
    if (label != null) {
      const updated = await syncMainAnnotationLabelsService({
        businessObjectId,
        label,
      });
      if (updated > 0) dispatch(triggerRelsBusinessObjectAnnotationUpdate());
    }
  };

  return update;
}
