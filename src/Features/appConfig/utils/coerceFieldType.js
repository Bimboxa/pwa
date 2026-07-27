/**
 * Coerce une valeur vers le type déclaré dans la config (mapping ou body).
 * fieldType: "int" | "string" — tel que le champ est typé côté backend.
 * Sans fieldType (ou valeur null/undefined), la valeur est retournée telle
 * quelle. Une coercion "int" qui produirait NaN retourne la valeur d'origine.
 */
export default function coerceFieldType(value, fieldType) {
  if (!fieldType || value === undefined || value === null) return value;

  if (fieldType === "int") {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }

  if (fieldType === "string") {
    return String(value);
  }

  return value;
}
