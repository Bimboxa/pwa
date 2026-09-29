// "5.1.3. Dépose membrane" — display label of a business object with its
// code when it has one.
export default function getBusinessObjectCodeLabel(businessObject) {
  if (!businessObject) return "";
  const label = businessObject.label ?? "";
  const code = businessObject.code?.trim();
  return code ? `${code} ${label}`.trim() : label;
}
