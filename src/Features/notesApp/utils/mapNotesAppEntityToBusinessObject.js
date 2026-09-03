// Maps a normalized notes-app entity row to a Bimboxa db.businessObjects row
// ("Ouvrages" tree).
//
// v1 contract: name -> label, code kept as an extra prop; freeText field
// values are resolved against the remote listing's model labels and
// concatenated into `description`; everything else (categories, states...)
// is kept raw under `notesAppRemote` — a lossless parsed snapshot enabling a
// 3-way merge when push arrives. Both sides use fractional-indexing for
// sibling order, so sortKey copies straight into sortIndex.
//
// parentId stays the REMOTE id here: the caller remaps it through the
// idMaster map in a second pass. unit is null (unit-less row): notes-app has
// no quantity-unit concept — the user assigns U/ml/m² in Bimboxa afterwards.

export default function mapNotesAppEntityToBusinessObject({
  remoteEntity,
  remoteListing,
  localId,
  bimboxaListing,
  projectId,
  userIdMaster,
}) {
  const fieldsModel = Array.isArray(remoteListing?.settings?.fields)
    ? remoteListing.settings.fields
    : [];
  const remoteFields =
    remoteEntity.fields && typeof remoteEntity.fields === "object"
      ? remoteEntity.fields
      : {};

  const freeTextLines = [];
  for (const field of fieldsModel) {
    if (field?.type !== "freeText") continue;
    const value = remoteFields[field.id];
    if (value == null || value === "") continue;
    freeTextLines.push(field.label ? `${field.label}: ${value}` : String(value));
  }
  const description = freeTextLines.join("\n") || undefined;

  const createdAtIso = remoteEntity.createdAt
    ? new Date(remoteEntity.createdAt).toISOString()
    : undefined;
  const updatedAtIso = remoteEntity.updatedAt
    ? new Date(remoteEntity.updatedAt).toISOString()
    : createdAtIso;
  const deletedAtIso = remoteEntity.deletedAt
    ? new Date(remoteEntity.deletedAt).toISOString()
    : undefined;

  return {
    id: localId,
    idMaster: remoteEntity.id,
    remoteSource: "notesApp",
    remoteUpdatedAt: remoteEntity.updatedAt ?? null,
    listingId: bimboxaListing.id,
    projectId,
    ...(bimboxaListing.scopeId && { scopeId: bimboxaListing.scopeId }),
    label: remoteEntity.name,
    ...(remoteEntity.code != null && { code: remoteEntity.code }),
    ...(description && { description }),
    ...(bimboxaListing.color && { color: bimboxaListing.color }),
    parentId: remoteEntity.parentId ?? null,
    ...(remoteEntity.sortKey != null && { sortIndex: remoteEntity.sortKey }),
    unit: null,
    notesAppRemote: {
      name: remoteEntity.name ?? null,
      code: remoteEntity.code ?? null,
      fields: remoteEntity.fields ?? null,
      stateValues: remoteEntity.stateValues ?? null,
      settings: remoteEntity.settings ?? null,
      parentId: remoteEntity.parentId ?? null,
      sortKey: remoteEntity.sortKey ?? null,
    },
    ...(createdAtIso && { createdAt: createdAtIso }),
    ...(updatedAtIso && { updatedAt: updatedAtIso }),
    ...(deletedAtIso && { deletedAt: deletedAtIso }),
    createdByUserIdMaster: userIdMaster,
  };
}
