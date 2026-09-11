// Debug snapshot of a business object as stored locally (the "debug" button
// of the object header copies it to the clipboard): the row itself
// (notesAppRemote, notesAppNotes, fieldValues included), its listing and
// scope link summaries, its rels and the linked annotations. Pure.
export default function buildBusinessObjectDebugPayload({
  businessObject,
  listing,
  scopeLink,
  rels,
  annotations,
}) {
  const listingsMappingEntry = (scopeLink?.listingsMapping ?? []).find(
    (m) => m.localListingId === listing?.id
  );
  return {
    exportedAt: new Date().toISOString(),
    businessObject: businessObject ?? null,
    listing: listing
      ? {
          id: listing.id,
          name: listing.name,
          idMaster: listing.idMaster ?? null,
          remoteSource: listing.remoteSource ?? null,
          canLocateBusinessObjects: listing.canLocateBusinessObjects ?? null,
          notesApp: listing.notesApp ?? null,
        }
      : null,
    scopeNotesApp: scopeLink
      ? {
          projectId: scopeLink.projectId ?? null,
          projectName: scopeLink.projectName ?? null,
          lastSyncAt: scopeLink.lastSyncAt ?? null,
          lastSyncStatus: scopeLink.lastSyncStatus ?? null,
          listingsMappingEntry: listingsMappingEntry ?? null,
        }
      : null,
    rels: rels ?? [],
    linkedAnnotations: (annotations ?? []).map((a) => ({
      id: a.id,
      idMaster: a.idMaster ?? null,
      type: a.type ?? null,
      baseMapId: a.baseMapId ?? null,
      annotationTemplateId: a.annotationTemplateId ?? null,
      label: a.label ?? null,
      remoteUpdatedAt: a.remoteUpdatedAt ?? null,
      updatedAt: a.updatedAt ?? null,
      deletedAt: a.deletedAt ?? null,
    })),
  };
}
