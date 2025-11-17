import db from "App/db/db";
import sanitizeName from "Features/misc/utils/sanitizeName";
import JSZip from "jszip";

export default async function createKrtoFile(projectId, options) {
  // options

  const zip = options?.zip;
  const nameFileWithTimestamp = options?.nameFileWithTimestamp;
  const getAnnotationTemplatesFromListingId =
    options?.getAnnotationTemplatesFromListingId;
  const krtoExtension = options?.krtoExtension ?? ".krto";

  // Get project details for metadata
  const project = await db.projects.get(projectId);
  if (!project) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  const blob = await db.export({
    // prettyJson: true, // optional (bigger file, human-readable)
    filter: (table, value) => {
      if (getAnnotationTemplatesFromListingId) {
        if (table === "annotationTemplates") {
          return value.listingId === getAnnotationTemplatesFromListingId;
        } else if (table === "files") {
          return (
            value.listingId === getAnnotationTemplatesFromListingId &&
            value.listingTable === "annotationTemplates"
          );
        } else {
          return false;
        }
      } else {
        if (table === "projects") return value.id === projectId;
        // All other tables have projectId as a foreign key:
        return "projectId" in (value ?? {}) && value.projectId === projectId;
      }
    },
    // progressCallback: p => { console.log(p); return true; } // optional
  });

  // Create a readable filename from project name
  const sanitizedName = sanitizeName(project.name || "project");

  const extension = getAnnotationTemplatesFromListingId
    ? "krtol"
    : krtoExtension;

  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now
    .toTimeString()
    .split(" ")[0]
    .substring(0, 5)
    .replace(":", "h"); // HHhMM
  const timestamp = `${date}_${time}`;
  const timestamp2 = Date.now();
  const filename = nameFileWithTimestamp
    ? `${sanitizedName}_${timestamp2}.${extension}`
    : `${sanitizedName}.${extension}`;

  // Dexie export returns a JSON blob, but we want to use a more generic MIME type
  // that matches the ALLOWED_MIME set. Use 'application/octet-stream' as it's the most permissive
  let file = new File([blob], filename, { type: blob.type });

  if (zip) {
    const zipFile = new JSZip();
    zipFile.file(filename, blob);
    const zipBlob = await zipFile.generateAsync({ type: "blob" });
    // Replace .krto or .krtol with .zip
    const zipFilename = filename.replace(/\.(krto|krtol)$/, ".zip");
    file = new File([zipBlob], zipFilename, { type: "application/zip" });
  } else {
    // Use application/octet-stream for non-zipped files to match ALLOWED_MIME
    file = new File([blob], filename, { type: blob.type });
  }

  return file;
}
