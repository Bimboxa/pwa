// DOM host of the editors' floating panels (PopperMapListings,
// PopperBaseMapsList and the helpers that replace them),
// rendered by
// LayoutDesktop and filled through PortalEditorFloatingPanels.
//
// Stacking order of the desktop layout (root stacking context = the fixed
// root box of MainAppLayout):
//   editors (PanelShowable) 0 < planning panel / base maps grid 5
//   < top bar 10 < hover left drawer 20 < POV / capture bars 30
//   < PDF editor 40 < right drawer 200 < right tools band 300
//   < FLOATING PANELS 350 < bottom bar 400 < create-baseMap overlay 1000.
// The floating panels (listings popper, edit toolbars) can thus be dragged
// over the top bar, the right panel and the right tools band; they stay
// under the bottom bar. The PDF editor is a full overlay of the editors:
// LayoutDesktop hides the host while it is open.
export const EDITOR_FLOATING_PANELS_HOST_ID = "editor-floating-panels-host";
export const EDITOR_FLOATING_PANELS_Z_INDEX = 350;
export const TOP_BAR_Z_INDEX = 10;
