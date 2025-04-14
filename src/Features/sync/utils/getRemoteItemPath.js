export default function getRemoteItemPath({
  type,
  remoteContainer,
  item,
  options,
}) {
  // edge case

  if (!remoteContainer || !item) {
    return null;
  }

  // main
  let path = remoteContainer.path;
  if (type === "PROJECT") {
    path =
      remoteContainer.projectsPath +
      "/" +
      item.clientRef +
      "/_data/project.json";
  } else if (type === "SCOPE") {
    const remoteProjectContainerPath = options?.remoteProjectContainerPath;
    path = `${remoteProjectContainerPath}/_data/scope_${item.id}.json`;
  }

  // return

  return path;
}
