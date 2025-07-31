import { nanoid } from "@reduxjs/toolkit";

import BaseMap from "Features/baseMaps/js/BaseMap";

import db from "App/db/db";

export default class Marker {
  id;
  x;
  y;
  baseMap;
  entity;

  constructor({ id, x, y, baseMap, iconIndex, iconColor }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.baseMap = baseMap;
    this.iconIndex = iconIndex;
    this.iconColor = iconColor;
  }

  static create = async ({ x, y, baseMapId }) => {
    const marker = new Marker({ x, y, baseMapId });
    await this._initialize({ baseMapId });
    return marker;
  };

  _initialize = async ({ baseMapId }) => {
    if (!this.id) id = nanoid();
    this.baseMap = new BaseMap({ id: baseMapId });
  };

  /*
   * SERIALIZER
   */

  toDb = () => ({
    id: this.id,
    x: this.x,
    y: this.y,
    baseMap: { id: this.baseMap.id },
  });
}
