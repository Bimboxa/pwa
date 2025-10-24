export default function getTemplateFields(template, options) {
  const fields = template?.fields ?? [];

  return fields.filter((field) => !field.hidden);
}
