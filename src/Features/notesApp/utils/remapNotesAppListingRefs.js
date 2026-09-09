// Listing references inside a Krnet settings object hold LOCAL Bimboxa
// listing ids in Dexie and Krnet listing ids on Supabase. The same remap
// runs in both directions with the matching id map; an id absent from the
// map passes through unchanged (dangling ref, or ref to a Krnet list the
// user chose to ignore — kept intact so it round-trips). Pure, returns new
// objects, never mutates the input.

function lookup(idMap, id) {
  if (id == null) return id;
  const mapped =
    idMap instanceof Map ? idMap.get(id) : idMap ? idMap[id] : undefined;
  return mapped ?? id;
}

export default function remapNotesAppListingRefs(settings, idMap) {
  if (!settings || typeof settings !== "object") return settings ?? {};
  const next = { ...settings };
  if (Array.isArray(settings.fields)) {
    next.fields = settings.fields.map((f) => {
      if (!f || typeof f !== "object") return f;
      const out = { ...f };
      if (f.nomenclatureListingId != null) {
        out.nomenclatureListingId = lookup(idMap, f.nomenclatureListingId);
      }
      if (f.targetListingId != null) {
        out.targetListingId = lookup(idMap, f.targetListingId);
      }
      if (Array.isArray(f.sourceListingIds)) {
        out.sourceListingIds = f.sourceListingIds.map((id) =>
          lookup(idMap, id)
        );
      }
      return out;
    });
  }
  if (Array.isArray(settings.classifications)) {
    next.classifications = settings.classifications.map((c) =>
      c && typeof c === "object" && c.nomenclatureListingId != null
        ? {
            ...c,
            nomenclatureListingId: lookup(idMap, c.nomenclatureListingId),
          }
        : c
    );
  }
  if (settings.autoCode && typeof settings.autoCode === "object") {
    next.autoCode = { ...settings.autoCode };
    if (settings.autoCode.nomenclatureListingId != null) {
      next.autoCode.nomenclatureListingId = lookup(
        idMap,
        settings.autoCode.nomenclatureListingId
      );
    }
  }
  return next;
}

// Scope duplication: state models are Supabase rows with a global primary
// key, so a copied listing needs fresh ids (and the `state` fields must
// follow). idMap: oldStateModelId -> newStateModelId.
export function remapNotesAppStateModelIds(notesApp, idMap) {
  if (!notesApp || typeof notesApp !== "object") return notesApp;
  const next = { ...notesApp };
  if (Array.isArray(notesApp.stateModels)) {
    next.stateModels = notesApp.stateModels.map((sm) =>
      sm && typeof sm === "object" ? { ...sm, id: lookup(idMap, sm.id) } : sm
    );
  }
  const settings = notesApp.settings;
  if (settings && Array.isArray(settings.fields)) {
    next.settings = {
      ...settings,
      fields: settings.fields.map((f) =>
        f && typeof f === "object" && f.stateModelId != null
          ? { ...f, stateModelId: lookup(idMap, f.stateModelId) }
          : f
      ),
    };
  }
  return next;
}
