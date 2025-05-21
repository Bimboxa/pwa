import getUserAccountDropboxService from "../services/getUserAccountDropboxService";

import createDropboxFileService from "../services/createDropboxFileService";
import downloadZipFolderDropboxService from "../services/downloadZipFolderDropboxService";
import getFilesMetadataDropboxService from "../services/getFilesMetadataDropboxService";
import getItemMetadataDropboxService from "../services/getItemMetadataDropboxService";
import fetchFileDropboxService from "../services/fetchFileDropboxService";

import dropboxServices from "../services/dropboxServices";

import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import dropboxToGenericMetadata from "../utils/dropboxToGenericMetadata";

import getDateString from "Features/misc/utils/getDateString";
import getFilesMetadataFromParentFolderDropboxService from "../services/getFilesMetadataFromParentFolderDropboxService";
import fetchDropboxSharedFileMetadataService from "../services/fetchDropboxSharedFileMetadataService";
import listFolderItemsDropboxService from "../services/listFolderItemsDropboxService";

export default class DropboxRemote {
  constructor({accessToken, userAccount, options}) {
    this.accessToken = accessToken;
    this.options = options;
    this.userAccount = userAccount;
  }

  // USER

  async getUserAccount() {
    const account = await getUserAccountDropboxService({
      accessToken: this.accessToken,
    });
    return account;
  }

  // SEARCH

  async searchFile({fileName}) {
    return await dropboxServices.searchFile({
      fileName,
      namespaceId: this.userAccount?.namespaceId,
      accessToken: this.accessToken,
    });
  }

  // POST FILE

  async postFile({path, file, updatedAt}) {
    const clientModifiedAt =
      getDateString(updatedAt) ?? getDateString(file.lastModified);
    console.log("[DROPBOX] postFile", file, clientModifiedAt);
    return await dropboxServices.postFile({
      path,
      file,
      accessToken: this.accessToken,
      namespaceId: this.namespaceId,
      clientModifiedAt,
    });
  }

  // POST FILES

  async postFiles(files) {
    // files = [{path,blob,updatedAt}]
    for (const file of files) {
      const {path, blob, updatedAt} = file;
      await this.postFile({path, file: blob, updatedAt});
    }
  }

  // FETCH FILE METADATA

  async fetchItemMetadata(path) {
    return await dropboxServices.fetchItemMetadata({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
  }

  async fetchFileMetadata(path) {
    return await dropboxServices.fetchItemMetadata({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
  }

  async fetchSharedFileMetadata(link) {
    return fetchDropboxSharedFileMetadataService({
      accessToken: this.accessToken,
      link,
    });
  }

  // FETCH FILES METADATA

  async fetchFilesMetadataFromFolder(path) {
    try {
      const metadatas = await dropboxServices.fetchFilesMetadataFromFolder({
        path,
        accessToken: this.accessToken,
        namespaceId: this.userAccount?.namespaceId,
      });
      return metadatas;
    } catch (e) {
      console.log("error fetching files metadata", path, e);
      return null;
    }
  }

  async fetchFilesMetadataFromParentFolder(path) {
    const targetFolders = await dropboxServices.fetchFoldersMetadataFromFolder({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
    const targetFiles = [];

    for (const targetFolder of targetFolders) {
      const folderPath = targetFolder.path;
      const filesResult = await dropboxServices.fetchFilesMetadataFromFolder({
        path: folderPath,
        accessToken: this.accessToken,
        namespaceId: this.userAccount?.namespaceId,
      });
      filesResult.forEach((entry) => targetFiles.push(entry));
    }
    return targetFiles;
  }

  // LIST

  async listFolderItems(path) {
    return await listFolderItemsDropboxService({
      accessToken: this.accessToken,
      options: this.options,
      path,
    });
  }

  // DOWNLOAD FILE

  async downloadFile(path) {
    const file = await dropboxServices.downloadFile({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
    return file;
  }

  async downloadZipFolder(path) {
    const zip = await dropboxServices.downloadZipFolder({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
    return zip;
  }

  // DOWNLOAD FILES FROM FOLDER

  async downloadFilesFromFolder(path) {
    const zip = await dropboxServices.downloadZipFolder({
      path,
      accessToken: this.accessToken,
      namespaceId: this.userAccount?.namespaceId,
    });
    const files = await unzipFilesAsync(zip);
    return files;
  }

  // DELETE
  async deleteItem(path) {
    await deleteDropboxItemService({accessToken: this.accessToken, path});
  }
}
