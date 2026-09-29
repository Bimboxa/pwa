import { useDispatch } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
} from "../businessObjectsSlice";

import db from "App/db/db";

import syncMainAnnotationLabelsService from "../services/syncMainAnnotationLabelsService";
import { setBusinessObjectFieldValue } from "../utils/businessObjectFieldValues";
import { BUSINESS_OBJECT_STATUS } from "../utils/getBusinessObjectStatus";

export default function useUpdateBusinessObject() {
  const dispatch = useDispatch();

  // Edit a business object's props (label / code / color / description /
  // unit / refQty / isTitle / hoursRatio / hoursRatioMode / hoursRatioUnit /
  // globalLayerId / qtyFormulas / status). code: "" or null clears the code; refQty: null (or a
  // non-finite value) clears the reference quantity.
  // unit: null
  // clears the unit (unit-less row, and every task — the quantity unit is an
  // articles-only prop); hoursRatio: null (or a non-finite value) clears the
  // ratio; pass undefined to leave a field untouched.
  const update = async (
    businessObjectId,
    {
      label,
      code,
      color,
      description,
      unit,
      refQty,
      isTitle,
      hoursRatio,
      hoursRatioMode,
      hoursRatioUnit,
      globalLayerId,
      // [{annotationTemplateId, formula}] — custom quantity formulas per
      // annotation template (see utils/qtyFormula), replaced as a whole
      qtyFormulas,
      // {[fieldId]: value} — listing-model field values (Fiche tab), merged
      // into businessObject.fieldValues; an empty value drops the key
      fieldValues,
      // "OPEN" | "CLOSED" (types with the status feature); closedAt follows
      status,
    } = {}
  ) => {
    const updates = {};
    if (label != null) updates.label = label;
    if (color != null) updates.color = color;
    if (description != null) updates.description = description;
    if (code !== undefined) updates.code = code || null;
    if (unit !== undefined) updates.unit = unit;
    if (refQty !== undefined)
      updates.refQty = Number.isFinite(refQty) ? refQty : null;
    if (isTitle !== undefined) updates.isTitle = Boolean(isTitle);
    if (hoursRatio !== undefined)
      updates.hoursRatio = Number.isFinite(hoursRatio) ? hoursRatio : null;
    if (hoursRatioMode != null) updates.hoursRatioMode = hoursRatioMode;
    if (hoursRatioUnit != null) updates.hoursRatioUnit = hoursRatioUnit;
    // PLANNING tasks: global layer (annotation partition) the task applies
    // to; null = every annotation of a work package. undefined = untouched.
    if (globalLayerId !== undefined)
      updates.globalLayerId = globalLayerId || null;
    if (Array.isArray(qtyFormulas)) updates.qtyFormulas = qtyFormulas;
    if (status != null) {
      const closed = status === BUSINESS_OBJECT_STATUS.CLOSED;
      updates.status = closed
        ? BUSINESS_OBJECT_STATUS.CLOSED
        : BUSINESS_OBJECT_STATUS.OPEN;
      updates.closedAt = closed ? new Date().toISOString() : null;
    }
    if (fieldValues && typeof fieldValues === "object") {
      const current = (await db.businessObjects.get(businessObjectId))
        ?.fieldValues;
      let next = current ?? {};
      for (const [fieldId, value] of Object.entries(fieldValues)) {
        next = setBusinessObjectFieldValue(next, fieldId, value);
      }
      updates.fieldValues = next;
    }
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
