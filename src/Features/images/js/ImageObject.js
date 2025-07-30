import stringifyFileSize from "Features/files/utils/stringifyFileSize";

export default class ImageObject {
  file;
  fileName;
  fileSize;
  imageSize;
  imageUrlClient;
  imageUrlRemote;

  constructor({
    file,
    fileName,
    fileSize,
    imageSize,
    imageUrlClient,
    imageUrlRemote,
  }) {
    this.file = file;
    this.fileName = fileName ?? file?.name;
    this.fileSize = fileSize ?? file?.size;
    this.imageSize = imageSize;
    this.imageUrlClient = imageUrlClient ?? (file && URL.createObjectURL(file));
    this.imageUrlRemote = imageUrlRemote;
  }

  // STATIC FACTORY

  static async create(imageFile) {
    const instance = new ImageObject({ file: imageFile });
    await instance._initialize();
    return instance;
  }

  _initialize = async () => {
    this.imageSize = await this._computeImageSize();
  };

  _computeImageSize = async () => {
    const image = new window.Image();
    return new Promise((resolve, reject) => {
      image.onload = function () {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = (error) => {
        console.error("Error loading image for size computation:", error);
        reject(error);
      };
      image.crossOrigin = "anonymous";
      image.src = URL.createObjectURL(this.file);
    });
  };

  /*
   * GETTER
   */

  getFileSizeAsString() {
    return stringifyFileSize(this.fileSize);
  }

  // SERIALIZER

  toJSON = () => ({
    fileSize: this.fileSize,
    imageSize: this.imageSize,
    imageUrlClient: this.imageUrlClient,
    imageUrlRemote: this.imageUrlRemote,
  });

  toKonva = () => ({
    id: this.id,
    url: this.imageUrlRemote ?? this.imageUrlClient,
    x: 0,
    y: 0,
    width: this.imageSize.width,
    height: this.imageSize.height,
  });

  // DB EXCHANGE

  toDb = () => {
    return {
      file: this.file,
      props: this.toJSON(),
    };
  };

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
