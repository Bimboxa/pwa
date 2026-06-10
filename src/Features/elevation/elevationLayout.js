// Vertical spacing of the "vue de dessus" recap relative to the elevation,
// expressed in SCREEN pixels so it stays visually constant whatever the zoom
// level. Divide by the live map zoom (k) to convert to the editor's world/map-
// pixel space (children of the camera group are scaled by k, so `PX / k` world
// units render as `PX` screen pixels). Shared by ElevationProfileSvg and
// MeshElevationBackdrop.
export const RECAP_PAD_PX = 24; // white padding above & below the recap content
export const GAP_PX = 48; // visible gap between the recap band and the elevation
