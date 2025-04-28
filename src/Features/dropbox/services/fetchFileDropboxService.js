export default async function fetchFileDropboxService({accessToken, path}) {
  const url = "https://content.dropboxapi.com/2/files/download";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Dropbox-API-Arg": JSON.stringify({path}),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Dropbox API error: ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob(); // or .arrayBuffer(), .text(), etc. depending on your needs

  // Extract filename from Dropbox headers
  const metadataHeader = response.headers.get("dropbox-api-result");
  const metadata = metadataHeader ? JSON.parse(metadataHeader) : {};
  const fileName = metadata.name || "downloaded_file";

  // Create a File from Blob
  const file = new File([blob], fileName, {
    type: blob.type || "application/octet-stream",
  });

  console.log("[FETCH] dropbox file:", file);
  return file;
}
