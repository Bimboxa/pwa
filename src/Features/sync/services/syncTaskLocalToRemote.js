import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";

export default async function syncTaskLocalToRemote({task, remoteProvider}) {
  // edge case

  if (!task) return null;

  // helpers

  const filePath = task.filePath;
  const fileName = filePath.split("/").pop();
  const entry = task.entry;
  const entries = task.entries;

  // helper - mode

  let mode = "DEFAULT";
  if (entry) mode = "DATA";
  if (entries) mode = "ITEMS";

  // main

  switch (mode) {
    case "DATA": {
      const file = jsonObjectToFile({data: entry}, fileName);
      await remoteProvider.postFile(filePath, file);
      return file;
    }

    case "ITEMS": {
      const file = jsonObjectToFile({items: entries}, fileName);
      await remoteProvider.postFile(filePath, file);
      return file;
    }

    default: {
      console.error("[syncTaskLocalToRemote] Error: mode not supported");
      return null;
    }
  }
}
