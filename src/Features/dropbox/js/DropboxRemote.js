import createDropboxFileService from "../services/createDropboxFileService";
import downloadZipFolderDropboxService from "../services/downloadZipFolderDropboxService";
import getFilesMetadataDropboxService from "../services/getFilesMetadataDropboxService";
import getItemMetadataDropboxService from "../services/getItemMetadataDropboxService";
import fetchFileDropboxService from "../services/fetchFileDropboxService";
import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";

export default class DropboxRemote {
  constructor({accessToken, remoteContainer}) {
    this.accessToken = accessToken;
    this.remoteContainer = remoteContainer;
  }

  // POST FILE

  async postFile(path, blob) {
    return await createDropboxFileService({
      path,
      blob,
      accessToken: this.accessToken,
      mode: "overwrite",
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
      return metadata;
    } catch (err) {
      console.log("error fetching file metadata", err);
      return null;
    }
  }

  // FETCH FILES METADATA

  async fetchFilesMetadataFromFolder(path) {
    const metadata = await getFilesMetadataDropboxService({
      path,
      accessToken: this.accessToken,
    });
    return metadata;
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
