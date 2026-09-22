// Capture the PDF render's placement, not the currently displayed enhanced
// version. Annotations always belong to the base map's reference frame.
export function describeAiTaskSource(baseMap) {
  const cf = baseMap?.createdFrom;
  if (!baseMap?.id) throw new Error("Sélectionnez un fond de plan.");
  if (cf?.type !== "PDF_PAGE")
    throw new Error("Ce fond de plan ne provient pas d’un PDF.");
  if (!cf.resourceId && !cf.relay?.sourcePdfId)
    throw new Error("Le PDF source n’est pas disponible.");
  const versions = (baseMap.versions ?? []).filter((v) => !v.deletedAt);
  const source =
    versions.find((v) => v.id === cf.versionId) ??
    (!cf.versionId
      ? versions.find((v) => v.image?.fileName === baseMap.image?.fileName)
      : null);
  if (versions.length && !source)
    throw new Error("La version issue du PDF est introuvable.");
  const sourceImageSize = source?.image?.imageSize ?? baseMap.image?.imageSize;
  if (!sourceImageSize?.width || !sourceImageSize?.height)
    throw new Error("Les dimensions du rendu PDF sont inconnues.");
  const rotation = Number(cf.rotation ?? 0);
  if (![0, 90, 180, 270].includes(rotation))
    throw new Error("La rotation du PDF n’est pas prise en charge.");
  return {
    fileName: cf.pdfFileName || "plan.pdf",
    frame: {
      pageNumber: Number(cf.pageNumber ?? 1),
      rotation,
      bboxInRatio: cf.bboxInRatio ?? { x1: 0, y1: 0, x2: 1, y2: 1 },
      dpi: cf.dpi ? Math.round(Number(cf.dpi)) : null,
      blueprintScale: cf.blueprintScale ? String(cf.blueprintScale) : null,
    },
    sourceImageSize,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, ...source?.transform },
  };
}

// A changed crop/version during analysis must never receive stale geometry.
export function assertAiTaskTarget(baseMap, payload) {
  if (!payload?.aiTaskTarget) return;
  const current = describeAiTaskSource(baseMap);
  const expected = payload.aiTaskTarget;
  const size = baseMap.getImageSize();
  const matches = (a, b) =>
    Object.keys(b).every((key) =>
      b[key] && typeof b[key] === "object"
        ? matches(a?.[key] ?? {}, b[key])
        : a?.[key] === b[key]
    );
  if (
    size.width !== payload.image.width ||
    size.height !== payload.image.height ||
    !matches(current, expected)
  ) {
    throw new Error(
      "Le référentiel du fond a changé pendant l’analyse. Relancez GO auto sur le fond actuel."
    );
  }
}
