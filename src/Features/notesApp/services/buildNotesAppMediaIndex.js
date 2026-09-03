import { getNotesAppClient } from "./notesAppClient";

// notes-app media files live in the private Storage bucket at
// {projectId}/photos/{noteId}.{ext} and {projectId}/audio/{noteId}.{ext},
// with the extension unknown from the note row (its `content` is a device
// URI). One folder listing per media type per sync resolves noteId -> path.

function getMimeType(ext) {
  const e = (ext ?? "").toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "m4a") return "audio/mp4";
  if (e === "mp3") return "audio/mpeg";
  if (e === "aac") return "audio/aac";
  return "application/octet-stream";
}

async function listFolder(client, folder) {
  const { data, error } = await client.storage
    .from("project-files")
    .list(folder, { limit: 1000 });
  if (error) {
    console.log(`[notesApp] storage list failed for ${folder}`, error);
    return [];
  }
  return data ?? [];
}

export default async function buildNotesAppMediaIndex(projectId) {
  const client = getNotesAppClient();

  const index = new Map(); // noteId -> { storagePath, fileName, mimeType }

  for (const kind of ["photos", "audio"]) {
    const folder = `${projectId}/${kind}`;
    const files = await listFolder(client, folder);
    for (const file of files) {
      const name = file?.name;
      if (!name || !name.includes(".")) continue;
      const noteId = name.slice(0, name.lastIndexOf("."));
      const ext = name.slice(name.lastIndexOf(".") + 1);
      index.set(noteId, {
        storagePath: `${folder}/${name}`,
        fileName: `notesAppNote_${name}`,
        mimeType: getMimeType(ext),
      });
    }
  }

  return index;
}
