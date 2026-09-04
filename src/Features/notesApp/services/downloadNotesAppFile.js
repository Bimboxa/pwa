import { getNotesAppClient } from "./notesAppClient";

// The notes-app Storage bucket is private: get a short-lived signed URL,
// then fetch the bytes. The first path segment of storagePath must be the
// notes-app project id (Storage RLS).
export default async function downloadNotesAppFile({
  storagePath,
  fileName,
  mimeType,
}) {
  const client = getNotesAppClient();
  const { data, error } = await client.storage
    .from("project-files")
    .createSignedUrl(storagePath, 60);
  if (error) throw error;

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${storagePath}`);
  }
  const blob = await response.blob();
  const type = mimeType || blob.type || "application/octet-stream";
  return new File([blob], fileName, { type });
}
