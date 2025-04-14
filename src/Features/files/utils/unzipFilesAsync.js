import JSZip from "jszip";

export default async function unzipFilesAsync(zipBlob) {
  // edge case
  if (!zipBlob) {
    return null;
  }

  // main
  const zip = await JSZip.loadAsync(zipBlob);

  const files = await Promise.all(
    Object.values(zip.files)
      .filter((file) => !file.dir)
      .map(async (file) => {
        const blob = await file.async("blob");
        const fileName = file.name.split("/").pop();
        //const type = blob.type || "application/octet-stream";
        return new File([blob], fileName);
      })
  );

  return files;
}
