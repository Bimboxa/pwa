// State of a business object in a Krnet state model (listing.notesApp
// .stateModels): the LOCAL value of the listing-model field of type "state"
// bound to the model when the object carries one (fieldValues, same
// precedence rule as businessObjectFieldValues.getBusinessObjectFieldValue),
// else the Krnet snapshot `notesAppRemote.stateValues[stateModelId]` — the
// raw value the pull keeps for every state model, even the ones no field
// exposes. null when the object has no state in that model. Pure module.

export default function getBusinessObjectStateId(
  businessObject,
  stateModelId,
  fields = []
) {
  if (!businessObject || !stateModelId) return null;
  const field = (fields ?? []).find(
    (f) => f?.type === "state" && f.stateModelId === stateModelId
  );
  const values = businessObject.fieldValues;
  if (
    field &&
    values &&
    typeof values === "object" &&
    Object.prototype.hasOwnProperty.call(values, field.id)
  ) {
    return values[field.id] ?? null;
  }
  return businessObject.notesAppRemote?.stateValues?.[stateModelId] ?? null;
}
