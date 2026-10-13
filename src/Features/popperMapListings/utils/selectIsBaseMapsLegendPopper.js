// BaseMaps module: the PopperMapListings panel is always a read-only LEGEND
// (same behavior as in the Viewer module — only what is drawn on the
// displayed base maps, no drawing entry), in the 2D and 3D editors alike.
export default function selectIsBaseMapsLegendPopper(state) {
  return state.viewers.selectedViewerKey === "BASE_MAPS";
}
