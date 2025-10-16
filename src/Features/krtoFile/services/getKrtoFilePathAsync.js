import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";

import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";

export default async function getKrtoFilePathAsync({ orgaCode, projectId }) {
  const project = await db.projects.get(projectId);
  const name = sanitizeName(project?.name ?? "projet");

  const path = `/krtos/${orgaCode}/${projectId}/${name}.zip`;

  const encodedPath = encodeURIComponent(path);

  // Option 2: Base64 encoding (alternative - more compact but less readable)
  // const encodedPath = btoa(path);

  return { path, encodedPath };
}
