// Live session of the « + fond de plan » placement (see
// sectionBaseMapPlacementSlice): the two in-plane offsets the drag edits and
// the placement last previewed. Module store, not redux: written on every
// pointermove, read by the Space commit (same pattern as
// moveBaseMapSessionStore).
let offsets = { alongM: 0, upM: 0 };
let placement = null;

export function getSectionBaseMapOffsets() {
  return offsets;
}

export function setSectionBaseMapOffsets(next) {
  offsets = {
    alongM: Number.isFinite(next?.alongM) ? next.alongM : 0,
    upM: Number.isFinite(next?.upM) ? next.upM : 0,
  };
}

// { angleDeg, position, cloneNorm, widthM, heightM, axisU, size, meterByPx }
export function getSectionBaseMapPlacement() {
  return placement;
}

export function setSectionBaseMapPlacement(next) {
  placement = next ?? null;
}

export function resetSectionBaseMapSession() {
  offsets = { alongM: 0, upM: 0 };
  placement = null;
}
