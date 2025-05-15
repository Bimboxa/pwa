import updateTableWithFileAsync from "../utils/updateTableWithFileAsync";
import getFilteredFilesById from "../utils/getFilteredFilesById";

export default async function syncTaskRemoteToLocal({task, remoteProvider}) {
  // edge case

  if (!task) return null;

  // helpers

  const fetchBy = task.fetchBy;
  const filePath = task.filePath;
  const folderPath = task.folderPath;
  const table = task.table;
  const filterFilesById = task.filterFilesById;
  const pathToItemTemplate = task.pathToItemTemplate;
  const itemPath = task.itemPath;
  const fileType = task.config.fileType;
  const updatedAt = task.updatedAtRemote;

  // main

  switch (fetchBy) {
    case "FILE": {
      const file = await remoteProvider.downloadFile(filePath);
      await updateTableWithFileAsync({
        table,
        file,
        filePath,
        pathToItemTemplate,
        itemPath,
        fileType,
        updatedAt,
      });
      break;
    }

    case "FOLDER": {
      let files = await remoteProvider.downloadFilesFromFolder(folderPath);
      if (filterFilesById) {
        files = getFilteredFilesById(files, filterFilesById);
      }

      await Promise.all(
        files.map(async (file) => {
          await updateTableWithFileAsync((table, file));
        })
      );

      break;
    }
  }
}
