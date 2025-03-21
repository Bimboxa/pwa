export default async function fetchFoldersService({path, token}) {
  const dropboxApiUrl = "https://api.dropboxapi.com/2/files/list_folder";

  try {
    const response = await fetch(dropboxApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
        include_mounted_folders: true,
        include_non_downloadable_files: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response?.json();

    const folders = data.entries.filter((entry) => entry[".tag"] === "folder");

    return folders;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}
