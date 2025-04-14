export default async function downloadZipFolderDropboxService({
  path,
  accessToken,
}) {
  const url = "https://content.dropboxapi.com/2/files/download_zip";

  console.log("[debug] downloadZipFolder", path);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({path}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[downloadZipFolderDropboxService] error", errorText);
      return null;
    }

    const zipBlob = await response.blob();
    return zipBlob;
  } catch (error) {
    console.log("[downloadZipFolderDropboxService] error", error);
    throw error;
  }
}
