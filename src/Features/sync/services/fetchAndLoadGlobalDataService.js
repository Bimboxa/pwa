import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";

export default async function fetchAndLoadGlobalDataService({ path }) {
  const baseUrl = `https://public.media.bimboxa.com`;

  const response = await fetch(baseUrl + path);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data: ${response.status} ${response.statusText}`
    );
  }

  // Get the zip blob
  const zipBlob = await response.blob();

  // Unzip the files
  const files = await unzipFilesAsync(zipBlob);

  // Find the KRTO file (should have .krto extension)
  const krtoFile = files.find((file) => file.name.endsWith(".krto"));

  if (!krtoFile) {
    throw new Error("No .krto file found in the zip archive");
  }

  // Load the KRTO file into the database
  const project = await loadKrtoFile(krtoFile);

  console.log("loaded project data", project);
}
