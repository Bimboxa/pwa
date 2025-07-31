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

  static create = async ({ id, x, y, baseMapId, iconIndex, iconColor }) => {
    const marker = new Marker({ id, x, y, iconIndex, iconColor });
    await marker._initialize({ baseMapId });
    return marker;
  };

  _initialize = async ({ baseMapId }) => {
    if (!this.id) this.id = nanoid();
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
    iconIndex: this.iconIndex,
    iconColor: this.iconColor,
  });
}
