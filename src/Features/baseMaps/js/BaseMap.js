import { nanoid } from "@reduxjs/toolkit";
import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import ProjectFile from "Features/projectFiles/js/ProjectFile";

import db from "App/db/db";

export default class BaseMap {
  id;
  createdAt;
  projectId;
  listingId;
  name;
  image;

  constructor({ id, createdAt, projectId, listingId, name, image, meterByPx }) {
    this.id = id;
    this.createdAt = createdAt;
    this.projectId = projectId;
    this.listingId = listingId;
    this.name = name;
    this.image = image;
    this.meterByPx = meterByPx;
  }

  // STATIC METHOD

  static async create({ projectId, name, imageFile, image }) {
    const baseMap = new BaseMap({ projectId, name, image });
    await baseMap.initialize({ imageFile });
    return baseMap;
  }

  static async createFromRecord(record) {
    try {
      if (!record) return null;

      // the id of the file is computed from the field + id of the entity.
      //const fileRecord = await db.projectFiles.get(`image_${record.id}`);
      let fileRecord, file;
      if (record?.image?.fileName) {
        fileRecord = await db.files.get(record.image.fileName);
        if (fileRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileRecord;
          file = new File([fileArrayBuffer], fileName, { type: fileMime });
        }
      }

      const bmImage = fileRecord
        ? await ImageObject.create({ imageFile: file })
        : null;

      const baseMap = new BaseMap({
        ...record,
        image: bmImage,
      });

      return baseMap;
    } catch (e) {
      console.error("debug_0915 error createFromRecord", e);
      return null;
    }
  }

  // INIT

  async initialize({ imageFile }) {
    if (!this.id) this.id = nanoid();

    if (!this.createdAt) this.createdAt = getDateString(Date.now());

    // imageFile
    if (!this.image && imageFile) {
      this.image = await ImageObject.create({ imageFile: imageFile });
    }

    if (!this.name && this.image) this.name = this.image.fileName;
  }

  // GETTERS

  getUrl = () => {
    return this.image.imageUrlClient ?? this.image.imageUrlRemote;
  };

  // SERIALIZER

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      projectId: this.projectId,
      name: this.name,
      image: this.image.toJSON(),
      meterByPx: this.meterByPx,
    };
  }

  toDb = async () => {
    const projectFile = new ProjectFile({
      file: this.image.file,
      itemId: this.id,
      itemField: "image",
    });
    return {
      baseMapRecord: this.toJSON(),
      projectFileRecord: await projectFile.toDb(),
    };
  };

  toKonva = () => {
    return {
      id: this.id,
      url: this.image.imageUrlClient,
      width: this.image.imageSize.width,
      height: this.image.imageSize.height,
      nodeType: "MAP",
    };
  };
}
