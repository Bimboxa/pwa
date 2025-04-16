import DropboxRemote from "Features/dropbox/js/DropboxRemote";

export default class RemoteProvider {
  constructor({accessToken, provider}) {
    switch (provider) {
      case "DROPBOX":
        this.provider = new DropboxRemote({accessToken});
        break;
      default:
        throw new Error("Unsupported provider");
    }
  }

  // POST

  async postFile(path, blob) {
    return await this.provider.postFile(path, blob);
  }

  async postFiles(files) {
    return await this.provider.postFiles(files);
  }

  // FETCH  METADATA

  async fetchFileMetadata(path) {
    return await this.provider.fetchFileMetadata(path);
  }

  async fetchFilesMetadataFromFolder(path) {
    return await this.provider.fetchFileMetadata(path);
  }

  // DOWNLOAD

  async downloadFile(path) {
    return await this.provider.downloadFile(path);
  }

  async downloadFilesFromFolder(path) {
    return await this.provider.downloadFilesFromFolder(path);
  }
}
