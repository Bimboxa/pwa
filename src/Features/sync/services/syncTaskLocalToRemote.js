import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";

export default async function syncTaskLocalToRemote({task, remoteProvider}) {
  // edge case

  if (!task) return null;

  // helpers

  const filePath = task.filePath;
  const fileName = filePath.split("/").pop();
  const entry = task.entry;
  const entries = task.entries;
  const writeMode = task.writeMode;
  const updatedAt = task.updatedAtLocal;

  // helper - mode

  let mode = "DEFAULT";
  if (entry && writeMode !== "TABLE_ENTRY_TO_FILE") mode = "DATA";
  if (entry && writeMode === "TABLE_ENTRY_TO_FILE") mode = "FILE";
  if (entries) mode = "ITEMS";

  // main

  switch (mode) {
    case "DATA": {
      const file = jsonObjectToFile({data: entry}, fileName);
      await remoteProvider.postFile({path: filePath, file, updatedAt});
      return file;
    }

    case "ITEMS": {
      const file = jsonObjectToFile({items: entries}, fileName);
      await remoteProvider.postFile({path: filePath, file, updatedAt});
      return file;
    }

    case "FILE": {
      const file = entry.file;
      if (file)
        await remoteProvider.postFile({path: filePath, file, updatedAt});
      return file;
    }

    default: {
      console.error("[syncTaskLocalToRemote] Error: mode not supported");
      return null;
    }
  }
}
