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
  return blob;
}
