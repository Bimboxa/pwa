export default function dropboxToGenericMetadata(metadata) {
  return {
    id: metadata?.id,
    name: metadata?.name,
    size: metadata?.size,
    lastModifiedAt: metadata?.client_modified,
    isFile: metadata?.[".tag"] === "file",
    path: metadata?.path_display,
  };
}
