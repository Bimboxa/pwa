import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";

import buildCutLinesPromptGlb from "./buildCutLinesPromptGlb";

export const CUT_LINES_PROMPT_ZIP_FILE = "prompt-lignes-de-coupe.zip";

// Zip of « Ligne de coupe – prompt IA » in GLB mode, built and downloaded:
// INSTRUCTIONS.md (the prompt), contexte.json (named planar faces, curved
// surfaces, existing cut lines) and scene.glb (every visible solid).
//
// Returns { fileName, sizeBytes, meshCount, triangleCount }, or null when
// the scene holds no solid.
export default async function buildCutLinesPromptZip({
  editor,
  instructions,
  context,
}) {
  const glb = await buildCutLinesPromptGlb({ editor });
  if (!glb) return null;

  const zip = new JSZip();
  zip.file("INSTRUCTIONS.md", instructions);
  zip.file("contexte.json", JSON.stringify(context, null, 2));
  zip.file("scene.glb", glb.blob);
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
  });
  downloadBlob(blob, CUT_LINES_PROMPT_ZIP_FILE);
  return {
    fileName: CUT_LINES_PROMPT_ZIP_FILE,
    sizeBytes: blob.size,
    meshCount: glb.meshCount,
    triangleCount: glb.triangleCount,
  };
}
