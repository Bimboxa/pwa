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

  async postFile(path, file) {
    const clientModifiedAt = getDateString(file.lastModified);
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
    // files = [{path,blob}]
    await Promise.all(
      files.map(async (file) => {
        const {path, blob} = file;
        await this.postFile(path, blob);
      })
    );
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
    const metadatas = await getFilesMetadataDropboxService({
      path,
      accessToken: this.accessToken,
    });
    return metadatas.map(dropboxToGenericMetadata);
  }

  async fetchFilesMetadataFromParentFolder(path) {
    const metadatas = await getFilesMetadataFromParentFolderDropboxService({
      path,
      accessToken: this.accessToken,
    });
    return metadatas.map(dropboxToGenericMetadata);
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
