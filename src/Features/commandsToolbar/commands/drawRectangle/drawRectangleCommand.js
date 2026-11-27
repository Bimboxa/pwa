import createTemplatelessDrawCommand from "../../utils/createTemplatelessDrawCommand";

// « Dessiner — RECTANGLE » (templateless draft, hotkey D when last used): a
// rigid rectangle (bbox + rotation) drawn with the 2-click rectangle tool.
export default createTemplatelessDrawCommand("RECTANGLE", {
  usesSelection: false,
});
