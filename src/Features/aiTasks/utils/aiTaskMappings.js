export const templateType = (template) =>
  template?.type ?? template?.drawingShape;
const normalize = (value) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function suggestAiTaskMappings(rows, templates, listingId) {
  return rows.map((row) => {
    const matches = templates.filter(
      (t) =>
        t.listingId === listingId &&
        templateType(t) === row.type &&
        normalize(t.label) === normalize(row.detectionLabel)
    );
    return { ...row, templateId: matches.length === 1 ? matches[0].id : "" };
  });
}
export function mappedTemplate(row, templates) {
  return row.templateId === "new"
    ? row
    : templates.find((t) => t.id === row.templateId);
}
export function toAiTaskContract(row, template) {
  const color = template.strokeColor ?? template.fillColor;
  if (
    !row.detectionLabel?.trim() ||
    !template.label?.trim() ||
    !/^#[0-9a-f]{6}$/i.test(color)
  )
    throw new Error(
      "Renseignez le nom de l’ouvrage, le modèle et une couleur valide."
    );
  return {
    id: row.id,
    detectionLabel: row.detectionLabel.trim(),
    description: row.description?.trim() ?? "",
    label: template.label.trim(),
    type: templateType(template),
    strokeColor: color,
    ...(template.strokeWidth > 0 &&
    ["PX", "CM", "M"].includes(template.strokeWidthUnit)
      ? {
          strokeWidth: template.strokeWidth,
          strokeWidthUnit: template.strokeWidthUnit,
        }
      : {}),
    ...(row.example
      ? {
          example: {
            type: row.example.type,
            closeLine: row.example.closeLine,
            points: row.example.points,
          },
        }
      : {}),
  };
}
