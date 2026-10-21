// Groups the revolution axes of an annotation list with the base maps they
// tie together: the HORIZONTAL plan hosting the REVOLUTION_AXIS and the
// VERTICAL maps hosting its REVOLUTION_AXIS_PLACEMENT clones (each placement
// poses its map so the plane contains the axis — see
// resyncRevolutionAxisPlacementsService). Pure, synchronous: works on any
// resolved list (the 3D loader's, a Dexie query...). A placement of an axis
// absent from the list still yields a family (planBaseMapId null) — the
// plan may simply not be loaded.
//
// Returns Map<axisId, { axisId, planBaseMapId, placementBaseMapIds }>; a
// base map appears once per family, deleted rows and placements without an
// axis id are ignored.
export default function getRevolutionAxisFamilies(annotations) {
  const families = new Map();
  const getFamily = (axisId) => {
    let family = families.get(axisId);
    if (!family) {
      family = { axisId, planBaseMapId: null, placementBaseMapIds: [] };
      families.set(axisId, family);
    }
    return family;
  };
  for (const a of annotations ?? []) {
    if (!a || a.deletedAt) continue;
    if (a.type === "REVOLUTION_AXIS") {
      if (!a.id) continue;
      getFamily(a.id).planBaseMapId = a.baseMapId ?? null;
    } else if (a.type === "REVOLUTION_AXIS_PLACEMENT") {
      if (!a.revolutionAxisId || !a.baseMapId) continue;
      const family = getFamily(a.revolutionAxisId);
      if (!family.placementBaseMapIds.includes(a.baseMapId)) {
        family.placementBaseMapIds.push(a.baseMapId);
      }
    }
  }
  return families;
}

// Families tied to a base map: the ones whose plan it is, and the ones it
// hosts a placement of. Each entry says which role the map plays.
export function getRevolutionAxisFamiliesOfBaseMap(annotations, baseMapId) {
  const result = [];
  if (!baseMapId) return result;
  for (const family of getRevolutionAxisFamilies(annotations).values()) {
    const isPlan = family.planBaseMapId === baseMapId;
    const isPlacement = family.placementBaseMapIds.includes(baseMapId);
    if (isPlan || isPlacement) result.push({ family, isPlan, isPlacement });
  }
  return result;
}
