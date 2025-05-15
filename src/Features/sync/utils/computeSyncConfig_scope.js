import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

export default function computeSyncConfig_scope({direction}) {
  const templates = computeSyncFilePathTemplates({syncFileType: "SCOPE"});
  return {
    scope: {
      priority: 2,
      syncFile: {
        key: "SCOPE",
        description: "Scope data",
        ...templates,
        localData: {
          table: "scopes",
          getItemFromKey: "id",
        },
      },
      direction,
      remoteMetadata: {
        fetchBy: "FILE",
        itemFromContext: "scope",
      },
      remoteToLocal: {
        fetchBy: "FILE",
        itemFromContext: "scope",
      },
      localToRemote: {
        writeMode: "TABLE_ENTRY_TO_DATA",
        mode: "SINGLE_FILE",
        entry: "scope",
      },
    },
  };
}
