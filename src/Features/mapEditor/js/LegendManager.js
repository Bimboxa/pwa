import getImageFromElement from "Features/misc/utils/getImageFromElement";
import Image2D from "./Image2D";

export default class LegendManager {
  constructor({ mapEditor }) {
    this.offsetX = 42; // initial legend offset with top right stage corner.
    this.offsetY = 42;

    this.mapEditor = mapEditor;
    this.stage = mapEditor.stage;

    this.legendImage2D;
  }

  async _createLegendImage2D({ url, x, y, width, height }) {
    const image2D = await Image2D.create({
      url,
      x,
      y,
      width,
      height,
      rotateEnabled: false,
      resizeEnabled: false,
    });
    this.mapEditor.layerImages.add(image2D.group);
    this.legendImage2D = image2D;
  }

  updateLegend = async () => {
    const element = this.mapEditor.legendRef.current;
    if (!element) return;

    const { url, width, height } = await getImageFromElement(element);

    // x & y
    let x;
    let y;
    if (this.legendImage2D) {
      x = this.legendImage2D.group.x();
      y = this.legendImage2D.group.y();
      this.legendImage2D.destroyNodes();
    } else {
      // Calculate the right edge of the stage viewport
      x = this.stage.width() - width - this.offsetX - this.mapEditor.offset.x;
      y = this.offsetY + this.mapEditor.offset.y;
    }

    await this._createLegendImage2D({
      url,
      x,
      y,
      width,
      height,
    });
  };

  /*
  * VISIBILITY
  ¨*/

  hideLegend() {
    if (this.legendImage2D) this.legendImage2D.hide();
  }
}
