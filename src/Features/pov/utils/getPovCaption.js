// Shared POV byline: "TRI — 16/07/2026" (trigram and/or creation date).
export default function getPovCaption(pov) {
  const createdDate = pov?.createdAt
    ? new Date(pov.createdAt).toLocaleDateString("fr-FR")
    : null;
  return [pov?.createdBy?.trigram, createdDate].filter(Boolean).join(" — ");
}

export function getPovModeLabel(pov) {
  return pov?.viewerMode === "THREED" ? "3D" : "2D";
}
