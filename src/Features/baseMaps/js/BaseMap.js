import { nanoid } from "@reduxjs/toolkit";
import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import ProjectFile from "Features/projectFiles/js/ProjectFile";

import db from "App/db/db";
import editor from "App/editor";

function getImageCacheKey(image) {
  if (!image) return null;
  return (
    image.fileName ||
    image.imageUrlClient ||
    image.imageUrlRemote ||
    image.url ||
    null
  );
}

export default class BaseMap {
  constructor({
    id,
    createdAt,
    projectId,
    listingId,
    name,
    image,
    imageEnhanced,
    showEnhanced,
    meterByPx,
    latLng,
    opacity,
    opacityEnhanced,
    grayScale,
    mainAngleInDeg,
    rotation2D, // in deg
  }) {
    this.id = id;
    this.createdAt = createdAt;
    this.projectId = projectId;
    this.listingId = listingId;
    this.name = name;
    this.image = image;
    this.imageEnhanced = imageEnhanced;
    this.showEnhanced = showEnhanced;
    this.meterByPx = meterByPx;
    this.latLng = latLng;
    this.opacity = opacity;
    this.opacityEnhanced = opacityEnhanced;
    this.grayScale = grayScale;
    this.mainAngleInDeg = mainAngleInDeg;
    this.rotation2D = rotation2D;
  }

  // STATIC METHOD

  static async create({
    projectId,
    name,
    imageFile,
    image,
    imageEnhancedFile,
    imageEnhanced,
    showEnhanced,
    opacity,
    opacityEnhanced,
    grayScale,
    meterByPx,
    latLng,
    mainAngleInDeg,
    rotation2D,
  }) {
    const baseMap = new BaseMap({
      projectId,
      name,
      image,
      imageEnhanced,
      showEnhanced,
      opacity,
      opacityEnhanced,
      grayScale,
      meterByPx,
      latLng,
      mainAngleInDeg,
      rotation2D,
    });
    await baseMap.initialize({ imageFile, imageEnhancedFile });
    return baseMap;
  }

  static async createFromRecord(record) {

    try {
      if (!record) return null;

      editor.baseMapsCache = editor.baseMapsCache || {};
      const cacheEntry = editor.baseMapsCache[record.id];

      const imageKey = getImageCacheKey(record.image);
      const imageEnhancedKey = getImageCacheKey(record.imageEnhanced);

      let bmImage =
        cacheEntry && cacheEntry.imageKey === imageKey
          ? cacheEntry.image
          : null;
      let bmImageEnhanced =
        cacheEntry && cacheEntry.imageEnhancedKey === imageEnhancedKey
          ? cacheEntry.imageEnhanced
          : null;

      if (!bmImage && record?.image?.fileName) {
        const fileRecord = await db.files.get(record.image.fileName);
        if (fileRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileRecord;
          const file = new File([fileArrayBuffer], fileName, {
            type: fileMime,
          });
          bmImage = await ImageObject.create({
            imageFile: file,
            thumbnail: record.image.thumbnail
          });
        }
      }

      if (!bmImageEnhanced && record?.imageEnhanced?.fileName) {
        const fileEnhancedRecord = await db.files.get(
          record.imageEnhanced.fileName
        );
        if (fileEnhancedRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileEnhancedRecord;
          const fileEnhanced = new File([fileArrayBuffer], fileName, {
            type: fileMime,
          });
          bmImageEnhanced = await ImageObject.create({
            imageFile: fileEnhanced,
            thumbnail: record.imageEnhanced.thumbnail
          });
        }
      }

      editor.baseMapsCache[record.id] = {
        imageKey,
        imageEnhancedKey,
        image: bmImage,
        imageEnhanced: bmImageEnhanced,
      };

      const baseMap = new BaseMap({
        ...record,
        // image: bmImage ?? record.image,
        image: bmImage, // from previous computation, we should have a bmImage
        // imageEnhanced: bmImageEnhanced ?? record.imageEnhanced,
        imageEnhanced: bmImageEnhanced,
      });

      return baseMap;
    } catch (e) {
      console.error("debug_0915 error createFromRecord", e);
      return null;
    }
  }

  // INIT

  async initialize({ imageFile, imageEnhancedFile }) {
    if (!this.id) this.id = nanoid();

    if (!this.createdAt) this.createdAt = getDateString(Date.now());

    // imageFile
    if (!this.image && imageFile) {
      this.image = await ImageObject.create({ imageFile: imageFile });
    }

    // imageEnhancedFile
    if (!this.imageEnhanced && imageEnhancedFile) {
      this.imageEnhanced = await ImageObject.create({
        imageFile: imageEnhancedFile,
      });
    }

    if (!this.name && this.image) this.name = this.image.fileName;
  }

  // GETTERS

  getUrl = () => {
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.imageUrlClient ?? imageToUse?.imageUrlRemote;
  };

  getThumbnail = () => {
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.thumbnail;
  };

  getImageSize = () => {
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    //const imageToUse = this.image;
    return imageToUse.imageSize;
  };

  getImageScale = () => {
    let scale = 1;
    if (this.showEnhanced && this.imageEnhanced && this.image) {
      scale = this.imageEnhanced.imageSize.width / this.image.imageSize.width;
    }
    return scale;
  };

  getImageOffset = () => {
    let offset = { x: 0, y: 0 };
    if (this.showEnhanced && this.imageEnhanced && this.image) {
      const scale = this.getImageScale();
      offset = {
        x: (this.image.imageSize.width - this.imageEnhanced.imageSize.width / scale) / 2,
        y: (this.image.imageSize.height - this.imageEnhanced.imageSize.height / scale) / 2,
      };
    }
    return offset;
  }

  getMeterByPx = (options) => {

    const variant = options?.variant; // "imageEnhanced", "image"

    if (!this.meterByPx) return null;

    // if (this.showEnhanced && this.imageEnhanced && this.image || variant === "imageEnhanced") {
    //   return this.meterByPx * 1 / (this.imageEnhanced.imageSize.width / this.image.imageSize.width);
    // }
    return this.meterByPx;
  };

  // SERIALIZER

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      projectId: this.projectId,
      name: this.name,
      image: this.image?.toJSON(),
      imageEnhanced: this.imageEnhanced?.toJSON(),
      showEnhanced: this.showEnhanced,
      meterByPx: this.meterByPx,
      opacity: this.opacity,
      opacityEnhanced: this.opacityEnhanced,
      grayScale: this.grayScale,
      latLng: this.latLng,
      mainAngleInDeg: this.mainAngleInDeg,
      rotation2D: this.rotation2D,
    };
  }

  toDb = async () => {
    const projectFiles = [];

    if (this.image?.file) {
      const projectFile = new ProjectFile({
        file: this.image.file,
        itemId: this.id,
        itemField: "image",
      });
      projectFiles.push(await projectFile.toDb());
    }

    if (this.imageEnhanced?.file) {
      const projectFileEnhanced = new ProjectFile({
        file: this.imageEnhanced.file,
        itemId: this.id,
        itemField: "imageEnhanced",
      });
      projectFiles.push(await projectFileEnhanced.toDb());
    }

    return {
      baseMapRecord: this.toJSON(),
      projectFileRecords: projectFiles,
    };
  };

  toKonva = () => {
    const imageToUse =
      this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return {
      id: this.id,
      url: imageToUse?.imageUrlClient ?? imageToUse?.imageUrlRemote,
      width: imageToUse?.imageSize?.width,
      height: imageToUse?.imageSize?.height,
      nodeType: "MAP",
    };
  };
}
