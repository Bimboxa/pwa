export default async function listFolderItemsWithNamespaceDropboxService({
  accessToken,
  path,
  namespaceId,
}) {
  try {
    const url = "https://api.dropboxapi.com/2/files/list_folder";

    const rootPath = {
      ".tag": "namespace_id",
      namespace_id: namespaceId,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Path-Root": JSON.stringify(rootPath),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({path}),
    });

    if (!response.ok) {
      throw new Error(
        `Dropbox API error: ${response.status} ${response.statusText}`
      );
    } else {
      const result = await response.json();
      return result?.entries;
    }
  } catch (e) {
    console.log("error", e);
  }
}
