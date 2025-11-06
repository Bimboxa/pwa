import { nanoid } from "@reduxjs/toolkit";
import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import ProjectFile from "Features/projectFiles/js/ProjectFile";

import db from "App/db/db";

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
    opacity,
    grayScale,
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
    this.opacity = opacity;
    this.grayScale = grayScale;
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
    grayScale,
    meterByPx,
  }) {
    const baseMap = new BaseMap({
      projectId,
      name,
      image,
      imageEnhanced,
      showEnhanced,
      opacity,
      grayScale,
      meterByPx,
    });
    await baseMap.initialize({ imageFile, imageEnhancedFile });
    return baseMap;
  }

  static async createFromRecord(record) {
    try {
      if (!record) return null;

      // the id of the file is computed from the field + id of the entity.
      //const fileRecord = await db.projectFiles.get(`image_${record.id}`);
      let fileRecord, file;
      let fileEnhancedRecord, fileEnhanced;
      if (record?.image?.fileName) {
        fileRecord = await db.files.get(record.image.fileName);
        if (fileRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileRecord;
          file = new File([fileArrayBuffer], fileName, { type: fileMime });
        }
      }

      if (record?.imageEnhanced?.fileName) {
        fileEnhancedRecord = await db.files.get(record.imageEnhanced.fileName);
        if (fileEnhancedRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileEnhancedRecord;
          fileEnhanced = new File([fileArrayBuffer], fileName, {
            type: fileMime,
          });
        }
      }

      const bmImage = fileRecord
        ? await ImageObject.create({ imageFile: file })
        : null;

      const bmImageEnhanced = fileEnhancedRecord
        ? await ImageObject.create({ imageFile: fileEnhanced })
        : null;

      const baseMap = new BaseMap({
        ...record,
        image: bmImage,
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
    const imageToUse =
      this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.imageUrlClient ?? imageToUse?.imageUrlRemote;
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
      grayScale: this.grayScale,
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
