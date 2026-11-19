import createTemplatelessDrawCommand from "../../utils/createTemplatelessDrawCommand";

// Also offered in the Maillage module's 3D editor (`meshes`).
// « Dessiner — RULER » (templateless draft, hotkey D when last used).
export default createTemplatelessDrawCommand("RULER", {
  usesSelection: false,
  meshes: true,
});
