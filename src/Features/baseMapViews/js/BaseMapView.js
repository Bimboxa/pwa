import BaseMap from "Features/baseMaps/js/BaseMap";
import ImageObject from "Features/images/js/ImageObject";

import db from "App/db/db";

export default class BaseMapView {
  id;
  name;
  baseMap;
  documentSize;
  bgImage;
  baseMapPosition;
  baseMapScale;

  constructor({
    id,
    name,
    baseMap,
    documentSize,
    bgImage,
    baseMapPosition,
    baseMapScale,
  }) {
    this.id = id;
    this.name = name;
    this.baseMap = baseMap;
    this.documentSize = documentSize;
    this.bgImage = bgImage;
    this.baseMapPosition = baseMapPosition;
    this.baseMapScale = baseMapScale;
  }

  /*
   * STATIC CREATION
   */

  static createFromRecord = async (record) => {
    const baseMap = await BaseMap.createFromRecord({ id: record.baseMap?.id });
    const bgImage = new ImageObject({ ...record.bgImage });
    const baseMapView = new BaseMapView({ ...record, baseMap, bgImage });
    return baseMapView;
  };

  /*
   * GETTER
   */

  getBgImageForKonva = () => {
    return {
      url: this.bgImage.imageUrlRemote,
      width: this.bgImage.imageSize.width,
      height: this.bgImage.imageSize.height,
    };
  };
  /*
   * PARSER
   */

  toDB = () => {
    return {
      name: this.name,
      baseMapId: this.baseMap.id,
      documentSize: this.documentSize,
      bgImage: {
        imageUrlRemote: this.bgImage.imageUrlRemote,
        imageSize: this.bgImage.imageSize,
      },
    };
  };
}
