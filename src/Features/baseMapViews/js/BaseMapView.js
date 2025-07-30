import BaseMap from "Features/baseMaps/js/BaseMap";
import ImageObject from "Features/images/js/ImageObject";

import db from "App/db/db";

export default class BaseMapView {
  baseMap;
  documentSize;
  bgImage;
  baseMapPosition;
  baseMapScale;

  constructor({
    baseMap,
    documentSize,
    bgImage,
    baseMapPosition,
    baseMapScale,
  }) {
    this.baseMap = baseMap;
    this.documentSize = documentSize;
    this.bgImage = bgImage;
    this.baseMapPosition = baseMapPosition;
    this.baseMapScale = baseMapScale;
  }

  /*
   * STATIC CREATION
   */

  static createFromRecord = (record) => {
    const baseMap = new BaseMap({ id: record.baseMapId });
    const bgImage = new ImageObject(...record.bgImage);
    const baseMapView = new BaseMapView({ ...record, baseMap, bgImage });
    return baseMapView;
  };

  /*
   * PARSER
   */

  toDB = () => {
    return {
      baseMapId: this.baseMap.id,
      documentSize: this.documentSize,
      bgImage: {
        imageUrlRemote: this.bgImage.imageUrlRemote,
        imageSize: this.bgImage.imageSize,
      },
    };
  };
}
