// Drawing mode armed by the « Changer de style » toolbar button
// (mapEditor.enabledDrawingMode): clicks build the selection, the drawing
// helper (SectionChangeStyleHelper) shows it and applies a template to it.
// Kept in its own module (no import) so the editors / helper selectors can
// read it without pulling the command's React button.
export const CHANGE_STYLE_MODE = "CHANGE_STYLE";
