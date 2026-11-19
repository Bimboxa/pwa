import createTemplatelessDrawCommand from "../../utils/createTemplatelessDrawCommand";

// Also offered in the Maillage module's 3D editor (`meshes`).
// « Dessiner — COTE » (templateless draft, hotkey D when last used).
export default createTemplatelessDrawCommand("COTE", {
  usesSelection: false,
  meshes: true,
});
