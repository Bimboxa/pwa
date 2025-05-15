import createDropboxFileService from "../services/createDropboxFileService";
import downloadZipFolderDropboxService from "../services/downloadZipFolderDropboxService";
import getFilesMetadataDropboxService from "../services/getFilesMetadataDropboxService";
import getItemMetadataDropboxService from "../services/getItemMetadataDropboxService";
import fetchFileDropboxService from "../services/fetchFileDropboxService";
import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import dropboxToGenericMetadata from "../utils/dropboxToGenericMetadata";

import getDateString from "Features/misc/utils/getDateString";
import getFilesMetadataFromParentFolderDropboxService from "../services/getFilesMetadataFromParentFolderDropboxService";

export default class DropboxRemote {
  constructor({accessToken}) {
    this.accessToken = accessToken;
  }

  // POST FILE

  async postFile(path, file, updatedAt) {
    const clientModifiedAt = updatedAt ?? getDateString(file.lastModified);
    return await createDropboxFileService({
      path,
      blob: file,
      accessToken: this.accessToken,
      mode: "overwrite",
      clientModifiedAt,
    });
  }

  // POST FILES

  async postFiles(files) {
    // files = [{path,blob,updatedAt}]
    for (const file of files) {
      const {path, blob, updatedAt} = file;
      await this.postFile(path, blob, updatedAt);
    }
  }

  // FETCH FILE METADATA

  async fetchFileMetadata(path) {
    try {
      const metadata = await getItemMetadataDropboxService({
        path,
        accessToken: this.accessToken,
      });
      return dropboxToGenericMetadata(metadata);
    } catch (err) {
      console.log("error fetching file metadata", err);
      return null;
    }
  }

  // FETCH FILES METADATA

  async fetchFilesMetadataFromFolder(path) {
    try {
      const metadatas = await getFilesMetadataDropboxService({
        path,
        accessToken: this.accessToken,
      });
      return metadatas?.map(dropboxToGenericMetadata);
    } catch (e) {
      console.log("error fetching files metadata", path, e);
      return null;
    }
  }

  async fetchFilesMetadataFromParentFolder(path) {
    const metadatas = await getFilesMetadataFromParentFolderDropboxService({
      path,
      accessToken: this.accessToken,
    });
    return metadatas?.map(dropboxToGenericMetadata);
  }

  // DOWNLOAD FILE

  async downloadFile(path) {
    const blob = await fetchFileDropboxService({
      path,
      accessToken: this.accessToken,
    });
    return blob;
  }

  // DOWNLOAD FILES FROM FOLDER

  async downloadFilesFromFolder(path) {
    const zip = downloadZipFolderDropboxService({
      path,
      accessToken: this.accessToken,
    });
    const files = await unzipFilesAsync(zip);
    return files;
  }
}
