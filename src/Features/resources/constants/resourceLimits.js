// Largest file accepted as a resource (a whole "carnet de détails" PDF fits).
// Pure module: also read by the chat and Prompt IA attachment checks.
export const MAX_RESOURCE_FILE_BYTES = 50 * 1024 * 1024;

export function isResourceFileTooLarge(file) {
  return (file?.size ?? 0) > MAX_RESOURCE_FILE_BYTES;
}

// French, user-facing.
export function describeTooLarge(file) {
  const megabytes = Math.round(MAX_RESOURCE_FILE_BYTES / (1024 * 1024));
  const name = file?.name ? `« ${file.name} »` : "Ce fichier";
  return `${name} dépasse la limite de ${megabytes} Mo.`;
}
