// Resource scope ("périmètre"): "GLOBAL" | "PROJECT" | "SCOPE". Legacy rows
// (created before the field existed) were project-wide → PROJECT.
export const RESOURCE_VISIBILITIES = ["SCOPE", "PROJECT", "GLOBAL"];

export default function getResourceVisibility(resource) {
  const v = resource?.visibility;
  if (v === "GLOBAL" || v === "SCOPE") return v;
  return "PROJECT";
}
