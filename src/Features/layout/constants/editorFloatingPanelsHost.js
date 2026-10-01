// DOM host of the editors' floating panels (PopperMapListings,
// PopperBaseMapsList and the helpers that replace them), rendered by
// LayoutDesktop and filled through PortalEditorFloatingPanels.
//
// Stacking order of the desktop layout (root stacking context = the fixed
// root box of MainAppLayout):
//   editors (PanelShowable) 0 < planning panel / base maps grid 5
//   < top bar 10 < FLOATING PANELS 15 < hover left drawer 20
//   < POV / capture bars 30 < PDF editor 40 < right drawer 200
//   < right tools band 300 < bottom bar 400 < create-baseMap overlay 1000.
// The floating panels can thus be dragged over the top bar, and stay under
// the left / right panels sliding over the editors and under the PDF editor.
export const EDITOR_FLOATING_PANELS_HOST_ID = "editor-floating-panels-host";
export const EDITOR_FLOATING_PANELS_Z_INDEX = 15;
export const TOP_BAR_Z_INDEX = 10;
