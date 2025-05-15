import computeSyncFilePathTemplates from "./computeSyncFilePathTemplates";

/*
 * syncScope : {project,scope,listings}
 * used to group listings by table.
 */
export default function computeSyncConfig_project({direction}) {
  const templates = computeSyncFilePathTemplates({syncFileType: "PROJECT"});
  return {
    project: {
      priority: 1,
      syncFile: {
        key: "PROJECT",
        description: "Project data",
        localData: {
          table: "projects",
          getItemFromKey: "clientRef",
        },
        ...templates,
      },
      direction,
      remoteMetadata: {
        fetchBy: "FILE",
        itemFromContext: "project",
      },
      remoteToLocal: {
        fetchBy: "FILE",
        itemFromContext: "project",
      },
      localToRemote: {
        writeMode: "TABLE_ENTRY_TO_DATA",
        mode: "SINGLE_FILE",
        entry: "project",
      },
    },
  };
}
