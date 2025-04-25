/*
 * output : [{filePath,updatedAtRemote}]
 */

import {
  resolveFilePath,
  resolveFolderPath,
  resolveFoldersPaths,
} from "../utils/resolversPath";

export default async function resolveSyncFilesRemote(
  config,
  context,
  remoteProvider
) {
  // edge case
  if (!config || !context || remoteProvider) return [];

  // helpers

  const fileTemplate = config.syncFile.remoteFile;
  const folderTemplate = config.syncFile.remoteFolder;

  const fetchBy = config.remoteMetadata.fetchBy;

  const itemFromContext = config.remoteMetadata.itemFromContext;
  const iteration = config.remoteMetadata.iteration;

  // helper - context

  const computedContextResolved = resolveComputedContext(
    computedContext,
    context
  );
  context = {...context, ...computedContextResolved};

  //mai
  switch (fetchBy) {
    case "FILE": {
      if (itemFromContext) {
        const item = context[itemFromContext];
        const filePath = resolveFilePath({
          folderTemplate,
          fileTemplate,
          item,
        });
        const fileMetadata = await remoteProvider.fetchFileMetadata(filePath);
        const updatedAtRemote = fileMetadata.lastModifiedAt;
        //
        return [{filePath, updatedAtRemote}];
      } else {
        return null;
      }
    }

    case "SINGLE_FOLDER": {
      const folderPath = resolveFolderPath({folderTemplate, context});
      const filesMetada = await remoteProvider.fetchFilesMetadataFromFolder(
        folderPath
      );
      return filesMetada.map((metadata) => ({
        filePath: metadata.path,
        updatedAtRemote: metadata.lastModifiedAt,
      }));
    }

    case "ITERATION_FOLDER": {
      const folders = resolveFoldersPaths({
        folderTemplate,
        context,
        iteration,
      });
      const syncFiles = [];
      for (const folder of folders) {
        const filesMetadata = await remoteProvider.fetchFilesMetadataFromFolder(
          folder
        );
        filesMetadata.forEach((metadata) => {
          syncFiles.push({
            filePath: metadata.path,
            updatedAtRemote: metadata.lastModifiedAt,
          });
        });
      }
      return syncFiles;
    }

    case "ITERATION_PARENT_FOLDER": {
      const parentFolders = resolveFoldersPaths({
        folderTemplate: getParentPath(folderTemplate),
        context,
        iteration,
      });
      const syncFiles = [];
      for (const parentFolder of parentFolders) {
        const filesMetadata =
          await remoteProvider.fetchFilesMetadataFromParentFolder(parentFolder);
        filesMetadata.forEach((metadata) => {
          syncFiles.push({
            filePath: metadata.path,
            updatedAtRemote: metadata.lastModifiedAt,
          });
        });
      }
      return syncFiles;
    }
  }
}
