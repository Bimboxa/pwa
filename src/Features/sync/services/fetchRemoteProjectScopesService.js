import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default async function fetchRemoteProjectScopesService({
  remoteProvider,
  remoteContainer,
  projectClientRef,
}) {
  // main
  console.log("[debug] remoteContainer", remoteContainer);

  if (!remoteContainer) {
    console.log("No remote container available");
    return null;
  }

  if (!projectClientRef) {
    console.log("[FETCH] no project");
    return null;
  }

  const path = remoteContainer.projectsPath + "/" + projectClientRef + "/_data";
  console.log("[debug] download path", path);
  const files = await remoteProvider.downloadFilesFromFolder(path);
  console.log("[debug] files", files);
  if (files) {
    const scopesFiles = files?.filter((file) =>
      file.name.startsWith("_scope_")
    );
    const scopes = await Promise.all(
      scopesFiles?.map(async (file) => {
        const object = await jsonFileToObjectAsync(file);
        return object.data;
      })
    );
    return scopes;
  } else {
    return null;
  }
}
