import createFoldersDropboxService from "./createFoldersDropboxService";

export default async function initListingFolderDropboxService({
  accessToken,
  name,
  parentPath,
}) {
  const rootPath = parentPath + "/" + name;
  const imagesPath = rootPath + "/images";

  const pathList = [rootPath, imagesPath];

  return await createFoldersDropboxService({accessToken, pathList});
}
