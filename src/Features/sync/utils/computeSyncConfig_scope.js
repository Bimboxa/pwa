import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";
import computeSyncFileGetItemsRules from "./computeSyncFileGetItemsRules";

export default function computeSyncConfig_scope({direction}) {
  const templates = computeSyncFilePathTemplates({syncFileType: "SCOPE"});
  const rules = computeSyncFileGetItemsRules({syncFileType: "SCOPE"});
  return {
    scope: {
      priority: 2,
      syncFile: {
        key: "SCOPE",
        description: "Scope data",
        ...templates,
        localData: {
          table: "scopes",
          ...rules,
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
