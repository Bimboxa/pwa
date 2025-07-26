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
  imageProps;
  imageFile;

  constructor({ id, createdAt, projectId, name, imageProps, imageFile }) {
    this.id = id;
    this.createdAt = createdAt;
    this.projectId = projectId;
    this.name = name;
    this.imageProps = imageProps;
    this.imageFile = imageFile;
  }

  // STATIC METHOD

  static async create({ projectId, name, imageFile }) {
    const baseMap = new BaseMap({ projectId, name });
    await baseMap.initialize({ imageFile });
    return baseMap;
  }

  static async createFromRecord(record) {
    const fileRecord = await db.projectFiles.get(`imageFile_${record.id}`);
    return new BaseMap({ ...record, imageFile: fileRecord.file });
  }

  // INIT

  async initialize({ imageFile }) {
    this.id = nanoid();
    this.createdAt = getDateString(Date.now());
    const baseMapImage = await ImageObject.create(imageFile);
    this.imageProps = baseMapImage.toJSON();
    this.imageFile = baseMapImage.file;
    return baseMapImage;
  }

  // SERIALIZER

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt,
      projectId: this.projectId,
      name: this.name,
      imageProps: this.imageProps,
    };
  }

  toDb = () => {
    return {
      baseMapRecord: this.toJSON(),
      projectFileRecord: new ProjectFile({
        file: this.imageFile,
        itemId: this.id,
        itemField: "imageFile",
      }),
    };
  };
}
