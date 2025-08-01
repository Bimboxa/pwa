import { nanoid } from "@reduxjs/toolkit";
import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import ProjectFile from "Features/projectFiles/js/ProjectFile";

import db from "App/db/db";

export default class BaseMap {
  id;
  createdAt;
  projectId;
  name;
  image;

  constructor({ id, createdAt, projectId, name, image }) {
    this.id = id;
    this.createdAt = createdAt;
    this.projectId = projectId;
    this.name = name;
    this.image = image;
  }

  // STATIC METHOD

  static async create({ projectId, name, imageFile, image }) {
    const baseMap = new BaseMap({ projectId, name, image });
    await baseMap.initialize({ imageFile });
    return baseMap;
  }

  static async createFromRecord(record) {
    console.log("debug_2807 createFromRecord", record);
    if (!record) return null;

    // the id of the file is computed from the field + id of the entity.
    const fileRecord = await db.projectFiles.get(`image_${record.id}`);

    // const bmImage = new ImageObject({
    //   ...record.image,
    //  file: fileRecord?.file,
    //imageUrlClient: URL.createObjectURL(fileRecord.file), // the record.image contains an imageUrl out of date.
    //});

    const bmImage = await ImageObject.create({ imageFile: fileRecord.file });

    return new BaseMap({
      ...record,
      image: bmImage,
    });
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
    };
  }

  toDb = () => {
    return {
      baseMapRecord: this.toJSON(),
      projectFileRecord: new ProjectFile({
        file: this.image.file,
        itemId: this.id,
        itemField: "image",
      }),
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
