export default async function createDropboxFileService({
  path,
  blob,
  accessToken,
  mode = "overwrite", // "add" or "overwrite"
}) {
  const url = "https://content.dropboxapi.com/2/files/upload";

  // debug
  console.log("[debug] createDropboxFileService ...", path, blob);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path,
          mode, // ou 'add'/'overwrite' si tu veux remplacer le fichier s'il existe
          autorename: true,
        }),
        "Content-Type": "application/octet-stream",
      },
      body: blob, // Doit être un Blob, un Buffer, ou une chaîne binaire
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console;
    return data;
  } catch (error) {
    console.error("Error when creating dropbox file :", error);
    throw error;
  }
}
