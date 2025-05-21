import DropboxRemote from "Features/dropbox/js/DropboxRemote";

export default class RemoteProvider {
  constructor({accessToken, provider, userAccount, options}) {
    switch (provider) {
      case "DROPBOX":
        this.provider = new DropboxRemote({accessToken, userAccount, options});
        break;
      default:
        throw new Error("Unsupported provider");
    }
  }

  // USER

  async getUserAccount() {
    return await this.provider.getUserAccount();
  }

  // SEARCH

  async searchFile(fileName) {
    return await this.provider.searchFile({
      fileName,
    });
  }

  // POST

  async postFile({path, file, updatedAt}) {
    return await this.provider.postFile({path, file, updatedAt});
  }

  async postFiles(files) {
    return await this.provider.postFiles(files);
  }

  // FETCH  METADATA

  async fetchItemMetadata(path) {
    return await this.provider.fetchItemMetadata(path);
  }

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

  // LIST

  async listFolderItems(path) {
    return await this.provider.listFolderItems(path);
  }

  // DOWNLOAD

  async downloadFile(path) {
    return await this.provider.downloadFile(path);
  }

  async downloadFilesFromFolder(path) {
    return await this.provider.downloadFilesFromFolder(path);
  }

  async downloadZipFolder(path) {
    return await this.provider.downloadZipFolder(path);
  }

  // DELETE

  async deleteItem(path) {
    await this.provider.deleteItem(path);
  }
}
