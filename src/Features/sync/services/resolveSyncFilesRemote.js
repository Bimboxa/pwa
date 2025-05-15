/*
 * output : [{filePath,updatedAtRemote}]
 */

import {
  resolveFilePath,
  resolveFolderPath,
  resolveFoldersPaths,
} from "../utils/resolversPath";

import resolveComputedContext from "../utils/resolveComputedContext";
import resolveIteration from "../utils/resolveIteration";
import getParentPath from "Features/misc/utils/getParentPath";
import resolveFilterFilesById from "../utils/resolveFilterFilesById";
import getFilteredFilesById from "../utils/getFilteredFilesById";

export default async function resolveSyncFilesRemote(
  config,
  context,
  remoteProvider
) {
  console.log("[resolveSyncFilesRemote]", config);

  try {
    // edge case
    if (!config || !context || !remoteProvider) return [];

    // helpers

    const fileTemplate = config.syncFile.remoteFile;
    const folderTemplate = config.syncFile.remoteFolder;
    const table = config.syncFile.localData.table;

    const computedContext = config.computedContext;

    const metadataFetchBy = config.remoteMetadata.fetchBy;
    const itemFromContext = config.remoteMetadata.itemFromContext;
    const iterationToResolve = config.remoteMetadata.iteration;
    const filterFilesByIdToResolve = config.remoteMetadata.filterFilesById;

    const fetchBy = config.remoteToLocal.fetchBy;
    const pathToItemTemplate = config.remoteToLocal.pathToItemTemplate;
    const itemPathSeparator = config.remoteToLocal.itemPathSeparator;

    // helper - syncFileConfig (used to compute file and upload it)

    const syncFileConfig = config.syncFile;

    // helper - context

    const computedContextResolved = resolveComputedContext(
      computedContext,
      context
    );
    context = {...context, ...computedContextResolved};

    // helper - iteration
    let iteration = null;
    if (iterationToResolve)
      iteration = resolveIteration(iterationToResolve, context);

    // helper - filterFilesById
    let filterFilesById;
    if (filterFilesByIdToResolve)
      filterFilesById = resolveFilterFilesById(
        filterFilesByIdToResolve,
        context
      );

    //main
    switch (metadataFetchBy) {
      case "FILE": {
        if (itemFromContext) {
          const item = context[itemFromContext];
          const filePath = resolveFilePath({
            folderTemplate,
            fileTemplate,
            context,
            item,
          });
          const fileMetadata = await remoteProvider.fetchFileMetadata(filePath);
          const updatedAtRemote = fileMetadata.lastModifiedAt;
          //
          return [
            {filePath, updatedAtRemote, fetchBy, table, config: syncFileConfig},
          ];
        } else {
          return null;
        }
      }

      case "SINGLE_FOLDER": {
        const folderPath = resolveFolderPath({folderTemplate, context});
        const filesMetada = await remoteProvider.fetchFilesMetadataFromFolder(
          folderPath
        );
        let _filesMetada = filesMetada.map((metadata) => ({
          filePath: metadata.path,
          name: metadata.path.split("/").pop(),
          updatedAtRemote: metadata.lastModifiedAt,
          fetchBy,
          table,
          config: syncFileConfig,
        }));

        if (filterFilesByIdToResolve) {
          _filesMetada = getFilteredFilesById(_filesMetada, filterFilesById);
        }
        return _filesMetada;
      }

      case "ITERATION_FOLDER": {
        const folders = resolveFoldersPaths({
          folderTemplate,
          context,
          iteration,
        });
        const syncFiles = [];
        for (const folder of folders) {
          const filesMetadata =
            await remoteProvider.fetchFilesMetadataFromFolder(folder);
          if (Array.isArray(filesMetadata)) {
            filesMetadata.forEach((metadata) => {
              syncFiles.push({
                filePath: metadata.path,
                updatedAtRemote: metadata.lastModifiedAt,
                fetchBy,
                table,
                pathToItemTemplate,
                config: syncFileConfig,
              });
            });
          }
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

        if (!Array.isArray(parentFolders)) return syncFiles;

        for (const parentFolder of parentFolders) {
          const filesMetadata =
            await remoteProvider.fetchFilesMetadataFromParentFolder(
              parentFolder
            );

          if (Array.isArray(filesMetadata)) {
            filesMetadata.forEach((metadata) => {
              const filePath = metadata.path;
              const itemPath = itemPathSeparator
                ? filePath.split(itemPathSeparator).pop()
                : null;

              syncFiles.push({
                filePath,
                updatedAtRemote: metadata.lastModifiedAt,
                fetchBy,
                table,
                pathToItemTemplate,
                itemPath,
                config: syncFileConfig,
              });
            });
          }
        }
        return syncFiles;
      }
    }
  } catch (e) {
    console.error("[resolveSyncFilesRemote]", config, context, e);
  }
}
