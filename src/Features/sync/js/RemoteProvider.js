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

  async postFile(path, file, updatedAt) {
    return await this.provider.postFile(path, file, updatedAt);
  }

  async postFiles(files) {
    return await this.provider.postFiles(files);
  }

  // FETCH  METADATA

  async fetchFileMetadata(path) {
    return await this.provider.fetchFileMetadata(path);
  }

  async fetchFilesMetadataFromFolder(path) {
    return await this.provider.fetchFilesMetadataFromFolder(path);
  }

  async fetchFilesMetadataFromParentFolder(path) {
    return await this.provider.fetchFilesMetadataFromParentFolder(path);
  }

  async fetchSharedFileMetadata(link) {
    return await this.provider.fetchSharedFileMetadata(link);
  }

  // DOWNLOAD

  async downloadFile(path) {
    return await this.provider.downloadFile(path);
  }

  async downloadFilesFromFolder(path) {
    return await this.provider.downloadFilesFromFolder(path);
  }
}
