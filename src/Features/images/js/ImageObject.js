export default class ImageObject {
  file;
  fileSize;
  imageSize;
  imageUrlClient;
  imageUrlRemote;

  constructor(imageFile) {
    this.file = imageFile;
    this.fileSize = imageFile.size;
  }

  // STATIC FACTORY

  static async create(imageFile) {
    const instance = new ImageObject(imageFile);
    await instance.initialize();
    return instance;
  }

  async initialize() {
    this.imageSize = await this.computeImageSize();
  }

  async computeImageSize() {
    const image = new window.Image();
    return new Promise((resolve, reject) => {
      image.onload = function () {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = reject;
      image.src = URL.createObjectURL(this.file);
    });
  }

  // SERIALIZER

  toJSON = () => ({
    fileSize: this.fileSize,
    imageSize: this.imageSize,
    imageUrlClient: this.imageUrlClient,
    imageUrlRemote: this.imageUrlRemote,
  });

  // DB EXCHANGE

  toJSON() {
    return {
      file: this.file,
      fileSize: this.fileSize,
      imageSize: this.imageSize,
    };
  }
  // REDUX EXCHANGE

  toRedux() {
    return {
      fileSize: this.fileSize,
      imageSize: this.imageSize,
      imageUrlClient: this.imageUrlClient,
      imageUrlRemote: this.imageUrlRemote,
    };
  }

  // URL CONVERSION

  createObjectURL() {
    if (this.file) {
      this.imageUrlClient = URL.createObjectURL(this.file);
      return this.imageUrlClient;
    }
    return null;
  }

  revokeObjectURL() {
    if (this.imageUrlClient) {
      URL.revokeObjectURL(this.imageUrlClient);
      this.imageUrlClient = null;
    }
  }
}
