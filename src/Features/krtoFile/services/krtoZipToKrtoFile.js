import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";

export default async function krtoZipToKrtoFile(zipBlob) {
  // Unzip the files
  const files = await unzipFilesAsync(zipBlob);

  // Find the KRTO file (should have .krto extension)
  const krtoFile = files.find((file) => file.name.endsWith(".krto"));

  if (!krtoFile) {
    throw new Error("No .krto file found in the zip archive");
  }

  return krtoFile;
}
